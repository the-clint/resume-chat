// OpenRouter SSE → app chat events. Research 02 §3 lists the two parser traps —
// keep-alive `: OPENROUTER PROCESSING` comments (a hand-rolled parser that feeds
// them to JSON.parse crashes) and the non-standard final usage chunk (one choice
// with an empty delta rather than an empty choices array). Both are handled here.
//
// Isomorphic on purpose: the browser half of the chat reads the same `data:`
// framing out of the route's response, so the same splitter serves both sides.

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "error"; code: string }
  | { type: "done" };

/**
 * Splits a chunked SSE byte stream into complete `data:` payloads, in order.
 * Buffers a partial line across pushes; skips comments and every other field name.
 */
export class SSEPayloadParser {
  private buffer = "";

  push(text: string): string[] {
    this.buffer += text;
    const payloads: string[] = [];
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (line.startsWith("data:")) {
        payloads.push(line.slice("data:".length).trim());
      }
    }
    return payloads;
  }
}

/** Decodes one OpenRouter `data:` payload; null for payloads carrying nothing to show. */
export function parseOpenRouterEvent(payload: string): ChatStreamEvent | null {
  if (payload === "[DONE]") return { type: "done" };
  if (payload === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { type: "error", code: "upstream_error" };
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const chunk = parsed as {
    error?: unknown;
    choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
  };
  if (chunk.error) return { type: "error", code: "upstream_error" };

  const choice = chunk.choices?.[0];
  if (typeof choice?.delta?.content === "string" && choice.delta.content) {
    return { type: "delta", text: choice.delta.content };
  }
  // A 200 turn that fails mid-stream arrives as a choice with finish_reason "error"
  // (a completion with no content is a failure, research 02 §3).
  if (choice?.finish_reason === "error") {
    return { type: "error", code: "upstream_error" };
  }
  // Role-only deltas and the trailing usage chunk carry nothing to display.
  return null;
}

/** Streams decoded events from an upstream SSE body. */
export async function* streamOpenRouterEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEPayloadParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      for (const payload of parser.push(
        decoder.decode(value, { stream: true }),
      )) {
        const event = parseOpenRouterEvent(payload);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
