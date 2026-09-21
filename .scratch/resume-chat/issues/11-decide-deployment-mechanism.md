# Decide deployment mechanism, secrets, and environments

Type: grilling
Status: resolved 2026-09-21
Blocked by: 01

## Question

Decide how deploys happen and how secrets and config are managed, informed by the Cloudflare deployment research (ticket 01):

- Git-integration deploy versus `wrangler deploy` from CI versus manual deploy.
- Where the OpenRouter key and the token list live, and how they are rotated.
- Preview versus production environments, and whether previews are reachable publicly.
- The rollback path.

HITL.

Carried in from *Research Cloudflare deployment path for Next.js App Router*:

- The runtime path (OpenNext + Next 15.5.x versus `vinext` + Next 16) is fixed by *Decide project conventions and repo scaffold shape* — consume that choice here, don't reopen it.
- Workers **Free** allows only 10 ms CPU per request, which can error SSR-heavy pages; decide whether the app targets Free or Paid, and set `limits.cpu_ms` accordingly if Paid.
- Secrets/config ownership is fixed by *Decide project conventions and repo scaffold shape*: **varlock**, not `wrangler secret put`. Resolve the deploy-time flow here (how varlock's Cloudflare integration feeds the deployed Worker, rotation procedure) without reopening the tool choice.

## Answer

Resolved 2026-09-21, grilling round (Q1–Q5), answers relayed through the parent. The human's secret-custody call **supersedes ticket 05's varlock convention** — ticket 05 carries the amendment; nothing else reopens.

- **Secrets: varlock eliminated; the Cloudflare dashboard / `wrangler secret put` owns secret values.** The human judged the varlock machinery (its Cloudflare integration is a `varlock-wrangler` wrapper resolving `.env.schema`+`.env.local` and uploading vars/secrets on every deploy) as more apparatus than a 3-secret app needs, and it would force custody of values into whatever environment runs the deploy. Cutover done 2026-09-21: `varlock` removed from `package.json`, `.env.schema` deleted, the `!.env.schema` gitignore exception removed, lockfile refreshed. What remains: `OPENROUTER_API_KEY` (prod, $10-capped), the dev `:free` key, `TOKEN_LIST` (ticket 10's JSON digest list), and the session HMAC key — all Worker secrets, set once via dashboard or `npx wrangler secret put`, never in the repo. Local dev uses a standard gitignored `.env.local` (Next.js reads it natively). Non-secrets (e.g. the model slug) go in `vars`. **Rotation = `wrangler secret put <KEY>` or a dashboard edit — takes effect without a code redeploy.**
- **Consequence for tickets 09/10 (recorded here, not reopened):** wherever they say "stored in varlock," read "stored as a Worker secret" — the custody intent (server-side only, never in the browser bundle) is unchanged. Ticket 10's token procedure gets simpler: revoke = drop the entry, then one `npx wrangler secret put TOKEN_LIST`; no redeploy, so revocation stays "minutes" per ticket 10's bound. The `npm run token:add` helper edits the local list copy and the same `wrangler secret put` publishes it.
    - **Deploy mechanism: Cloudflare Workers Builds (git-integration, push-to-deploy)** — chosen over local manual deploys and GitHub Actions. Dashboard-only setup (nothing of it lives in the repo): connect the GitHub repo; **build command `npx opennextjs-cloudflare build`** and **deploy command `npx opennextjs-cloudflare deploy`** — correction from ticket 13's first deploy: `deploy` does NOT build, Workers Builds needs both commands set (this ticket originally recorded deploy-only). Because secrets are dashboard-managed, the build environment never holds any secret value.
- **Plan: Workers Free, deliberately light SSR.** Do **not** set `limits.cpu_ms` (the Free cap is 10 ms and cannot be raised). Recorded constraint: keep the landing page prerendered/static and keep rendering work off the request path; the chat route handler spends its time awaiting OpenRouter, which does not count against CPU (research 01). Escape hatch if Error 1102 ever appears: upgrade to Workers Paid (~$5/mo) — a future act, not now. Ticket 10's carried empirical check (is the `ratelimit` binding available on Free?) stays live, D1 fallback unchanged.
- **Environments: none.** `workers_dev: false` — no preview env, no reachable `*.workers.dev` URL; production is the Workers Custom Domain on `clint.broadhead.dev` (ticket 13 wires it, including the documented delete-the-AAAA-record-then-attach migration). Pre-deploy testing happens locally via `wrangler dev`/miniflare.
- **Rollback: `npx wrangler rollback`** to the previous deployment — instant, built-in. Nuance accepted: rollback reverts code only; dashboard-managed secrets persist across rollbacks, which is now simpler than a varlock deploy (no vars/secrets replaced on deploys at all).
- **Config sketch committed:** `wrangler.jsonc` at the repo root carrying the decided fields (`workers_dev: false`, no `limits`, compatibility date + `nodejs_compat`) and the binding shapes tickets 10/14 will need as commented blocks (D1 `DB`, Vectorize `RESUME_VECTORS` + AI `AI`, ratelimit `RATE_LIMITER`) to fill when the resources are created; binding names are provisional until then.
