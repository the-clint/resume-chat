# Retrieval strategy for a single-document RAG (resume)

**Verdict.** For a corpus of one 1–2 page resume (~600–1,000 words, ~1,000–1,500 tokens), full-context stuffing will produce answers at least as good as embedding retrieval, and it costs essentially nothing — but it demonstrates nothing, because the thing this portfolio app is supposed to prove is the RAG pipeline itself. The defensible design is: **use real embedding retrieval as the implemented architecture (Cloudflare Workers AI embeddings + Vectorize, with the resume chunked by section), while keeping the resume small enough that stuffing would also work** — and be able to say exactly that in an interview. The honest downside of real retrieval here: for a single short document, retrieval can *lower* answer quality versus stuffing (a question spanning "skills" + "most recent job" may retrieve only one chunk), and it adds moving parts (index build, embedding model versioning) that serve pedagogy rather than user value. All costs below are free-tier: a single resume makes every billable counter on every option round to ~$0.

## Assumptions

- Resume length: **1–2 pages ≈ 600–1,000 words ≈ roughly 1,000–1,500 tokens** (resume prose, dense bullets, tables of dates/skills tokenizes at ~1–1.5 tokens/word; this is an estimate, not a cited figure — flag: no primary source defines "pages→tokens", so treat chunk counts and token math as assumptions).
- The app's LLM chat runs through OpenRouter (`/v1/chat/completions`, OpenAI-compatible, [OpenRouter API reference, https://openrouter.ai/docs/api_reference/embeddings.md — the API base is `https://openrouter.ai/api/v1`, confirmed across OpenRouter docs](https://openrouter.ai/docs/api_reference/embeddings.md)).
- Hosting is Cloudflare; the Next.js app is served at the edge (Workers/OpenNext or static+edge functions). Any Node-runtime API route can call any of the embedding options below over HTTPS.

## What full-context stuffing gives up (and what it doesn't)

**Doesn't give up: answer quality — at this corpus size.** A 1,000–1,500-token resume fits entirely in any modern LLM context window, so there is no truncation pressure and no retrieval recall problem to solve: the model sees 100% of the corpus every turn. Retrieval changes answer quality only when the corpus exceeds what fits (or what you're willing to pay for) in the prompt. For one short document, top-k over ~10 chunks selects *most* of the document anyway, so retrieval adds an approximation step on top of "just show everything."

**Gives up: the thing being demonstrated.** Stuffing has no chunking, no embedding model, no vector store, no retrieval step, no top-k tuning, no grounding/citation of which chunk answered the question. If the portfolio goal is "I can build RAG," stuffing proves prompt engineering, not retrieval engineering.

**Gives up: cost scaling behavior.** With stuffing, every chat turn re-sends the full document as input tokens. OpenRouter bills prompt tokens per turn (embedding-free chat usage is metered per request; [OpenRouter chat completions API, usage in response, https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion.md](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion.md)). At ~1.5k tokens it's pennies-to-zero, but the pattern is the one that becomes expensive at 100k tokens; retrieval caps input growth at top-k chunk size. (Provider prompt-caching can blunt the repeat-send cost — OpenRouter documents prompt caching per provider, [https://openrouter.ai/docs/guides/best-practices/prompt-caching.md](https://openrouter.ai/docs/guides/best-practices/prompt-caching.md) — but caching is provider/model-dependent, not an architectural fix.)

**Gives up: scalability story.** The same code that stuffs one resume cannot take a second document, a project appendix, or a blog corpus. Retrieval code takes them with zero prompt change.

## Embedding options reachable from a Cloudflare-hosted Next.js app

### Option A — Cloudflare Workers AI embeddings (recommended embedding source)

- Models (embeddings family, per [Workers AI pricing, https://developers.cloudflare.com/workers-ai/platform/pricing/](https://developers.cloudflare.com/workers-ai/platform/pricing/)): `@cf/baai/bge-small-en-v1.5` ($0.020/M input tokens, 384 dims), `bge-base-en-v1.5` ($0.067/M, 768 dims), `bge-large-en-v1.5` ($0.204/M, 1024 dims), `@cf/baai/bge-m3` ($0.012/M, 1024 dims), `@cf/pfnet/plamo-embedding-1b` ($0.019/M), `@cf/qwen/qwen3-embedding-0.6b` ($0.012/M). Dimensions for the bge family confirmed against the upstream model configs ([BAAI/bge-small-en-v1.5, bge-base-en-v1.5, bge-large-en-v1.5, bge-m3 `hidden_size`, https://huggingface.co/BAAI/bge-m3/raw/main/config.json](https://huggingface.co/BAAI/bge-m3/raw/main/config.json)).
- **Free tier:** 10,000 Neurons/day free on both Workers Free and Paid plans; embeddings here are ~1,075–18,582 neurons per M input tokens, so a 1,500-token resume embedded once consumes on the order of 2–28 neurons — i.e., **free forever at portfolio traffic** ([Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)).
- **Rate limit:** text embeddings 3,000 requests/min (bge-large 1,500/min) ([Workers AI limits, https://developers.cloudflare.com/workers-ai/platform/limits/](https://developers.cloudflare.com/workers-ai/platform/limits/)).
- **Reachability from Next.js:** two paths. (1) REST from any Node/edge route: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/baai/bge-m3` with a bearer API token ([bge-m3 model page, https://developers.cloudflare.com/workers-ai/models/bge-m3/](https://developers.cloudflare.com/workers-ai/models/bge-m3/)); (2) **OpenAI-compatible endpoint**: set the OpenAI SDK `baseURL` to `https://api.cloudflare.com/client/v4/accounts/{acct}/ai/v1` and call `openai.embeddings.create` ([OpenAI compatible API endpoints, https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)). If the app is deployed on Workers via OpenNext, the native `env.AI.run()` binding is also available.
- `bge-m3` specifics: 60k-token context window, supports single string or array input, has a `query` parameter for query-vs-context retrieval mode ([bge-m3 model page](https://developers.cloudflare.com/workers-ai/models/bge-m3/)). Cloudflare's own Vectorize docs show the Workers AI → Vectorize handoff pattern (`env.AI.run(...)` → pass `data[0]` to `index.query(...)`) ([Query vectors, https://developers.cloudflare.com/vectorize/best-practices/query-vectors/](https://developers.cloudflare.com/vectorize/best-practices/query-vectors/)).

### Option B — Vectorize (the vector store; pair with A)

- Free tier: **30M queried vector dimensions/month, 5M stored vector dimensions** on Workers Free; 100 indexes per account on Free, 50,000 on Paid ([Vectorize limits, https://developers.cloudflare.com/vectorize/platform/limits/](https://developers.cloudflare.com/vectorize/platform/limits/)). Max dimensions per vector: 1536, so any bge model fits ([Vectorize limits](https://developers.cloudflare.com/vectorize/platform/limits/)).
- Paid pricing: $0.01/M queried dimensions + $0.05/100M stored dimensions; first 50M queried + 10M stored dimensions/month included on Paid ([Vectorize pricing, https://developers.cloudflare.com/vectorize/platform/pricing/](https://developers.cloudflare.com/vectorize/platform/pricing/)).
- Scale check for one resume: ~10 chunks × 1024 dims (bge-m3) = ~10K stored dims (vs 5M free cap = 0.2% of it). Even at the paid formula's toy scale this is **$0.00/month**. Vectorize is now GA ([Vectorize pricing page banner](https://developers.cloudflare.com/vectorize/platform/pricing/)).
- Honest note: with ~10 chunks, Vectorize is overkill — cosine similarity over 10 vectors in memory is one `for` loop. Its value here is architectural realism (it *is* the vector database a real deployment would use) plus namespaces/metadata filtering for future growth.

### Option C — External embedding API via OpenRouter (already your LLM vendor)

- OpenRouter exposes `POST https://openrouter.ai/api/v1/embeddings` (OpenAI-compatible, batch arrays supported) plus a model listing endpoint ([Embeddings API, https://openrouter.ai/docs/api_reference/embeddings.md](https://openrouter.ai/docs/api_reference/embeddings.md)).
- Catalog as of 2026-09-19 (live query against `GET /api/v1/embeddings/models` — this is the owning provider's own API response): notable paid models include `openai/text-embedding-3-small` ($0.02/M input tokens), `qwen/qwen3-embedding-0.6b` ($0.02/M), `voyageai/voyage-4-lite` ($0.02/M), `baai/bge-m3` ($0.01/M), `google/gemini-embedding-001` ($0.15/M); **free variants exist**: `liquid/lfm-2.5-embedding-350m:free` (512-token context) and `nvidia/llama-nemotron-embed-vl-1b-v2:free` ([OpenRouter embeddings models API, https://openrouter.ai/api/v1/embeddings/models](https://openrouter.ai/api/v1/embeddings/models)).
- Tradeoff: one API key for LLM + embeddings and no second dashboard; but dimensions vary wildly per model (e.g., text-embedding-3-small is 1536-dim by upstream spec) and the free embedding variants are small models with short contexts — fine for resume chunks, weak as a story.
- (Other externals — OpenAI, Voyage, Gemini API direct — all work over HTTPS from Cloudflare, but none is free-tier-simpler than Workers AI for a portfolio; the OpenRouter route above already covers "external API" if a vendor-diversification story is wanted.)

## Chunking strategy for a resume

A resume has natural, semantically self-contained boundaries. Recommended:

- **Chunk by section, one chunk per role/job** (each work-experience entry: title, company, dates, bullets), plus separate chunks for summary, skills, education, projects. For a typical 2-page resume this yields **~6–12 chunks of ~100–200 tokens each**. Overlap is unnecessary — sections don't split mid-thought.
- Whole-document as one chunk also works at this size and sidesteps fragmentation, but then "retrieval" degenerates into stuffing-with-extra-steps and no top-k behavior exists to demonstrate.
- Arbitrary fixed-size chunks (e.g., 500-token sliding windows) are the wrong tool: they cut roles and skills blocks at random boundaries. OpenRouter's own embeddings guidance says to split long documents into meaningful semantic units (paragraphs/sections) rather than arbitrary limits ([OpenRouter embeddings best practices, https://openrouter.ai/docs/api_reference/embeddings.md](https://openrouter.ai/docs/api_reference/embeddings.md)).
- Attach metadata per chunk (`section`, `company`, `dates`, `skills[]`) — Vectorize supports up to 10KiB metadata per vector and metadata filtering ([Vectorize limits, https://developers.cloudflare.com/vectorize/platform/limits/](https://developers.cloudflare.com/vectorize/platform/limits/); [Vectorize metadata filtering, https://developers.cloudflare.com/vectorize/reference/metadata-filtering/](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/)), which makes "what did I do at X" queries trivially filterable later.
- Re-embed the whole resume on edit (it's one document; there is no incremental-update problem worth solving).

## Recommendation (with downside stated)

**Ship real RAG with a small, honest implementation:**
1. Chunk the resume by section/job → ~6–12 chunks with metadata.
2. Embed with `@cf/baai/bge-m3` via Workers AI (OpenAI-compatible REST from Next.js routes; free daily neuron allocation covers it at any portfolio-level traffic).
3. Store/query in Vectorize free tier (30M queried dims/month, 5M stored dims — this app uses ~10K stored dims and a few thousand queried dims/month).
4. Chat via OpenRouter as planned; inject top-k (k=3–4) retrieved chunks with scores.

**Downside, stated plainly:** for exactly one short document this is strictly more machinery for the same or marginally worse answer quality than stuffing — top-k can drop a chunk a whole-resume prompt would have had. The justification is that the app's purpose is to demonstrate the RAG skill, and this stack is the same one a real multi-document corpus would need; that is the interview answer too. "We stuffed the whole resume into the system prompt because it's one short document and retrieval changes nothing here — we built the retrieval path anyway and could scale it to a real corpus" is the defensible line; a pure-stuffing app cannot be defended as RAG experience.

## Sources

- Cloudflare Workers AI Pricing (neurons, free allocation, embeddings model pricing table) — https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Workers AI Limits (embeddings rate limits) — https://developers.cloudflare.com/workers-ai/platform/limits/
- Cloudflare Workers AI bge-m3 model page (context window, REST usage, `query` param) — https://developers.cloudflare.com/workers-ai/models/bge-m3/
- Cloudflare Workers AI OpenAI-compatible endpoints (`/v1/embeddings`, SDK baseURL) — https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- Cloudflare Vectorize Pricing (queried/stored dimension billing, free-tier allocations, GA) — https://developers.cloudflare.com/vectorize/platform/pricing/
- Cloudflare Vectorize Limits (index/vector/metadata limits, 1536 max dims) — https://developers.cloudflare.com/vectorize/platform/limits/
- Cloudflare Vectorize Query vectors (Workers AI → Vectorize integration pattern) — https://developers.cloudflare.com/vectorize/best-practices/query-vectors/
- Cloudflare Vectorize metadata filtering reference — https://developers.cloudflare.com/vectorize/reference/metadata-filtering/
- OpenRouter Embeddings API (`/v1/embeddings`, models list, chunking best practices) — https://openrouter.ai/docs/api_reference/embeddings.md
- OpenRouter Embeddings Models list (live API, pricing per model, free variants, 2026-09-19) — https://openrouter.ai/api/v1/embeddings/models
- OpenRouter Chat Completions API reference (per-request usage billing) — https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion.md
- OpenRouter Prompt Caching guide — https://openrouter.ai/docs/guides/best-practices/prompt-caching.md
- BAAI bge model configs on Hugging Face (embedding dimensions: small 384 / base 768 / large 1024 / m3 1024) — https://huggingface.co/BAAI/bge-m3/raw/main/config.json (and sibling model configs)

## Open questions

- Exact token count of the actual resume used in the app (estimate assumed ~1,000–1,500 tokens; measure once the resume source lands — affects nothing but nice for the README).
- Whether the deployment target is Workers via OpenNext or static/edge functions: if Workers, prefer the native `env.AI` + Vectorize bindings; if classic Node hosting, everything goes over REST with an API token (all options above still work). Not resolvable from this ticket.
- Whether `liquid/lfm-2.5-embedding-350m:free` (512-token context, 1024-dim) is acceptable as a zero-cost OpenRouter-only alternative; untested quality for resume-style retrieval.
- Workers AI pricing page (updated 2026-09-17) lists `bge-m3` at both "$0.012 per M input tokens" and the model page's "$0.0118 per M input tokens" — trivial discrepancy in Cloudflare's own docs; flagged as read, not resolved.
