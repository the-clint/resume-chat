# Research Cloudflare deployment path for Next.js App Router

Type: research
Status: open
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
