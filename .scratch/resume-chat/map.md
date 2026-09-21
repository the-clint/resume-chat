# Map: resume-chat

Canonical wayfinder map for this effort. Tickets are child files in `issues/`; the map is an index and never restates a ticket's detail.

## Destination

A publicly reachable RAG chat app at `https://clint.broadhead.dev`, built with Next.js (App Router, TypeScript) and hosted on Cloudflare, that answers only questions about Clint's resume using OpenRouter, behind a manually issued per-person access token. Done = the app is live at that URL, a token-holder can chat and get answers grounded in the resume, and nobody can run up the OpenRouter bill without a token that was handed to them.

## Notes

- **Execution-carrying effort.** Wayfinder defaults to planning only; this map overrides that (destination is a built, deployed app). Tickets of type `task` are in scope where they unblock a decision or sit on the build path directly.
- **Tracker:** local markdown. Map `.scratch/resume-chat/map.md`, tickets `.scratch/resume-chat/issues/NN-<slug>.md`. Blocking via `Blocked by: NN, NN`; frontier = open, unblocked, unclaimed, lowest number first.
- **Research assets** live as files under `.scratch/resume-chat/research/`. Deviation from the skill's throwaway-branch convention: no git remote exists yet, and four parallel branch-per-agent checkouts would thrash one shared working tree.
- **Fixed by the human:** stack = Next.js App Router + TypeScript. Hosting = Cloudflare. Access = a short list of per-person tokens entered before chat. Domain = `clint.broadhead.dev`. Secrets/config = varlock (added 2026-09-20 during ticket 05).
- **Environment facts (probed 2026-09-19):** `clint.broadhead.dev` and `broadhead.dev` both resolve to Cloudflare edge IPs (`2606:4700:…`); `https://clint.broadhead.dev` returns **HTTP 530** (proxied hostname, no reachable origin) — the DNS record/zone already exists. Available tooling: `node v24.18.0`, `npm 11.16.0`; `pnpm` and `bun` are not installed.
- **Standing preference:** beginner-portfolio posture — prefer boring, well-documented choices a junior developer can defend in an interview; no dependency that isn't pulling its weight.
- **Skills to consult:** `grilling` for HITL decision tickets; `research` for AFK tickets; `prototype` for UI tickets.

## Decisions so far

- [Research Cloudflare deployment path for Next.js App Router](issues/01-research-cloudflare-nextjs-deploy.md): Cloudflare Workers via `@opennextjs/cloudflare` (Next 15.5.x, `nodejs_compat`); `next-on-pages` deprecated; secrets via `wrangler secret put`; attach `clint.broadhead.dev` as a Workers Custom Domain **after deleting the existing AAAA record**; streaming unconstrained, Free CPU 10 ms/request.
- [Decide project conventions and repo scaffold shape](issues/05-decide-project-conventions.md): OpenNext + Next 15.5.x, npm, Tailwind v4, flat `app/`+`lib/`+`content/resume.md` layout, TS strict + ESLint flat + Prettier, public GitHub remote now, and varlock (not wrangler secrets) owns env/secret management.
- [Research OpenRouter model and cost envelope for resume Q&A](issues/02-research-openrouter-model-cost.md): ~$0.000125 per turn on `openai/gpt-oss-20b` ($10 ≈ 80k turns); SSE streaming with `: OPENROUTER PROCESSING` keep-alives and a non-standard usage chunk; per-key credit limits reported by `GET /api/v1/key`, exhaustion = 402 + `limit_source`; `:free` variants 20 RPM / 50 RPD under $10 lifetime credits.
- [Research retrieval strategy for a single-document RAG](issues/03-research-single-doc-retrieval.md): stuffing would match answer quality at this corpus size, but real retrieval is the defensible choice because the pipeline is what the portfolio proves — Workers AI `@cf/baai/bge-m3` embeddings into Vectorize, chunked by resume section; free tier covers ~100% of it.
- [Research Cloudflare-native token gating and rate limiting](issues/04-research-cloudflare-token-gating.md): digest-compare the token against a Worker secret, set an HMAC-signed `httpOnly` cookie (7 days), then `ratelimit` binding for bursts plus a **D1 daily counter** as the hard spend ceiling — $0 on Workers Free. KV unfit; zone WAF is IP-only and cannot key on the token.
- [Scaffold the Next.js app repo](issues/06-task-scaffold-nextjs-repo.md): Next 15.5.25 + React 19.1.0 + Tailwind v4 + Prettier + varlock schema, lint/build/dev all verified; `origin` staged, only the empty GitHub repo + first push remain (one-step HITL checklist in the ticket).

## Not yet specified

- How updates to the resume propagate through the deployed app (re-embed? redeploy? no-op?) — hangs on the retrieval-architecture decision (ticket 07).
- Whether chat needs multi-turn memory ("and where did he work before that?") — hangs on ticket 07 and the grounding posture (ticket 08).
- What visibility exists into abuse or cost overrun after launch — hangs on the token design (ticket 10) and deployment mechanism (ticket 11).
- How the project is presented publicly once live (README, demo link, resume bullet) — hangs on the app existing (tickets 06, 13).

## Out of scope

- Any corpus beyond the single resume: extra documents, an ingestion pipeline, admin upload flow.
- Self-serve signup, user accounts, or an admin UI for issuing tokens — tokens are generated by hand.
- Persisted conversation history across sessions or accounts.
- Fine-tuning, agentic tool use, or multi-step reasoning agents.
- Non-web clients: mobile app, CLI, or a public API for third parties.
