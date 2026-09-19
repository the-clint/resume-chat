# Research OpenRouter model and cost envelope for resume Q&A

Type: research
Status: resolved
Blocked by: (none)

## Question

Which OpenRouter model(s) fit a resume-grounded Q&A bot that must stream answers, and what does it actually cost? Establish, each with a citation to OpenRouter's own docs or pricing pages (not third-party summaries):

- Current pricing (input/output per million tokens) for a shortlist of candidate models a beginner could defend choosing.
- Which candidates support streaming, and the shape of the streaming response the API returns.
- Realistic cost of a single Q&A turn at plausible sizes: a short resume-sized context in the prompt plus ~500 output tokens.
- How OpenRouter-side cost control works: per-key credit/spend limits, rate limits, and any free or `:free` variants with their restrictions.
- Whether structured output / JSON mode is available, in case the guardrail design wants it.
- The request surface: required headers, auth, and how to select a model.

Deliverable: a findings file at `.scratch/resume-chat/research/openrouter-model-cost.md`, with a small cost table and every claim cited.

## Answer

Cost is not a real constraint at this scale. At **2,000 input / 500 output tokens per turn**, the cheap shortlist runs **$0.00005–$0.0004 per turn** — `mistral-nemo` $0.000053, `deepseek-v4-flash` $0.000119, `qwen3.7-flash` and `openai/gpt-oss-20b` $0.000125, `gemini-2.5-flash-lite` $0.0004. A $10 top-up is roughly 80,000 turns on `gpt-oss-20b`; a user grinding 50 turns costs ~$0.006. Recommended shortlist: **`openai/gpt-oss-20b`** (primary; structured outputs, 128K context), `qwen/qwen3.7-flash`, `deepseek/deepseek-v4-flash`; `gemini-2.5-flash-lite` as the name-brand fallback. `:free` variants cost $0 and are fine for development, capped at **20 RPM / 50 RPD** under $10 lifetime credits (1,000 RPD above).

Streaming is a request feature available for any model: OpenAI-compatible SSE on `POST /api/v1/chat/completions`, terminated by `data: [DONE]`. Two parser traps: keep-alive `: OPENROUTER PROCESSING` comment lines must be skipped, and the final usage chunk deviates from OpenAI's shape (a choice with an empty `delta` rather than an empty `choices` array). Pre-stream errors are plain JSON; post-200 errors arrive as SSE events with `finish_reason: "error"`. Aborting stops billing only on providers that support it.

Cost control on OpenRouter's side: create the key at `openrouter.ai/keys` **with a credit limit** (optionally resetting daily/weekly/monthly); `GET /api/v1/key` reports `limit` / `limit_remaining`; exhaustion returns **402** with `error.metadata.limit_source` distinguishing key limit vs account credits. Paid models carry no platform request cap (provider 429s are the real limit); free variants carry the RPM/RPD table above. Structured output via `response_format: { type: "json_schema", strict: true }` works with streaming, but per-endpoint strict-mode support varies.

Caveats flagged: canonical models-page prices can exceed the cheapest endpoint price (pin `provider: { sort: "price" }` to always take the cheapest); the `:free` catalog churns; a quality A/B between the sub-$0.0003 options is still owed.

Full findings with pricing and cost tables: [`../research/openrouter-model-cost.md`](../research/openrouter-model-cost.md)
