# Build the real token screen, chat UI, and streaming endpoint

Type: task
Status: resolved 2026-09-22
Blocked by: 10, 12, 14

## Question

Ticket 13's answer recorded the gap plainly: `/` still served the scaffold
boilerplate (the create-next-app landing page) and the only chat UI was ticket
12's throwaway prototype at `/proto`. Build the real thing, to ticket 12's verdict
and tickets 07/08/09/10's decisions:

- The token screen at `/`, posting to `POST /api/login` and rendering into chat on
  success (no client-side auth probe — the server reads the cookie first).
- The chat screen (message layout, 4s rotating examples that pause on hover and
  fill the input, loading dots, streaming cursor, error bubble with Retry/Dismiss).
- The streaming LLM endpoint: gate → retrieval → OpenRouter SSE → browser, with the
  distinct limit messages the API codes already promised.
- Delete the throwaway prototype and the template landing page it replaced.

## Answer

Built 2026-09-22. `/` is now the app.

**Gap found and closed:** `retrieveResumeContext` returned only `id`/`score`/
`section`/`company`/`dates`/`skills` — the index metadata carried no chunk text, so
there was nothing to ground an answer on (ticket 14 shipped the retrieval path, not
its consumer). The Embed script now writes `text` into each vector's metadata,
`RetrievedChunk` carries it, and the live index was re-embedded
(`npm run embed:resume`, 9 chunks; verified querying the real index through
`lib/retrieval.ts`). Metadata stays ~1.3 KiB per vector, well under the ~10 KiB
per-vector limit, and ticket 07's rule holds — the deployed app never reads
`content/resume.md`.

**What landed:**

- `app/page.tsx` — server component, `force-dynamic`: `resolveSession` (new seam in
  `lib/auth.ts`, shared with `verifySessionRequest`) decides token screen vs chat, so
  no flash of the wrong screen and no client auth state to drift.
- `app/token-screen.tsx` / `app/chat-screen.tsx` / `app/chat-app.tsx` — the two
  screens; `session ended or revoked` (401 mid-session) drops back to the token
  screen with the reason. Limit codes map to an amber notice: minute retryable,
  daily and monthly not.
- `app/api/chat/route.ts` — gate first (session → minute → usage), then retrieval on
  the latest message only, then OpenRouter with `stream: true`, `max_tokens: 1000`
  (ticket 09). The answer streams back as `data: {ChatStreamEvent}` frames; limit
  refusals stay pre-stream JSON. Client disconnect aborts the upstream request.
- `lib/prompt.ts` — ticket 08's rules (refuse topical / allow social, grounding-only,
  loose inline section citations, best-effort injection refusal) plus last-6-turn
  history (12 messages, `MAX_HISTORY_TURNS`).
- `lib/chat-stream.ts` — isomorphic SSE splitter (buffers partial lines, skips
  `: OPENROUTER PROCESSING` comments) plus the OpenRouter payload decoder, including
  the non-standard trailing usage chunk (research 02 §3).
- Deleted: `app/proto/`, the five template SVGs, the scaffold metadata.

**Verified** (stubbed upstream — no `OPENROUTER_API_KEY` exists locally):
wrong token → the accepted copy; correct token → chat; three streamed turns with
partial text growing delta by delta; the system prompt reaching upstream carried the
retrieved chunks (3,669 chars vs 1,356 for the rules alone); minute limiter (13
parallel requests → 429 `minute_limit`) and its amber retryable notice; monthly
limiter (`monthly_limit`, from the dev DB's prior count) with its distinct copy;
revoked session → back to the token screen; upstream down → the generic bubble, and
Retry re-ran the turn from the last question; server-rendered `/` returned the token
screen with no cookie or a forged signature and the chat with a valid one.

**Verified on prod** (deployed `f14d8842`, real OpenRouter key): `/` serves the token
screen (200), `/proto` and the template SVGs are 404, bogus login 401, unauthenticated
`/api/chat` 401 `unauthorised`, and a token-holder turn streamed a grounded answer
end to end.

That prod turn caught two prompt violations, both fixed and re-verified with the same
question: the model invented a duration ("August 2012 until April 2021 — roughly eight
years and eight months" — the resume's Elwood/SOS run is May 2007 → present, 14+
years) and appended a `(Sources: sections [1], [2], [3])` footnote. `lib/prompt.ts`
now forbids computing or summing spans ("quote dates exactly as the excerpts write
them") and forbids source lists/footnotes outright; the rerun quoted its dates without
a total, an off-resume question (Rust/Kubernetes) was declined instead of answered
from general knowledge, and a greeting got a social reply. Whether a deterministic
retrieval-score gate is still needed stays ticket 08's carried post-launch question.

**Carried:** local dev needs `OPENROUTER_API_KEY` in `.dev.vars` plus a `:free`
`OPENROUTER_MODEL` (prod has the key as a Worker secret; no dev key exists on this
machine, so the local run stubbed the upstream hop). Prod's `SESSION_HMAC_KEY` was
**missing** and was set during this ticket — without it `/api/login` 401s every token,
so nobody could have logged in. Ticket 11's "keep the landing page prerendered" note
no longer holds for `/` — the gate must render per request — which costs an HMAC
verify, not a rendering pass.
