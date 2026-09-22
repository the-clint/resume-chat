This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

Deployed to Cloudflare Workers via OpenNext, live at `https://clint.broadhead.dev`.
Ongoing deploys are git-integrated (Workers Builds); ad-hoc deploys:

```bash
npm run deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Secrets (including `TOKEN_LIST`, see Operations) live as Worker secrets, managed
in the dashboard or via `npx wrangler secret put`. Rollback: `npx wrangler rollback`.

## Operations

### `TOKEN_LIST` — format

`TOKEN_LIST` is a single Worker secret holding a JSON array of one entry per
person. **Digest-only**: raw tokens never appear in the repo, the secret, or any
file — only their SHA-256 digests.

```json
[{ "id": "alice-example", "name": "Alice Example", "sha256": "<64 hex chars>" }]
```

- `id` — slug of the person's name (unique; used in the session cookie and the
  usage counter; keep stable per person).
- `name` — display name.
- `sha256` — hex SHA-256 of the **full raw token including the `rchat_` prefix**.

```bash
# 1. Generate one entry. Prints the JSON entry on stdout AND the raw token on stderr.
npm run token:add "Alice Example"

# 2. Append the printed entry to token-list.json (gitignored local copy, starts as []).
#    Keep ids unique; one entry per person; old digests stay until that token is revoked.

# 3. Publish the list.
npx wrangler secret put TOKEN_LIST < token-list.json

# 4. Confirm it landed, then share the RAW token out of band (chat/Signal — a link
#    in the pasted token is the pity you'll have tomorrow).
npx wrangler secret list
```

The gate IS live (ticket 10): `POST /api/login` verifies the token against the
list and sets the session cookie; every gated request re-checks the session
against the current list.

### Rotating / revoking

Both are: edit `token-list.json`, `npx wrangler secret put TOKEN_LIST < token-list.json`.

- **Revoke** = remove the person's entry (or just their digest). Takes effect at
  their next request via the per-request list re-check — no redeploy, minutes not
  seconds (ticket 10/11).
- **Rotate** = replace their digest with a fresh one (re-run the generate step,
  share the new raw token first). The old token dies the moment the secret lands.
  Use this when a token leaks.

Local dev secrets live in `.dev.vars` (gitignored): `TOKEN_LIST` (a JSON string,
same format), `SESSION_HMAC_KEY`, and `OPENROUTER_API_KEY` (a dev key — without
it `/api/chat` fails at the LLM call). `OPENROUTER_MODEL` is a plain var in
`wrangler.jsonc`; point it at a `:free` slug locally.

### Token gate, session, and limits (ticket 10)

- **Login** — `POST /api/login { token }`. Digest-compares the token against
  `TOKEN_LIST`; on match sets a stateless signed cookie, on miss returns the
  same 401 for every failure (nothing leaks about the list). No rate limit on
  login: a 128-bit token space makes brute force impractical.
- **Session** — cookie `rchat_session` = `<token-id>.<expiry>.<hmac>`,
  HMAC-SHA256 with `SESSION_HMAC_KEY`, `HttpOnly; Secure; SameSite=Lax; Path=/`,
  fixed 7-day maxAge. Every gated request re-verifies the signature+expiry
  **and re-checks the token id against the current list** — revocation kills the
  existing cookie at the holder's next request, with zero extra storage.
- **Limits** (each trip returns a distinct message to the user):
  - Minute: Workers `ratelimit` binding, 10 requests / 60 s, keyed by token id.
  - Daily: 30 turns/token/day (D1 `usage` table, UTC day key).
  - Monthly: 100 turns/token/month, resets on the 1st (same table).
  - D1 errors fail **closed** — the counter exists to protect the bill.
- **Counter storage** — D1 database `resume-chat` (`DB` binding), table
  `usage(token_id, day, month, day_count, month_count)`, one row per token, one
  UPSERT per turn. Schema lives in `migrations/`; after editing it:

  ```bash
  npx wrangler d1 migrations apply resume-chat --local   # dev
  npx wrangler d1 migrations apply resume-chat --remote  # prod
  ```

  To see usage: `npx wrangler d1 execute resume-chat --remote --command "SELECT * FROM usage"`.

### Chat (the app itself)

`/` is the whole app. The server renders the token screen or the chat from the
session cookie (`app/page.tsx`, `force-dynamic` — the gate state is never cached);
`app/chat-app.tsx` owns the two screens, `app/token-screen.tsx` posts to
`/api/login`, and `app/chat-screen.tsx` streams from `POST /api/chat`.

`POST /api/chat { messages: [{ role, content }] }` runs the gate, retrieves on the
last message only, and streams OpenRouter's SSE back as `data:` frames of
`{ type: "delta" | "error" | "done", ... }` (`lib/chat-stream.ts` handles the
keep-alive comments and the trailing usage chunk). The last 6 turns, the grounding
rules, and the excerpt labels are built in `lib/prompt.ts`.

Gated routes run the gate in order: session re-check → minute limiter → usage
counter (`lib/gate.ts`). The UI maps the API's `daily_limit` / `monthly_limit` /
`minute_limit` / `unauthorised` codes to its own messages — the token screen for
`unauthorised` (expired or revoked mid-session), and an amber notice for each limit.

### Retrieval pipeline

```bash
npm run embed:resume   # re-chunks content/resume.md, re-embeds, replaces the Vectorize index
```

Each vector's metadata carries the chunk text (`section`/`company`/`dates`/
`skills[]` alongside `text`), so a query returns the grounding text the chat
prompt injects — the deployed app never reads `content/resume.md`.

Refreshing the corpus = edit `content/resume.md`, run the script. Vectorize
mutations propagate async (~1–2 min) before queries see them.
