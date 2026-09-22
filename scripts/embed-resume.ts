// Embed script (ticket 14): reads the Resume (content/resume.md), chunks it by
// section/role (scripts/chunk-resume.ts), embeds each chunk via Workers AI
// @cf/baai/bge-m3 through the real env.AI binding, and replaces the Vectorize
// index contents (full replace: delete known ids + re-insert). The only thing that
// ever writes the index; runtime is query-only (see lib/retrieval.ts).
//
// Runs under wrangler's platform proxy (getPlatformProxy) against wrangler.jsonc,
// where RESUME_VECTORS and AI are marked remote: true — i.e. the real deployed
// resources, not local simulations. Prerequisites:
//   npx wrangler login
//   npx wrangler vectorize create resume-chunks --dimensions 1024 --metric cosine
//
// Order matters: embeds everything BEFORE deleting, so a failed run leaves the
// current index untouched.

import { readFile, writeFile } from "node:fs/promises";
import { getPlatformProxy } from "wrangler";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../lib/retrieval";
import { chunkResume } from "./chunk-resume";

const RESUME_PATH = new URL("../content/resume.md", import.meta.url);
/** Records the ids of the last successful insert so the next run can delete the full set. */
const MANIFEST_PATH = new URL("./resume-vectors.json", import.meta.url);
/** Vectors per insert call (Vectorize limit is 100) and texts per AI batch. */
const BATCH_SIZE = 100;

interface StoredVector {
  id: string;
  values: number[];
  metadata: Record<string, string | string[]>;
}

async function main(): Promise<void> {
  const resume = await readFile(RESUME_PATH, "utf8");
  const chunks = chunkResume(resume);
  if (chunks.length === 0) {
    throw new Error(
      "No chunks produced from content/resume.md — aborting without touching the index",
    );
  }
  console.log(`Chunked content/resume.md into ${chunks.length} chunks:`);
  for (const chunk of chunks) {
    console.log(
      `  - ${chunk.id}  (${chunk.text.length} chars, ${chunk.skills.length} skills)`,
    );
  }

  const proxy = await getPlatformProxy();
  // getPlatformProxy types env as Record<string, unknown>; it actually holds the
  // real bindings from wrangler.jsonc.
  const env = proxy.env as unknown as CloudflareEnv;
  try {
    const vectors: StoredVector[] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const output = (await env.AI.run(EMBEDDING_MODEL, {
        text: batch.map((chunk) => chunk.text),
      })) as Ai_Cf_Baai_Bge_M3_Output_Embedding;
      const data = output.data;
      if (!data || data.length !== batch.length) {
        throw new Error("Embedding response missing vectors");
      }
      batch.forEach((chunk, j) => {
        const values = data[j];
        if (values.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding for "${chunk.id}" has ${values.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
          );
        }
        vectors.push({
          id: chunk.id,
          values,
          metadata: {
            text: chunk.text,
            section: chunk.section,
            ...(chunk.company ? { company: chunk.company } : {}),
            ...(chunk.dates ? { dates: chunk.dates } : {}),
            skills: chunk.skills,
          },
        });
      });
    }
    // Full-index replace. The Vectorize binding API has no deleteAll(), so the
    // replace deletes every id the index can contain: chunk ids are deterministic
    // slugs, this script is the only writer, and scripts/resume-vectors.json
    // records the ids of the last successful run. deleteByIds tolerates missing
    // ids; anything not in the set cannot exist (e.g. first run on a fresh index).
    const manifest = await readFile(MANIFEST_PATH, "utf8")
      .then((raw) => JSON.parse(raw) as { ids?: string[] })
      .catch(() => ({ ids: [] as string[] }));
    const currentIds = vectors.map((vector) => vector.id);
    const deletable = manifest.ids ?? [];
    for (const id of currentIds) {
      if (!deletable.includes(id)) deletable.push(id);
    }

    console.log(
      `Embedded ${vectors.length} chunks at ${EMBEDDING_DIMENSIONS} dims; replacing index contents…`,
    );
    await env.RESUME_VECTORS.deleteByIds(deletable);
    const inserted = await env.RESUME_VECTORS.insert(vectors);
    const count = inserted.ids?.length ?? vectors.length;
    await writeFile(
      MANIFEST_PATH,
      `${JSON.stringify({ ids: currentIds }, null, 2)}\n`,
    );
    console.log(
      `Done: deleted ${deletable.length} known ids, inserted ${count} vectors into index "resume-chunks".`,
    );
  } finally {
    await proxy.dispose();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
