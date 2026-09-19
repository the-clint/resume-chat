# OpenRouter model and cost envelope for resume Q&A

**Verdict:** For a resume-grounded, streaming Q&A bot, the cost question is effectively "free until thousands of visits." At a plausible turn size (≈2,000 input tokens for system prompt + resume + question, ~500 output tokens), the genuinely cheap candidates cost **$0.00005–$0.0004 per turn** — even `google/gemini-2.5-flash-lite` runs about **$4 per 10,000 turns**. Recommended shortlist: **`openai/gpt-oss-20b`** (≈$0.000125/turn, structured outputs, 128K context), **`qwen/qwen3.7-flash`** (same math, 1M context), and **`deepseek/deepseek-v4-flash`** (≈$0.000118/turn, cheapest strong endpoint pricing); **`google/gemini-2.5-flash-lite`** as the "name-brand" fallback at ~2–3× the cost. Free `:free` variants cost $0 and are fine for dev/testing, but are capped at **20 requests/min** and **50 requests/day** (1,000/day after you've bought ≥$10 of credits all-time). Streaming works on *every* model via OpenAI-compatible SSE on `POST /api/v1/chat/completions`; structured outputs (`response_format: json_schema`) are supported per-endpoint by every shortlisted model. All prices below were pulled directly from OpenRouter's public models API on **2026-09-19**; treat them as a snapshot, since OpenRouter reprices endpoints continuously.

---

## 1. Pricing: shortlist of genuinely cheap candidates

Prices are USD per million tokens, from OpenRouter's public models API (`GET https://openrouter.ai/api/v1/models`, retrieved 2026-09-19) — the same data that backs the [models page](https://openrouter.ai/models) [Models API]. Per-endpoint prices for the same slug vary by provider; OpenRouter's default routing load-balances across stable providers weighted by inverse-square of price, i.e. it strongly prefers the cheapest eligible endpoint (see §7) [Provider Routing].

| Model slug | Input $/M | Output $/M | Context | Notes |
| --- | --- | --- | --- | --- |
| `mistralai/mistral-nemo` | $0.019 | $0.03 | 131,072 | Cheapest, but a mid-2024-era small model — quality risk for polished prose |
| `qwen/qwen3.7-flash` | $0.03 | $0.13 | 1,000,000 | Alibaba endpoint; long context |
| `openai/gpt-oss-20b` | $0.03 | $0.13 | 131,072 | Open-weight OpenAI model (canonical); endpoint prices range $0.018–$0.075 in / $0.09–$0.30 out |
| `deepseek/deepseek-v4-flash` | $0.0395 | $0.079 | 1,048,576 | Canonical; cheapest endpoint (StreamLake) $0.0395/$0.079, priciest (Azure) $0.21/$0.56 |
| `deepseek/deepseek-v4-flash-0731` | $0.04 | $0.08 | 1,310,720 | Snapshot of the same model family |
| `meta-llama/llama-3.1-8b-instruct` | $0.05 | $0.08 | 131,072 | Canonical; cheapest endpoint (DeepInfra) $0.02/$0.04 |
| `openai/gpt-5-nano` | $0.05 | $0.40 | 400,000 | Canonical; an OpenAI endpoint offers $0.025/$0.20 |
| `google/gemini-2.5-flash-lite` | $0.10 | $0.40 | 1,048,576 | Canonical; Google AI Studio endpoint is $0.05/$0.20 |

Sources: [Models API] for canonical pricing; [Models Endpoints API] for per-endpoint ranges.

> **Canonical vs. billed price.** The models API `pricing` object (what the models page displays) is one number per model; what you actually pay is the price of whichever endpoint the router picked. With default (price-weighted) load balancing the effective price tends toward the low end of each range, and `provider: { sort: "price" }` pins it to the cheapest endpoint [Models Endpoints API, Provider Routing]. The single most expensive endpoint among shortlisted models was DeepSeek V4 Flash on Azure at $0.21/$0.56 — still well under $0.25/turn.

## 2. Cost table: one Q&A turn

Assumption: **2,000 input tokens** (system prompt + short resume + question) and **500 output tokens** (capped via `max_tokens`). Computed from the canonical prices in §1.

| Model | Input cost | Output cost | **Per turn** | Per 10,000 turns |
| --- | --- | --- | --- | --- |
| `mistralai/mistral-nemo` | $0.000038 | $0.000015 | **$0.000053** | $0.53 |
| `deepseek/deepseek-v4-flash` | $0.000079 | $0.000040 | **$0.000119** | $1.19 |
| `deepseek/deepseek-v4-flash-0731` | $0.000080 | $0.000040 | **$0.000120** | $1.20 |
| `qwen/qwen3.7-flash` | $0.000060 | $0.000065 | **$0.000125** | $1.25 |
| `openai/gpt-oss-20b` | $0.000060 | $0.000065 | **$0.000125** | $1.25 |
| `meta-llama/llama-3.1-8b-instruct` | $0.000100 | $0.000040 | **$0.000140** | $1.40 |
| `openai/gpt-5-nano` | $0.000100 | $0.000200 | **$0.000300** | $3.00 |
| `google/gemini-2.5-flash-lite` | $0.000200 | $0.000200 | **$0.000400** | $4.00 |
| any `:free` variant | $0 | $0 | **$0.00** | $0 |

Even the most expensive row is 4¢ per 100 turns. A single user grinding 50 Q&A turns on `gpt-oss-20b` costs about $0.006. A $10 credit top-up funds roughly 80,000 turns.

## 3. Streaming

Streaming is available from **any model** — it is a request feature, not a model capability: set `"stream": true` [Streaming].

- **Shape:** standard OpenAI-compatible SSE on `POST /api/v1/chat/completions` — `data: {chunk}` lines with `choices[0].delta.content`, terminated by `data: [DONE]` [Streaming].
- **Keep-alive comments:** OpenRouter emits `: OPENROUTER PROCESSING` SSE comments; a hand-rolled parser must skip lines starting with `:` before `JSON.parse` or it will crash. Use `eventsource-parser`, the OpenAI SDK, or the Vercel AI SDK to avoid this [Streaming].
- **Usage accounting:** every stream ends with an extra chunk carrying the `usage` object just before `[DONE]`. OpenRouter deliberately deviates from OpenAI's spec here: the usage chunk has one choice with an empty `delta` repeating `finish_reason` instead of an empty `choices` array — guard `choices[0]` access accordingly [Streaming].
- **Errors mid-stream:** pre-stream failures are plain JSON with the HTTP status; once 200 is committed, errors arrive as SSE events with a top-level `error` field and `finish_reason: "error"` (a 200 with an error chunk and no content is a failure) [Streaming].
- **Cancellation:** aborting the connection stops generation and billing for supported providers (OpenAI, Anthropic, DeepInfra, Groq, etc.); for unsupported providers (e.g. Google AI Studio, Mistral) the model runs to completion and you pay for it [Streaming].
- The response carries an `X-Generation-Id` header, useful for correlating/debugging [Streaming].

## 4. Cost control: per-key limits, rate limits, free variants

**Per-key credit limits.** Keys are created at [openrouter.ai/keys](https://openrouter.ai/keys) with an optional credit limit (optionally resetting daily/weekly/monthly). Once a key's limit is used up, requests are rejected until the limit is raised or resets [Authentication]. Check the key's `limit`, `limit_reset`, `limit_remaining`, and usage counters with `GET https://openrouter.ai/api/v1/key` [Limits]. Exceeding a key limit (or your account balance) returns **402 Payment Required**; branch on `error.metadata.limit_source` (`openrouter_key_limit` / `openrouter_credits` / `openrouter_in_flight_budget`) [Limits]. OpenRouter recommends a credit limit on every key — a leaked no-limit key can spend your entire balance; onboarding keys default to a $100 limit and expire after 180 days [Authentication]. There is also an **in-flight spending budget**: OpenRouter holds the estimated token cost (input + `max_tokens`) of each running paid request against your balance, up to a fraction of your balance — only relevant at concurrency well beyond this app's scale [Limits]. Workspace budgets (per-workspace spending caps) also exist [llms.txt index].

**Rate limits.** For **paid models**, OpenRouter itself lists no per-minute request cap beyond Cloudflare DDoS protection; 429s at scale typically come from the upstream provider, and fallback routing tries other providers for the same model automatically [Limits]. For **`:free` variants**, the platform enforces [Limits]:

| Credits purchased (all time) | Requests/min | Requests/day |
| --- | --- | --- |
| < $10 | 20 | 50 |
| ≥ $10 | 20 | 1,000 |

Making extra accounts or keys does not raise these limits (they're global) [Limits]. The daily counter is readable on `GET /api/v1/key` under `free_model_daily_requests` [Limits]. Mid-stream rate-limit hits arrive as an SSE error event, not an HTTP 429 [Limits, Streaming].

**`:free` variants.** Append `:free` to a model slug that offers one; it's a separate catalog entry with its own (zero) pricing, context, and endpoints [Free Variant]. Currently-listed zero-cost chat variants relevant to this app [Models API, retrieved 2026-09-19]: `deepseek/deepseek-v4-flash-0731:free` (1,048,576 ctx, `structured_outputs` ✓), `qwen/qwen3.8-27b:free` (262,144 ctx, `structured_outputs` ✓), `thinkingmachines/inkling-small:free` (1,048,576 ctx, no `structured_outputs`), `google/gemma-4-31b-it:free` (262,144 ctx, `response_format` but no `structured_outputs`), `nvidia/nemotron-3.5-lightning:free` (1M ctx, no `structured_outputs`), plus a curated router alias `openrouter/free` [Models API]. There is also a "Free Models Router" playground entry point [llms.txt index]. Practical read: dev/test on `:free` within 20 RPM / 50 RPD; production traffic needs the paid variant (paid models have no platform-level request cap) [Limits].

## 5. Structured / JSON output

Available, per-endpoint, when the guardrail design wants it:

- Send `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`; with `strict: true`, providers that have a native strict mode enforce the schema exactly, others translate it to their own format or treat it as a hint [Structured Outputs].
- Support is **per endpoint, not per model**; route only to supporting endpoints with `provider: { require_parameters: true }` [Structured Outputs].
- Works with streaming: partial valid JSON streams and completes into a schema-valid object [Structured Outputs].
- `response_format: { type: "json_object" }`-style plain JSON mode is exposed as the `response_format` parameter; strict schema enforcement is the `structured_outputs` parameter. All shortlisted models in §6 list `structured_outputs` on at least their cheapest endpoint [Models Endpoints API].

## 6. Recommended shortlist

| Rank | Model | Why |
| --- | --- | --- |
| 1 | `openai/gpt-oss-20b` | $0.03/$0.13 canonical (endpoint range down to $0.018/$0.09), `structured_outputs` ✓ on 13+ endpoints, 131K context, streams. ~$0.000125/turn. |
| 2 | `qwen/qwen3.7-flash` | Same price, 1M context headroom if the resume pack grows; `response_format` ✓ on the Alibaba endpoint (no `structured_outputs` flag listed there — use `require_parameters` carefully). |
| 3 | `deepseek/deepseek-v4-flash` | Cheapest per turn of the reasoning-capable trio ($0.0395/$0.079 at the low end), `structured_outputs` ✓, 1M context. |
| Fallback | `google/gemini-2.5-flash-lite` | Name-brand option at $0.10/$0.40 canonical; `structured_outputs` ✓; ~$0.0004/turn is still trivial. |
| Dev/test | `deepseek/deepseek-v4-flash-0731:free` or `qwen/qwen3.8-27b:free` | $0, `structured_outputs` ✓, 20 RPM / 50 RPD (1,000 RPD after $10 credits). |

Beginner-defensible pick: **`openai/gpt-oss-20b`** for production (OpenAI-lineage, cheap, structured outputs, streaming) with a `:free` variant for development.

## 7. Request surface

- **Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions` — OpenAI Chat Completions-compatible; the OpenAI SDK works by setting `baseURL: "https://openrouter.ai/api/v1"` [Authentication].
- **Auth:** `Authorization: Bearer <OPENROUTER_API_KEY>` header (the per-person access tokens for the app itself are a separate app-level mechanism; OpenRouter keys are server-side only) [Authentication].
- **Optional headers:** `HTTP-Referer` (site URL) and `X-OpenRouter-Title` (app name) — used for openrouter.ai rankings only [Authentication].
- **Model selection:** the `model` body field takes the slug (`openai/gpt-oss-20b`), optionally with variant suffixes (`:free`, `:nitro` for throughput, `:floor` for cheapest price) [Free Variant, Provider Routing]. Routing across providers is automatic and price-weighted by default; `provider.sort: "price"` pins cheapest, `require_parameters: true` filters by supported params [Provider Routing].
- **Pricing data is also API-readable:** `GET /api/v1/models` (canonical) and `GET /api/v1/models/{slug}/endpoints` (per-provider price, quantization, `supported_parameters`) — both public, no auth [Models API, Models Endpoints API].

## Sources

- OpenRouter Models API (canonical pricing, context, modalities): https://openrouter.ai/api/v1/models — retrieved 2026-09-19
- OpenRouter Models Endpoints API (per-endpoint pricing, quantization, supported parameters): https://openrouter.ai/api/v1/models/{slug}/endpoints — retrieved 2026-09-19
- Models comparison page (UI over the same data): https://openrouter.ai/models
- Streaming docs: https://openrouter.ai/docs/api_reference/streaming (read via .md)
- Authentication docs: https://openrouter.ai/docs/api_reference/authentication (read via .md)
- Limits (credit + rate limits, free-tier caps): https://openrouter.ai/docs/api_reference/limits (read via .md)
- Free Variant docs: https://openrouter.ai/docs/guides/routing/model-variants/free
- Structured Outputs docs: https://openrouter.ai/docs/guides/features/structured-outputs (read via .md)
- Provider Routing docs (default price-based load balancing, `sort`, variants): https://openrouter.ai/docs/guides/routing/provider-selection
- Docs index: https://openrouter.ai/docs/llms.txt

## Open questions

- **Quality, not price, is the deciding factor.** At these costs, a $0.0003 model beats a $0.00005 model if answers read better; the shortlist should be A/B-tested on real resume answers before locking in (out of scope for this ticket's sources).
- **Canonical vs. endpoint price drift.** The models-page price for `google/gemini-2.5-flash-lite` ($0.10/$0.40) is above its cheapest endpoint ($0.05/$0.20 on Google AI Studio); I could not verify from static docs exactly which price the models *page* highlights over time (the HTML page is client-rendered), so the table pins both numbers from the API. Expect per-endpoint prices to move continuously; re-pull `/api/v1/models` before budget lock-in.
- **Model landscape churn.** The zero-cost `:free` catalog rotates frequently (several listed variants are preview-era models); production should pin a paid slug and treat `:free` as ephemeral.
- **Non-streaming structured-output strictness** varies by endpoint provider ("strong hint" on some); if the guardrail needs guaranteed schema compliance, verify the specific endpoint's strict-mode behavior at integration time (per-endpoint support, not documented per model here).
- **Web-search plugin pricing** (`pricing.web_search`, e.g. $0.01/search on `gpt-5-nano`) exists but is irrelevant unless that plugin is enabled; not exercised here.
