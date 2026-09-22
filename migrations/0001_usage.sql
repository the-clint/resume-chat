-- Ticket 10: per-token usage counter. One row per token; the UPSERT in
-- lib/usage.ts keeps the current UTC day/month and both counts on the single
-- row, so no pruning job is needed. Apply: npx wrangler d1 migrations apply resume-chat
CREATE TABLE IF NOT EXISTS usage (
  token_id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  day_count INTEGER NOT NULL,
  month_count INTEGER NOT NULL
);
