# Scaffold the Next.js app repo

Type: task
Status: resolved
Assigned: clint (claimed 2026-09-20)
Blocked by: 05 (resolved)

## Question

Work, not a decision: initialize the repo and create the Next.js App Router + TypeScript skeleton exactly as the conventions ticket settled, commit it, and confirm the dev server serves a page locally.

Records on resolution: exact dependency versions, the scripts defined, how to run it locally, and the remote (if ticket 05 chose one).

## Answer

Done 2026-09-20 (commit `Scaffold Next.js 15.5 App Router app with Tailwind v4, Prettier, varlock (ticket 06)`). Scaffolded with `create-next-app@15.5` into a temp dir and moved in (the pre-existing `.scratch/` would have blocked CNA at the root).

**Dependencies (exact):** `next@15.5.25` (inside ticket 05's peer range `>=15.5.24 <16`), `react@19.1.0`, `react-dom@19.1.0`, `tailwindcss@^4` (v4 via `@tailwindcss/postcss`), `typescript@^5` with `strict: true` (CNA default), `eslint@^9` flat config (CNA default + `eslint-config-prettier` appended last), `prettier`, `varlock`. Package manager: npm.

**Scripts:** `dev` (`next dev --turbopack`), `build` (`next build --turbopack`), `start`, `lint` (`eslint`), `format` / `format:check` (`prettier`). CNA defaults otherwise; no route groups, no `src/`, import alias `@/*`.

**Layout:** CNA defaults (`app/`, `public/`) plus `.prettierrc`, `.prettierignore`, `.env.schema` (varlock, committed; example item removed — env items get added as later tickets need them, first will be the OpenRouter key). `lib/` and `content/` will materialize with the tickets that create those files — empty dirs aren't committable.

**Verified:** `npm run lint` clean, `npm run build` succeeds (static `/` route), dev server serves `HTTP 200` at `localhost:3000`. Run locally: `npm install && npm run dev`.

**Remote:** `origin` is set to `git@github.com:the-clint/resume-chat.git` (SSH auth confirmed working as `the-clint`). No `gh` CLI and no API token on this machine, so the repo itself must be created by hand — the one HITL step left:

1. Create an **empty public** repo named `resume-chat` under `the-clint` on github.com (no README/license — local commits exist).
2. `git push -u origin main` from the repo root.

**Boundary honored:** no OpenNext/`@opennextjs/cloudflare` wiring, no `wrangler` config, and no varlock Next/Cloudflare integration were added — that deploy-time machinery belongs to *Decide deployment mechanism, secrets, and environments*.
