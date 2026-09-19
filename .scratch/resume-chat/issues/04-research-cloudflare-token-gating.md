# Research Cloudflare-native token gating and rate limiting

Type: research
Status: resolved
Blocked by: (none)

## Question

What do Cloudflare and the Next.js-on-Cloudflare stack offer to (a) verify a user-supplied access token server-side, (b) keep a session after entry, and (c) enforce per-token request/usage limits cheaply? Establish, each cited to primary docs:

- Workers KV, D1, and Durable Objects: current capabilities, pricing, and free-tier limits for the small counters a per-token rate limit needs.
- Whether the Workers rate-limiting binding is usable from the OpenNext/Workers runtime.
- How cookies and sessions work in a Next.js App Router route handler running on Workers (signed cookies, `httpOnly`, lifetime).
- Whether Cloudflare WAF or zone-level rate-limiting rules can protect the chat endpoint without app code, and their plan requirements.
- The minimum-complexity design that still survives a hostile user, with the failure mode of each option (e.g. KV eventual consistency letting a burst through).

Deliverable: a findings file at `.scratch/resume-chat/research/cloudflare-token-gating.md`, every claim cited.

## Answer

Minimum-complexity design that holds up:

1. **Verify** in a route handler: keep the token list as a Workers secret, compare **SHA-256 digests** (`crypto.subtle.digest`) rather than raw strings, since Web Crypto has no `timingSafeEqual`. Multiple per-person tokens = one secret holding a JSON list, or a D1 allowlist keyed by token hash.
2. **Session**: on success, set a **stateless HMAC-SHA256-signed `httpOnly` cookie** (`crypto.subtle.sign`, signing key in a secret), value `"<token-id>.<expiry>.<hmac>"`, `{ httpOnly: true, secure: true, sameSite: "lax", maxAge: 7 days }`. `cookies().set()` is legal only in route handlers / server functions. No session store; every chat request re-verifies the HMAC + expiry.
3. **Burst limiter**: the Workers **`ratelimit` binding** (GA since 2025-09-19, free, no billing entry, configured in the wrangler file, reachable via `getCloudflareContext().env`), keyed by token id — the docs' own best practice is keying on a stable user identifier, not IP. Periods only 10 s or 60 s.
4. **Hard ceiling**: a **D1** table (`usage(token_id, day, requests)`, `INSERT … ON CONFLICT DO UPDATE … RETURNING`) — ~1 row read + 1–2 written per chat call, far inside the 5M reads / 100k writes per-day free allowance, and strongly consistent so the ceiling is real against a multi-location attacker.

**$0** on Workers Free at personal scale. Rejected/qualified: **KV is unsuitable** (1 write/sec/key, up to 60 s propagation, 1,000 free writes/day — a burst slips through); **Durable Objects** are the canonical strongly-consistent counter but more machinery than a daily cap needs; **zone-level WAF/rate-limiting rules cannot key on the token** (Free = 1 rate-limit rule, IP-only, path-only, 10 s period; custom rules Free = 5 rules, no regex) so they are a coarse complement.

Failure modes stated: the ratelimit binding is deliberately permissive and **per-location**, so a determined attacker multiplies the limit by PoP count — which is why D1 carries the hard cap; a stateless signed cookie has **no server-side kill switch**, so revocation needs a KV/D1 revocation list if it matters; a stolen cookie works until expiry (irreducible for any personal-token scheme); losing the HMAC secret is total compromise (rotate via `wrangler secret put`).

Caveats flagged for empirical check: no primary doc states the `ratelimit` binding is available on the Workers **Free** plan (no plan restriction stated, but also no confirmation); and the Free-plan field set for WAF custom-rule expressions is unstated.

Full findings with the KV/D1/DO comparison table: [`../research/cloudflare-token-gating.md`](../research/cloudflare-token-gating.md)
