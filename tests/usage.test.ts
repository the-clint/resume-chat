// Tests for lib/usage.ts — the D1 per-token turn counter: one row per token
// carrying the current day/month and both counts, one UPSERT per turn.
// The D1Database is faked at the prepare/bind/first seam; the real UPSERT is
// verified against local D1 in the smoke run.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DAILY_TURN_LIMIT,
  MONTHLY_TURN_LIMIT,
  consumeTurn,
  utcPeriodKeys,
} from "@/lib/usage";
import type { D1Database } from "@/lib/usage";

/** Minimal fake of the D1 seam consumeTurn uses. */
function fakeDb(first: () => Promise<unknown>): D1Database {
  return {
    prepare: () => ({
      bind: () => ({ first }),
    }),
  } as unknown as D1Database;
}

test("utcPeriodKeys splits a date into UTC day and month keys", () => {
  assert.deepEqual(utcPeriodKeys(new Date("2026-09-21T00:30:00Z")), {
    day: "2026-09-21",
    month: "2026-09",
  });
  // Month and year rollover, UTC (not local) based.
  assert.deepEqual(utcPeriodKeys(new Date("2027-01-01T00:00:00Z")), {
    day: "2027-01-01",
    month: "2027-01",
  });
  assert.deepEqual(
    utcPeriodKeys(new Date("2026-12-31T23:59:59Z")).month,
    "2026-12",
  );
});

test("consumeTurn returns null while under both limits", async () => {
  const db = fakeDb(() => Promise.resolve({ day_count: 1, month_count: 1 }));
  assert.equal(await consumeTurn(db, "alice"), null);
});

test("consumeTurn returns 'daily' past the daily limit", async () => {
  const db = fakeDb(() =>
    Promise.resolve({ day_count: DAILY_TURN_LIMIT + 1, month_count: 3 }),
  );
  assert.equal(await consumeTurn(db, "alice"), "daily");
});

test("consumeTurn returns 'monthly' past the monthly limit, taking precedence", async () => {
  const db = fakeDb(() =>
    Promise.resolve({ day_count: 1, month_count: MONTHLY_TURN_LIMIT + 1 }),
  );
  assert.equal(await consumeTurn(db, "alice"), "monthly");

  const both = fakeDb(() =>
    Promise.resolve({
      day_count: DAILY_TURN_LIMIT + 1,
      month_count: MONTHLY_TURN_LIMIT + 1,
    }),
  );
  assert.equal(await consumeTurn(both, "alice"), "monthly");
});

test("consumeTurn fails closed when D1 errors or returns no row", async () => {
  const boom = fakeDb(() => Promise.reject(new Error("D1 unavailable")));
  await assert.rejects(consumeTurn(boom, "alice"));

  const noRow = fakeDb(() => Promise.resolve(null));
  await assert.rejects(consumeTurn(noRow, "alice"));
});
