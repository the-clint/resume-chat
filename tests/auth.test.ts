// Tests for lib/auth.ts — the ticket-10 auth seam: token list parsing,
// digest token verification, and HMAC session cookie sign/verify.
// Run: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  parseTokenList,
  readSessionCookie,
  sha256Hex,
  signSession,
  timingSafeEqualHex,
  verifySession,
  verifySessionRequest,
  verifyToken,
} from "@/lib/auth";

const LIST = JSON.stringify([
  { id: "alice", name: "Alice", sha256: "a".repeat(64) },
  { id: "bob", name: "Bob", sha256: "b".repeat(64) },
]);

const DAY = 24 * 60 * 60 * 1000;
const BASE = 2_000_000_000_000; // 2033 — safely after Date.now() for expiry checks

test("sha256Hex digests a token to lowercase hex", async () => {
  // echo -n rchat_test | sha256sum
  const digest = await sha256Hex("rchat_test");
  assert.equal(digest.length, 64);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, await sha256Hex("rchat_test"));
  assert.notEqual(digest, await sha256Hex("rchat_other"));
});

test("timingSafeEqualHex matches equal strings and rejects mismatches", () => {
  assert.equal(timingSafeEqualHex("abc", "abc"), true);
  assert.equal(timingSafeEqualHex("abc", "abd"), false);
  assert.equal(timingSafeEqualHex("abc", "abcd"), false);
  assert.equal(timingSafeEqualHex("", ""), true);
});

test("parseTokenList accepts a valid list and rejects malformed ones", () => {
  const list = parseTokenList(LIST);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], {
    id: "alice",
    name: "Alice",
    sha256: "a".repeat(64),
  });

  assert.throws(() => parseTokenList("not json"));
  assert.throws(() => parseTokenList("[]"), /empty/);
  assert.throws(() => parseTokenList(JSON.stringify([{ id: "x", name: "X" }])));
  assert.throws(() =>
    parseTokenList(JSON.stringify([{ id: "x", name: "X", sha256: "nothex" }])),
  );
});

test("verifyToken matches a raw token against list digests", async () => {
  const raw = "rchat_" + "7".repeat(32);
  const list = JSON.stringify([
    { id: "alice", name: "Alice", sha256: await sha256Hex(raw) },
  ]);
  assert.equal((await verifyToken(list, raw))?.id, "alice");
  assert.equal(await verifyToken(list, "rchat_" + "8".repeat(32)), null);
  assert.equal(await verifyToken(list, ""), null);
});

test("verifyToken rejects a malformed list rather than failing open", async () => {
  await assert.rejects(verifyToken("not json", "rchat_x"));
});

test("signSession produces tokenId.expiry.hmac and verifySession round-trips", async () => {
  const { value, maxAge } = await signSession("alice", "key1", BASE);
  assert.equal(maxAge, SESSION_TTL_SECONDS);
  const parts = value.split(".");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "alice");
  assert.equal(Number(parts[1]), BASE + SESSION_TTL_SECONDS * 1000);
  assert.match(parts[2], /^[A-Za-z0-9_-]+$/);

  assert.equal(await verifySession(value, "key1"), "alice");
});

test("verifySession rejects tampered, expired, and wrong-key cookies", async () => {
  const { value } = await signSession("alice", "key1", BASE);
  const [, expiry, mac] = value.split(".");

  // Tampered id / expiry.
  assert.equal(await verifySession(`${"eve"}.${expiry}.${mac}`, "key1"), null);
  // Wrong signing key.
  assert.equal(await verifySession(value, "key2"), null);
  // Expired.
  assert.equal(await verifySession(value, "key1", BASE + 8 * DAY), null);
  // Garbage.
  assert.equal(await verifySession("garbage", "key1"), null);
  assert.equal(await verifySession("", "key1"), null);

  // Still valid just before expiry.
  const still = await verifySession(value, "key1", BASE + 7 * DAY - 1);
  assert.equal(still, "alice");
  assert.equal(mac.length, 43); // sha-256 hmac, base64url without padding
});

test("readSessionCookie pulls the session cookie out of the request", async () => {
  const { value } = await signSession("alice", "key1", BASE);
  const request = new Request("https://example.com/api/x", {
    headers: { Cookie: `other=1; ${SESSION_COOKIE_NAME}=${value}` },
  });
  assert.equal(readSessionCookie(request), value);

  const none = new Request("https://example.com/api/x");
  assert.equal(readSessionCookie(none), null);
});

test("verifySessionRequest re-checks the token id against the live list", async () => {
  const raw = "rchat_" + "9".repeat(32);
  const list = JSON.stringify([
    { id: "alice", name: "Alice", sha256: await sha256Hex(raw) },
  ]);
  const { value } = await signSession("alice", "key1", BASE);
  const request = new Request("https://example.com/api/x", {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${value}` },
  });

  // Valid session + alice still on the list.
  assert.equal(await verifySessionRequest(request, list, "key1"), "alice");

  // Same cookie, alice revoked: null — revocation kills the cookie at next request.
  const revoked = JSON.stringify([
    {
      id: "bob",
      name: "Bob",
      sha256: await sha256Hex("rchat_" + "8".repeat(32)),
    },
  ]);
  assert.equal(await verifySessionRequest(request, revoked, "key1"), null);
});
