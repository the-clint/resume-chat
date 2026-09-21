// Runtime query path (ticket 14): embeds the question in query mode and returns the
// top-k=3 chunks with scores + metadata from the Vectorize index. Query-only —
// nothing is embedded-and-stored here; the index is written by `npm run embed:resume`.
// The chat build (ticket 10) and throwaway retrieval checks consume this route.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { retrieveResumeContext } from "@/lib/retrieval";

export async function POST(request: Request): Promise<Response> {
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
  const { env } = getCloudflareContext();
  const chunks = await retrieveResumeContext(env, trimmed);

  return Response.json({ question: trimmed, chunks });
}
