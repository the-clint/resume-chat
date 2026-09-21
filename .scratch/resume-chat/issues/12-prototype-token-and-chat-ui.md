# Prototype the token screen, chat UI, and rotating examples

Type: prototype
Status: resolved
Blocked by: 06

## Question

Prototype the two screens the user described, as a throwaway route in the scaffolded Next.js app, so there is something concrete to react to before building it for real:

- Screen one: the token prompt — what it looks like, what it says about why a token is needed, and what a wrong token shows.
- Screen two: the chat — message layout, the input, and the rotating list of example questions sitting above the input.
- The rotating examples' behaviour: static shuffle on load, or timed rotation? Do they fill the input when clicked?
- Empty, loading, streaming, and error states.

HITL. Link the prototype as an asset from this ticket; capture the verdict (what to keep, what to drop) as the answer.

## Answer

Built 2026-09-21: throwaway route `app/proto/page.tsx` (client component, fake data + simulated streaming, no real gate or LLM). Verdict captured with the human via parent agent (2026-09-21):

- **Overall prototype: KEEP** — token screen copy (cost-per-turn framing, "protecting Clint's bill, not keeping people out") and chat layout accepted as direction. Nothing to drop.
- **Rotation: KEEP timed rotation** — 4-second interval, pauses on hover; static shuffle rejected.
- **Example click: KEEP fill-input** — clicking a question fills the input rather than sending immediately.

Wrong-token error copy and the empty/loading/streaming/error states (loading dots, streaming cursor, error bubble with Retry/Dismiss) were all shown and kept. Prototype assets: route at `/proto` (dev server `npm run dev -- --port 3100`; demo token is `demo`, any other input shows the wrong-token state; a state-jump panel on the chat screen reaches each state). The route is throwaway and gets deleted or replaced when the real token gate and chat land (tickets 13/14 scope, not this one).
