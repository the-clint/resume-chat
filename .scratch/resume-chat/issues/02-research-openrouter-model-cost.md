# Research OpenRouter model and cost envelope for resume Q&A

Type: research
Status: open
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
