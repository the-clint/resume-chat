# Decide deployment mechanism, secrets, and environments

Type: grilling
Status: open
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
