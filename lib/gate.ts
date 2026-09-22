// The per-request gate (ticket 10), enforced in this order on every gated route:
//   1. Session — HMAC + expiry + token-id re-check against the live TOKEN_LIST.
//      Revocation kills the cookie here, at the holder's next request.
//   2. Minute limiter — RATE_LIMITER binding (ratelimits, 10 req/60 s in
//      wrangler.jsonc), keyed by token id. Per-location and permissive by design;
//      the D1 daily cap carries the hard ceiling. Login is exempt (128-bit token
//      space, brute force impractical).
//   3. Usage counter — one D1 UPSERT per turn (lib/usage.ts). Its write IS the
//      count, so it runs last and throws on D1 failure: fail closed, the counter
//      exists to protect the bill.
// Every refusal builds a fresh Response (bodies are single-use in workerd), and
// all unauthorised/expired/revoked refusals carry the identical body — nothing
// leaks about who is on the list. Limit refusals return distinct bodies the UI
// maps to its friendly messages.

import { verifySessionRequest } from "@/lib/auth";
import { consumeTurn, D1Database } from "@/lib/usage";

export type GateEnv = {
  TOKEN_LIST: string;
  SESSION_HMAC_KEY: string;
  RATE_LIMITER: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  DB: D1Database;
};

export type GateResult =
  | { ok: true; tokenId: string }
  | {
      ok: false;
      kind: "unauthorised" | "minute" | "daily" | "monthly";
      response: Response;
    };

// Built fresh per refusal — Response bodies are single-use; sharing one would
// 500 every refusal after the first within an isolate.
function unauthorised(): Response {
  return Response.json({ error: "unauthorised" }, { status: 401 });
}

export async function gateRequest(
  request: Request,
  env: GateEnv,
): Promise<GateResult> {
  // 1. Session: signature + expiry + live-list re-check.
  const tokenId = await verifySessionRequest(
    request,
    env.TOKEN_LIST,
    env.SESSION_HMAC_KEY,
  );
  if (!tokenId)
    return { ok: false, kind: "unauthorised", response: unauthorised() };

  // 2. Minute limiter.
  const { success } = await env.RATE_LIMITER.limit({ key: tokenId });
  if (!success) {
    return {
      ok: false,
      kind: "minute",
      response: Response.json({ error: "minute_limit" }, { status: 429 }),
    };
  }

  // 3. Usage counter (throws on D1 failure — fail closed).
  const tripped = await consumeTurn(env.DB, tokenId);
  if (tripped) {
    return {
      ok: false,
      kind: tripped,
      response: Response.json({ error: `${tripped}_limit` }, { status: 429 }),
    };
  }

  return { ok: true, tokenId };
}
