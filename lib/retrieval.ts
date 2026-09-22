// Runtime retrieval path, per ticket 07's settled design: the question is embedded
// in query mode with bge-m3 and queried against the Vectorize index, top-k=3 with
// scores + chunk metadata. Query-only — the index is written exclusively by the
// Embed script (`npm run embed:resume`); nothing is embedded-and-stored at runtime.
// The chunk text itself rides in the vector metadata (the Embed script writes it),
// so a query returns the grounding text the chat prompt injects — no runtime reading
// of content/resume.md, which ticket 07 keeps out of the deployed bundle.
// Kept free of Next.js/adapter imports so scripts/embed-resume.ts can share the
// embedding constants.

export const EMBEDDING_MODEL = "@cf/baai/bge-m3";
export const EMBEDDING_DIMENSIONS = 1024;
export const TOP_K = 3;

export interface RetrievedChunk {
  id: string;
  score: number;
  /** Markdown text of the chunk — the grounding text the chat prompt injects. */
  text: string;
  section: string;
  company: string | null;
  dates: string | null;
  skills: string[];
}

/** Embeds the question and returns the top-k chunks, highest score first. */
export async function retrieveResumeContext(
  env: Pick<CloudflareEnv, "AI" | "RESUME_VECTORS">,
  question: string,
): Promise<RetrievedChunk[]> {
  const output = (await env.AI.run(EMBEDDING_MODEL, {
    text: [question],
  })) as Ai_Cf_Baai_Bge_M3_Output_Embedding;
  const vector = output.data?.[0];
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected ${EMBEDDING_MODEL} response while embedding the question`,
    );
  }

  const result = await env.RESUME_VECTORS.query(vector, {
    topK: TOP_K,
    returnMetadata: "all",
  });

  return (result.matches ?? []).map((match) => {
    const meta = match.metadata ?? {};
    return {
      id: match.id,
      score: match.score,
      text: typeof meta.text === "string" ? meta.text : "",
      section: typeof meta.section === "string" ? meta.section : "",
      company: typeof meta.company === "string" ? meta.company : null,
      dates: typeof meta.dates === "string" ? meta.dates : null,
      skills: Array.isArray(meta.skills)
        ? meta.skills.filter(
            (skill): skill is string => typeof skill === "string",
          )
        : [],
    };
  });
}
