# Research Cloudflare-native token gating and rate limiting

Type: research
Status: open
Blocked by: (none)

## Question

What do Cloudflare and the Next.js-on-Cloudflare stack offer to (a) verify a user-supplied access token server-side, (b) keep a session after entry, and (c) enforce per-token request/usage limits cheaply? Establish, each cited to primary docs:

- Workers KV, D1, and Durable Objects: current capabilities, pricing, and free-tier limits for the small counters a per-token rate limit needs.
- Whether the Workers rate-limiting binding is usable from the OpenNext/Workers runtime.
- How cookies and sessions work in a Next.js App Router route handler running on Workers (signed cookies, `httpOnly`, lifetime).
- Whether Cloudflare WAF or zone-level rate-limiting rules can protect the chat endpoint without app code, and their plan requirements.
- The minimum-complexity design that still survives a hostile user, with the failure mode of each option (e.g. KV eventual consistency letting a burst through).

Deliverable: a findings file at `.scratch/resume-chat/research/cloudflare-token-gating.md`, every claim cited.
