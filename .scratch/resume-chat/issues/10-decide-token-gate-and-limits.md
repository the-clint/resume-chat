# Decide token gate, session, and per-token abuse limits

Type: grilling
Status: open
Blocked by: 04

## Question

Decide the exact access flow, informed by the Cloudflare token-gating research (ticket 04):

- What the token screen submits and how the server validates it against the per-person token list.
- The session artifact set after a valid token (cookie shape, lifetime, signing).
- Per-token limits: requests per minute, requests per day, output tokens per day — and the failure mode when one is exceeded.
- What an unauthorised or revoked token sees.
- The operating procedure for issuing and revoking a token (where the list lives, who edits it, how fast a revocation takes effect).

HITL.
