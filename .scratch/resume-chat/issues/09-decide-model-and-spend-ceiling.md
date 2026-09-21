# Decide model, streaming, and spend ceiling

Type: grilling
Status: resolved 2026-09-21
Blocked by: 02

## Question

Decide the model and money posture, informed by the OpenRouter research (ticket 02):

- Which model(s), and whether a cheaper model handles the bulk of questions.
- Whether responses stream to the browser.
- Per-request max output tokens.
- The hard spend ceiling (per token, per month) and what the user sees when it is hit.
- Where the OpenRouter key lives, which account, and what limits are configured on OpenRouter's side as a backstop.

Note (from ticket 08, resolved 2026-09-21): the prompt's *behavior* is fixed — refuse-topical/allow-social, inline section citations, prompt-only grounding guard, last-6-turn history, best-effort injection refusal. This ticket picks the model and streaming that the prompt wording must fit; the wording itself is written during implementation.
HITL.

## Answer

Resolved 2026-09-21, grilling round (Q1–Q8); all recommendations accepted except one amendment on the monthly cap.

- **Model: single `openai/gpt-oss-20b` for all traffic** (~$0.000125/turn at 2,000 in / 500 out). No cheap-model tiering — cost is trivial, tiering only adds routing code and a second prompt behavior to test. The slug lives behind an env var so a swap is a one-line change; if dev dogfooding shows weak answers, swap freely, no A/B ceremony.
- **Dev runs a `:free` variant** (whatever the churning catalog offers, e.g. `deepseek/deepseek-v4-flash-0731:free`), selected by the same env var; prod pins the paid slug. Separate dev key so dev can never spend prod's balance.
- **Streaming: yes**, SSE to the browser. Parser must skip `: OPENROUTER PROCESSING` keep-alive comments and handle the non-standard final usage chunk (research 02, §3).
- **`max_tokens`: 1,000** output tokens per request (realistic answers ~500; the cap is the strongest user-proof cost bound).
- **Spend ceiling, two layers:**
  1. App-level per-token **monthly cap: 100 turns** (user amendment from the recommended 1,000; worst case ~$0.013/token/month). Counted in the same D1 table ticket 10 introduces — one extra column, resets on the 1st; enforcement mechanics belong to ticket 10. On hit, a distinct friendly message ("You've reached this month's question limit — check back on the 1st"), not the generic error bubble.
  2. OpenRouter prod key with a **$10 credit limit, no reset** — a fire escape, not a budget (~80,000 turns at current prices). A 402 from OpenRouter maps to the generic "temporarily unavailable" bubble: it means Clint acts, not the user.
- **Key custody: Clint's personal OpenRouter account, two keys** (prod capped as above; dev limited to `:free` models — nothing to spend). Both stored in varlock (ticket 05), server-side only, never shipped to the browser.
- Ticket 10's territory untouched (minute/daily rate mechanics, session cookie, revocation); noted there that its D1 table carries the monthly column.
