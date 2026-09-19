# Research retrieval strategy for a single-document RAG

Type: research
Status: resolved
Blocked by: (none)

## Question

For a corpus of exactly one short document (a resume, roughly one to two pages), what retrieval approach is defensible for a beginner-portfolio RAG app, and what do the options cost? Establish:

- What "stuff the whole document into the system prompt" gives up versus real embedding retrieval, and whether a resume is large enough for retrieval to change answer quality at all.
- Embedding options reachable from a Cloudflare-hosted Next.js app (Cloudflare Workers AI embeddings, Vectorize, or an external embedding API), with current free-tier limits and pricing, cited to the owning docs.
- What a sensible chunking strategy for a resume looks like (by section? by bullet? whole-document?).
- The honest interview-story tradeoff between "real RAG with embeddings" and "prompt stuffing", including which one better demonstrates the skill the app is meant to prove.

Deliverable: a findings file at `.scratch/resume-chat/research/single-doc-retrieval.md`, every claim cited to a primary source.

## Answer

At ~1,000–1,500 tokens (1–2 page resume, stated assumption), **full-context stuffing would match or beat retrieval on answer quality** — the whole corpus fits the window, so retrieval only adds an approximation step. What stuffing gives up is precisely the thing the portfolio is meant to prove: no chunking, no embedding model, no vector store, no top-k, no attribution of which chunk answered. It also bakes in a prompt-growth pattern and cannot accept a second document without rewriting the prompt.

Recommended design: **real retrieval, cheaply — Cloudflare Workers AI embeddings into Vectorize.** Embed with `@cf/baai/bge-m3` ($0.012/M input tokens, 1024 dims, 60k context, has a query-vs-context mode) via `env.AI.run` on Workers or the OpenAI-compatible endpoint; store in Vectorize (Free: 30M queried dims/month, 5M stored; the app uses ~10K stored dims). Free tier covers this at ~100% headroom — 10,000 Neurons/day, and embedding the resume once costs single-digit neurons. Chunk by resume section/job (6–12 chunks with metadata). Honest downside to state out loud: top-k can drop context a stuffed prompt would have included, so a spanning question may answer worse than stuffing — the justification is architectural realism, not accuracy.

Noted candidly in the findings: with ~10 chunks, Vectorize is overkill (cosine over 10 vectors is a `for` loop); its value is being the store a real corpus would use. External option if one vendor is preferred: OpenRouter exposes `/api/v1/embeddings` (e.g. `baai/bge-m3` $0.01/M, plus `:free` variants with short contexts).

Caveats flagged: actual resume token count is unmeasured; Cloudflare's own docs disagree on bge-m3 price ($0.012 vs $0.0118/M).

Full findings with limits, prices, and chunking detail: [`../research/single-doc-retrieval.md`](../research/single-doc-retrieval.md)
