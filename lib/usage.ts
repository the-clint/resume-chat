// Per-token usage counter (tickets 09 + 10): D1 table `usage`, one row per
// token holding the current UTC day/month and both counts. Each turn is a
// single INSERT … ON CONFLICT DO UPDATE … RETURNING; day_count resets when the
// UTC day changes, month_count when the month changes (ticket 09: reset on the
// 1st). Limits: 30 turns/day, 100 turns/month — the turn count is the enforcing
// unit (max_tokens already bounds output; no output-token counter, ticket 10).
// Fail closed: a D1 error propagates — the counter exists to protect the bill,
// so an uncounted turn must never through.

export const DAILY_TURN_LIMIT = 30;
export const MONTHLY_TURN_LIMIT = 100;

export type LimitReason = "daily" | "monthly";

export interface D1Database {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      first: <T>() => Promise<T | null>;
    };
  };
}

/** UTC calendar keys for the counters' reset boundaries (never local time). */
export function utcPeriodKeys(now: Date): { day: string; month: string } {
  const iso = now.toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

/**
 * Counts one turn for the token and reports the first cap tripped, or null.
 * Throws on any D1 failure (fail closed) or if the UPSERT returns no row.
 */
export async function consumeTurn(
  db: D1Database,
  tokenId: string,
  now: Date = new Date(),
): Promise<LimitReason | null> {
  const { day, month } = utcPeriodKeys(now);
  const row = await db
    .prepare(
      `INSERT INTO usage (token_id, day, month, day_count, month_count)
       VALUES (?1, ?2, ?3, 1, 1)
       ON CONFLICT (token_id) DO UPDATE SET
         day = ?2,
         month = ?3,
         day_count = CASE WHEN usage.day = ?2 THEN usage.day_count + 1 ELSE 1 END,
         month_count = CASE WHEN usage.month = ?3 THEN usage.month_count + 1 ELSE 1 END
       RETURNING day_count, month_count`,
    )
    .bind(tokenId, day, month)
    .first<{ day_count: number; month_count: number }>();
  if (!row) throw new Error("usage counter UPSERT returned no row");

  // Monthly first: if both caps trip, the monthly message is the informative one.
  if (row.month_count > MONTHLY_TURN_LIMIT) return "monthly";
  if (row.day_count > DAILY_TURN_LIMIT) return "daily";
  return null;
}
