# Research retrieval strategy for a single-document RAG

Type: research
Status: open
Blocked by: (none)

## Question

For a corpus of exactly one short document (a resume, roughly one to two pages), what retrieval approach is defensible for a beginner-portfolio RAG app, and what do the options cost? Establish:

- What "stuff the whole document into the system prompt" gives up versus real embedding retrieval, and whether a resume is large enough for retrieval to change answer quality at all.
- Embedding options reachable from a Cloudflare-hosted Next.js app (Cloudflare Workers AI embeddings, Vectorize, or an external embedding API), with current free-tier limits and pricing, cited to the owning docs.
- What a sensible chunking strategy for a resume looks like (by section? by bullet? whole-document?).
- The honest interview-story tradeoff between "real RAG with embeddings" and "prompt stuffing", including which one better demonstrates the skill the app is meant to prove.

Deliverable: a findings file at `.scratch/resume-chat/research/single-doc-retrieval.md`, every claim cited to a primary source.
