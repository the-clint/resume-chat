// Runtime query path (ticket 14), gated per ticket 10: the per-request gate
// (session re-check → minute limiter → D1 usage counter) runs before any
// retrieval work. 429 bodies carry the limit reason so the UI can show the
// distinct messages; every 401 carries the identical body (nothing leaks about
// the token list).
// Throwaway retrieval checks with a valid token still consume this route.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { gateRequest } from "@/lib/gate";
import { retrieveResumeContext } from "@/lib/retrieval";

export async function POST(request: Request): Promise<Response> {
  const { env } = getCloudflareContext();
  const gate = await gateRequest(request, env);
  if (!gate.ok) return gate.response;

  let question: unknown;

  try {
    const body = await request.json();
    if (body !== null && typeof body === "object" && "question" in body) {
      question = body.question;
    }
  } catch {
    return Response.json(
      { error: "Request body must be JSON with a 'question' string." },
      { status: 400 },
    );
  }
  if (typeof question !== "string" || question.trim().length === 0) {
    return Response.json(
      { error: "Provide a non-empty 'question' string." },
      { status: 400 },
    );
  }
  const trimmed = question.trim();
  const chunks = await retrieveResumeContext(env, trimmed);

  return Response.json({ question: trimmed, chunks });
}
