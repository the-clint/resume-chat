# Attach clint.broadhead.dev to the deployed app

Type: task
Status: resolved 2026-09-21
Blocked by: 11

## Question

Work, not a decision: point `clint.broadhead.dev` at the deployed app and verify HTTPS serves the token screen.

Pre-existing state: the hostname already resolves to Cloudflare edge IPs and returns HTTP 530, so the proxied record exists but has no reachable origin — this ticket replaces or retargets it rather than creating DNS from nothing.

Records on resolution: the record type and target, whether it ended up a Worker custom domain or a route, and the verified live URL.

## Answer

Resolved 2026-09-21. Domain attached as a **Workers Custom Domain** (not a route) on the first deploy; HTTPS verified live.

- **Deleted stale record:** the pre-existing proxied CNAME on `clint.broadhead.dev` (target not captured) was the HTTP 530 / Cloudflare error 1016 (origin DNS failure). Deleted 2026-09-21 by the human in the dashboard after explicit authorization. The wrangler OAuth token has no DNS scope (`GET /dns_records` → 403), so record deletion and inspection stay dashboard-side.
- **Final record:** `routes: [{ "pattern": "clint.broadhead.dev", "custom_domain": true }]` in `wrangler.jsonc` (sibling-agreed, routes area only) — Cloudflare auto-created the proxied DNS record + TLS cert on deploy. Authoritative via `GET /accounts/…/workers/domains`: hostname `clint.broadhead.dev`, zone `broadhead.dev` (4364f8208c56686bac15be3673a45e48, account "Clint@broadhead.me's Account" a36bf49e2df8d7db6785a3b834993714, same account as the Worker), service `resume-chat`, environment `production`. Public answers: A 172.67.219.1/104.21.94.33, AAAA 2606:4700:3037::6815:5e21 / 2606:4700:3035::ac43:db01 (proxied edge IPs; the underlying origin record is dashboard-visible only).
- **Verified live URL: https://clint.broadhead.dev** — HTTP 200 with `x-opennext: 1` (response served by the deployed OpenNext Worker). Token screen verified at **https://clint.broadhead.dev/proto** (HTTP 200). Caveat: `/` still serves the scaffold boilerplate landing — the prototype token screen lives at `/proto` (ticket 12's throwaway route) until the real token gate/chat land (tickets 10/14 scope). No version of the token screen exists at `/` yet; that check was run against `/proto` with the human informed.

## Deploy notes (what made the first deploy possible)

- First deploy was local `npm run deploy`, human-authorized for this ticket (ticket 11's Workers Builds git-integration remains the ongoing deploy path — requires commit+push of the current tree, still uncommitted at ticket close). **Correction to ticket 11's recorded command (decision unchanged):** `npx opennextjs-cloudflare deploy` does **not** build — it deploys a *built* app. Workers Builds should use build command `npx opennextjs-cloudflare build` + deploy command `npx opennextjs-cloudflare deploy`. The repo's `deploy`/`preview` scripts chain the build.
- Repo additions for deployability: `@opennextjs/cloudflare@1.20.6` + `wrangler@4.136.1` devDependencies, `open-next.config.ts` (`defineCloudflareConfig()`, no cache override), `preview`/`deploy` scripts, `.open-next/`, `.wrangler/`, `.dev.vars` gitignored.
- Deploy-time blockers fixed along the way: the account had no workers.dev subdomain (deploy establishes a remote session for the `remote: true` bindings → API error 10063); registered account subdomain `clint-broadhead` via API — account-level onboarding only, no Worker is reachable on `*.workers.dev` (`workers_dev: false` stands). Created the `resume-chunks` Vectorize index (1024 dims, cosine) exactly per ticket 14's wrangler.jsonc comment — its active bindings made the index a deploy prerequisite. Bindings section untouched by this ticket.
- First deploy version b77779e7-a02d-41e0-ae2f-be5237fdc1bb (unreachable, no targets); domain-attach deploy version 334778a7-09b1-4306-9a6b-5c1a77e867be (current). Deployed tree includes ticket 14's `GET/POST /api/retrieval` (live in prod; empty chunks until the embed script populates the index).
