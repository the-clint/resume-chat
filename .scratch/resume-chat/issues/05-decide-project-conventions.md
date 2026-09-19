# Decide project conventions and repo scaffold shape

Type: grilling
Status: open
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
