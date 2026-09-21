# Decide project conventions and repo scaffold shape

Type: grilling
Status: resolved
Assigned: clint (claimed 2026-09-20)
Blocked by: (none)

## Question

What conventions does the repo follow, so the scaffold ticket can execute without further taste decisions? Decide:

- **Next.js runtime path**, because it pins the version the scaffold installs: `@opennextjs/cloudflare` with Next 15.5.x (stable, documented) versus Cloudflare's newly-headlined `vinext` with Next 16 (beta, explicit compatibility dashboard). Facts in *Research Cloudflare deployment path for Next.js App Router*.
- Package manager: stay on `npm` (the only one installed here) or install `pnpm`/`bun`?
- Styling: Tailwind, CSS modules, or a component library — and if a component library, which?
- Directory layout for the App Router app (route groups, `lib/`, where the resume data and prompt live).
- TypeScript strictness and linting/formatting setup.
- Whether the repo gets a public remote (e.g. GitHub) now, since it currently has no git remote at all.

HITL: the human owns these taste calls.

## Answer

Decided 2026-09-20 with the human (all six calls theirs):

- **Runtime path:** `@opennextjs/cloudflare` with Next.js 15.5.x (peer range `next >=15.5.24 <16`). `vinext`/Next 16 rejected — explicitly beta; re-evaluate only on a future Next 16 upgrade.
- **Package manager:** npm (only tooling installed; every OpenNext doc flow uses it).
- **Styling:** Tailwind v4. No component library — two screens don't justify one.
- **Layout:** flat — `app/` routes with no route groups; `lib/openrouter.ts`, `lib/auth.ts`, `lib/retrieval.ts`, `lib/prompts.ts`; `content/resume.md` is the committed resume source of truth.
- **TypeScript/tooling:** `strict: true`, ESLint flat config (create-next-app defaults), Prettier.
- **Git remote:** public GitHub now, created during scaffolding. This app is a portfolio piece; it proves skill only if the code is visible. No secrets in the repo — see next item.
- **Secrets/config ownership: varlock** (human's call, overriding the research's wrangler-secrets assumption). Verified feasible 2026-09-20: varlock ships dedicated Next.js and Cloudflare Workers integrations (varlock.dev), giving a committed `.env.schema` (agent-readable, no secret values), validation, leak scanning, and type-safe `ENV` access. Wrangler remains the deploy CLI (unavoidable for Workers), but `wrangler secret put` is no longer the assumed secrets mechanism — the deploy-time secret flow via varlock's Cloudflare integration is resolved in *Decide deployment mechanism, secrets, and environments*.

Consequence: ticket 06 scaffolds exactly this; ticket 11 consumes the varlock choice without reopening it.
