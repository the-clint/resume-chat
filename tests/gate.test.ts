// Tests for lib/gate.ts — the per-request gate ordering enforced before any
// work happens on a gated route (ticket 10): session re-check against the live
// TOKEN_LIST, minute limiter (ratelimit binding), then the D1 usage counter.
// Ordering matters: auth first (no counter state for strangers), minute limiter
// second (protects D1 from bursts), usage counter last (its write IS the count).

import assert from "node:assert/strict";
import { test } from "node:test";

import { gateRequest } from "@/lib/gate";
import { signSession } from "@/lib/auth";
function makeDb(dayCount: number, monthCount: number) {
  return {
    prepare: () => ({
      bind: () => ({
        first: () =>
          Promise.resolve({ day_count: dayCount, month_count: monthCount }),
      }),
    }),
  } as never;
}

const BASE = 2_000_000_000_000;

async function cookie(id = "alice", key = "k") {
  const { value } = await signSession(id, key, BASE);
  return value;
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    TOKEN_LIST: JSON.stringify([
      { id: "alice", name: "Alice", sha256: "a".repeat(64) },
    ]),
    SESSION_HMAC_KEY: "k",
    RATE_LIMITER: { limit: () => Promise.resolve({ success: true }) },
    DB: makeDb(1, 1),
    ...overrides,
  } as never;
}

test("gateRequest passes with valid session, limiter, and counters", async () => {
  const request = new Request("https://x.example/api/retrieval", {
    headers: { Cookie: `rchat_session=${await cookie()}` },
  });
  const result = await gateRequest(request, makeEnv());
  assert.deepEqual(result, { ok: true, tokenId: "alice" });
});

test("gateRequest rejects unauthenticated requests first, without touching limits", async () => {
  const request = new Request("https://x.example/api/retrieval");
  let limiterCalls = 0;
  const env = makeEnv({
    RATE_LIMITER: {
      limit: () => (limiterCalls++, Promise.resolve({ success: true })),
    },
    DB: makeDb(999, 999),
  });
  const result = await gateRequest(request, env);
  assert.equal(result.ok, false);
  assert.equal(limiterCalls, 0);
  assert.equal(result.ok ? null : result.kind, "unauthorised");

  // Regression (spec review): the 401 Response is built fresh per refusal.
  // A shared module-level Response 500s every refusal after the first, because
  // Response bodies are single-use.
  const second = await gateRequest(request, env);
  assert.equal(second.ok, false);
  assert.equal(second.ok ? null : second.response.status, 401);
  assert.equal(
    second.ok ? null : await second.response.text(),
    '{"error":"unauthorised"}',
  );
});

test("gateRequest rejects a revoked token id at the session re-check", async () => {
  const request = new Request("https://x.example/api/retrieval", {
    headers: { Cookie: `rchat_session=${await cookie("bob")}` },
  });
  const result = await gateRequest(request, makeEnv());
  assert.equal(result.ok ? null : result.kind, "unauthorised");
});

test("gateRequest rejects an expired cookie", async () => {
  const expired = `rchat_session=alice.123.badmacvalue000000000000000000000000000`;
  const request = new Request("https://x.example/api/retrieval", {
    headers: { Cookie: expired },
  });
  const result = await gateRequest(request, makeEnv());
  assert.equal(result.ok ? null : result.kind, "unauthorised");
});

test("gateRequest maps a tripped minute limiter to the 'minute' status", async () => {
  const request = new Request("https://x.example/api/retrieval", {
    headers: { Cookie: `rchat_session=${await cookie()}` },
  });
  const env = makeEnv({
    RATE_LIMITER: { limit: () => Promise.resolve({ success: false }) },
  });
  const result = await gateRequest(request, env);
  assert.equal(result.ok, false);
  assert.equal(result.ok ? null : result.kind, "minute");
  assert.equal(result.ok ? null : result.response.status, 429);
});

test("gateRequest maps the usage counter trip to its limit reason", async () => {
  const request = new Request("https://x.example/api/retrieval", {
    headers: { Cookie: `rchat_session=${await cookie()}` },
  });
  const daily = await gateRequest(request, makeEnv({ DB: makeDb(31, 5) }));
  const monthly = await gateRequest(request, makeEnv({ DB: makeDb(5, 101) }));
  assert.equal(daily.ok ? null : daily.kind, "daily");
  assert.equal(monthly.ok ? null : monthly.kind, "monthly");
  assert.equal(daily.ok ? null : daily.response.status, 429);
});
test("gateRequest fails closed when the usage counter throws", async () => {
  const request = new Request("https://x.example/api/retrieval", {
    headers: { Cookie: `rchat_session=${await cookie()}` },
  });
  const env = makeEnv({
    DB: {
      prepare: () => ({
        bind: () => ({ first: () => Promise.reject(new Error("d1 down")) }),
      }),
    } as never,
  });
  await assert.rejects(gateRequest(request, env));
});
