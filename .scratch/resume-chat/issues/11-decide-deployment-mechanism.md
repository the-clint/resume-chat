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
- Anything Cloudflare's runtime limits force (streaming, cold starts, bundle size) — cross-check against ticket 01's findings.

HITL.
