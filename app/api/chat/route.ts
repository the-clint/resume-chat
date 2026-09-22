// The chat turn (the real gate + retrieval + LLM path). Order per the gate
// contract: session → minute limiter → D1 usage counter, all before any retrieval
// or OpenRouter work, so a refused request costs nothing but the check.
//
// Wire format out: SSE, one `data: {ChatStreamEvent}` frame per event — the same
// framing OpenRouter uses, so the browser side parses it with the shared
// SSEPayloadParser (lib/chat-stream.ts). Limit and auth refusals never reach the
// stream: they come back as the gate's JSON bodies before the 200, and the UI maps
// the `error` codes to its distinct messages (ticket 10).
//
// Retrieval runs on the latest question only; the last ~6 turns of transcript go to
// the model (ticket 08). Errors are logged server-side and reported to the browser
// as the generic bubble — no detail, no hints about the token list.

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { streamOpenRouterEvents } from "@/lib/chat-stream";
import type { ChatStreamEvent } from "@/lib/chat-stream";
import { gateRequest } from "@/lib/gate";
import {
  buildChatMessages,
  buildSystemPrompt,
  parseChatMessages,
} from "@/lib/prompt";
import { retrieveResumeContext } from "@/lib/retrieval";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Ticket 09: output cap per request — the strongest user-proof cost bound. */
const MAX_OUTPUT_TOKENS = 1000;

function failure(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const gate = await gateRequest(request, env);
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("bad_request", 400);
  }
  const messages = parseChatMessages(
    body !== null && typeof body === "object"
      ? (body as { messages?: unknown }).messages
      : undefined,
  );
  if (!messages) return failure("bad_request", 400);

  let systemPrompt: string;
  try {
    const chunks = await retrieveResumeContext(
      env,
      messages[messages.length - 1].content,
    );
    systemPrompt = buildSystemPrompt(chunks);
  } catch (error) {
    console.error("Retrieval failed", error);
    return failure("server_error", 502);
  }

  // Owning the abort lets a vanished browser stop the upstream generation (and its
  // billing, where the provider honours cancellation).
  const abort = new AbortController();
  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clint.broadhead.dev",
        "X-OpenRouter-Title": "Clint's resume chat",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages: buildChatMessages(messages, systemPrompt),
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: abort.signal,
    });
  } catch (error) {
    console.error("OpenRouter request failed", error);
    return failure("server_error", 502);
  }

  const upstreamBody = upstream.body;
  if (!upstream.ok || !upstreamBody) {
    // A 402 here is ticket 09's "temporarily unavailable": the OpenRouter key's
    // credit limit is spent and only Clint can act on it, so the user sees the
    // generic bubble, not a limit message.
    const detail = await upstream.text().catch(() => "");
    console.error(`OpenRouter ${upstream.status}: ${detail.slice(0, 500)}`);
    return failure("server_error", 502);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      let settled = false;
      const send = (event: ChatStreamEvent) => {
        out.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of streamOpenRouterEvents(upstreamBody)) {
          if (event.type === "delta") {
            send(event);
            continue;
          }
          settled = true;
          send(event);
          break;
        }
        if (!settled) send({ type: "done" });
      } catch (error) {
        // Cancellation and upstream read failures both land here; only the latter
        // is worth telling the browser about.
        if (!abort.signal.aborted) {
          console.error("Chat stream failed", error);
          send({ type: "error", code: "upstream_error" });
        }
      } finally {
        try {
          out.close();
        } catch {
          // The browser already went away; nothing left to close.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
