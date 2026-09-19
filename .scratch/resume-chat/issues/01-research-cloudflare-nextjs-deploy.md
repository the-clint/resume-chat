# Research Cloudflare deployment path for Next.js App Router

Type: research
Status: resolved
Blocked by: (none)

## Question

What is the current, primary-source-supported way to deploy a Next.js 15+ App Router app with server-side API routes to Cloudflare, and what does it require? Establish, each with a citation to the page that owns the fact:

- The supported adapter(s) for Next.js on Cloudflare as of now (e.g. `@opennextjs/cloudflare` vs the older `next-on-pages` / Pages route) and their current support status; whether the destination is Workers or Pages.
- Whether App Router route handlers and Node.js runtime APIs work, and on which runtime.
- How environment variables and secrets are configured for the deployed app.
- How a custom hostname is attached (Workers custom domain vs route vs Pages custom domain). Note: `clint.broadhead.dev` already resolves to Cloudflare edge and returns HTTP 530, so the zone and proxied record already exist.
- Runtime limits that could bite: Worker CPU ms, subrequest count, response streaming, bundle size.
- Whether `npm` is sufficient (the only package manager installed here: node v24.18.0, npm 11.16.0).

Deliverable: a findings file at `.scratch/resume-chat/research/cloudflare-nextjs-deploy.md`, every claim cited to its primary source.

## Answer

Deploy to **Cloudflare Workers via `@opennextjs/cloudflare`** (v1.20.x; peers `next >=15.5.24 <16 || >=16.3.3`, `wrangler ^4.125.0`). `@cloudflare/next-on-pages` is deprecated and Cloudflare's Pages docs now steer new projects to Workers. Route handlers run on the Next.js **Node.js runtime** with `nodejs_compat` and a compatibility date ≥ `2024-09-23` — never `export const runtime = "edge"`. Secrets via `wrangler secret put`, read as `process.env` (or `getCloudflareContext().env`); non-secrets in `vars`; `.dev.vars` locally. Attach `clint.broadhead.dev` as a **Workers Custom Domain** (`routes: [{ pattern, custom_domain: true }]`), which requires **deleting the existing proxied AAAA record first** (the documented delete-then-attach migration). Streaming is unconstrained (no HTTP duration limit, no response body limit); CPU is 10 ms/request on Free vs 30 s default / 5 min cap on Paid, tight for SSR-heavy pages; subrequests 50 Free / 10,000 Paid; bundle 64 MiB uncompressed. `npm` alone is sufficient.

Flagged: Cloudflare's framework guide (updated 2026-08-25) headlines **vinext** (beta, Next.js 16) as its default recommendation while OpenNext remains the stable documented path for Next 15. That is a real branch and is carried into *Decide project conventions and repo scaffold shape*.

Full findings with sources: [`../research/cloudflare-nextjs-deploy.md`](../research/cloudflare-nextjs-deploy.md)
