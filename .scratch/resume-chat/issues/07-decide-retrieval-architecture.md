# Decide retrieval architecture for the resume corpus

Type: grilling
Status: resolved
Blocked by: 03

## Question

Decide how a question becomes resume-grounded context, and where the resume text lives. Informed by the retrieval research (ticket 03):

- Full-context stuffing versus embedding retrieval — and if retrieval, which embedding source and which store.
- The resume source of truth: committed markdown, the PDF, or both. What does the deployed app read?
- Chunking strategy if retrieval is chosen.
- How updates to the resume propagate after launch (re-embed, redeploy, or nothing).

HITL.

## Answer

Resolved 2026-09-21 (grilling, HITL).

- **Real retrieval, deliberately.** Stuffing would match answer quality at this corpus size (~1–1.5k tokens), but the app exists to demonstrate the RAG pipeline; stuffing was rejected for that reason, knowingly accepting equal-or-marginally-worse answers on one short doc. Interview line: "we built the retrieval path a real corpus would need."
- **Embedding source + store:** Cloudflare Workers AI `@cf/baai/bge-m3` (1024-dim) into Vectorize free tier (~10K stored dims vs 5M cap). Wired via **native bindings** (`env.AI` + Vectorize index binding, read through `getCloudflareContext()` under OpenNext) — no REST tokens; REST is fallback only if binding access fights back. Vendor split: Cloudflare embeddings, OpenRouter LLM.
- **Source of truth:** `content/resume.md`, committed. The markdown already exists (confirmed by the human; no transcription). The deployed app **never reads it** — only the embed script does; the Next bundle carries no resume text. PDF never enters the runtime path; optionally `public/resume.pdf` later as a static download link.
- **Chunking:** one chunk per resume section/role entry (~6–12 chunks, ~100–200 tokens), metadata per chunk (`section`, `company`, `dates`, `skills[]`), no overlap. Query side: `bge-m3` query mode, top-k=3, scores included in the prompt; chunk names double as the citation source for ticket 08's grounding work.
- **Update propagation:** local script `npm run embed:resume` — chunk, embed, delete-all + re-insert into Vectorize. No redeploy for content changes; trivially idempotent at ~10 chunks.
- Facts downstream tickets depend on: runtime is query-only (nothing embeds at request time); content edits propagate in seconds via the script; any second document later rides the same path with zero prompt change.
