// Token gate auth (ticket 10): a varlock-free Worker secret (`TOKEN_LIST`) holds a
// JSON array of {id, name, sha256(token)} entries; login digests the presented token
// and digest-compares it against the list; the session is a stateless HMAC-SHA256-signed
// cookie re-verified on every request — including a re-check of the token id against the
// current list, so revocation takes effect at the holder's next request. Pure compute:
// no D1, no storage. Web Crypto only, so the same code runs on Workers and in tests.

export const SESSION_COOKIE_NAME = "rchat_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // fixed 7-day maxAge, no sliding

export interface TokenEntry {
  id: string;
  name: string;
  sha256: string;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const HEX = /^[0-9a-f]{64}$/;

/** Parses and validates the TOKEN_LIST secret. Throws (misconfiguration) on bad shape. */
export function parseTokenList(tokenListJson: string): TokenEntry[] {
  const parsed: unknown = JSON.parse(tokenListJson);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("TOKEN_LIST must be a non-empty JSON array");
  }
  return parsed.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("TOKEN_LIST entries must be objects");
    }
    const { id, name, sha256 } = entry as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !SLUG.test(id) ||
      typeof name !== "string" ||
      name.length === 0 ||
      typeof sha256 !== "string" ||
      !HEX.test(sha256)
    ) {
      throw new Error(
        "TOKEN_LIST entries must be { id: slug, name: string, sha256: 64-hex }",
      );
    }
    return { id, name, sha256 };
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of equal-length hex digests. Length differences return
 * false immediately — acceptable, since lengths are fixed at 64 in practice.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Digests the raw token and matches it against the list. Returns the entry or null. */
export async function verifyToken(
  tokenListJson: string,
  rawToken: string,
): Promise<TokenEntry | null> {
  const list = parseTokenList(tokenListJson);
  const digest = await sha256Hex(rawToken);
  for (const entry of list) {
    if (timingSafeEqualHex(digest, entry.sha256)) return entry;
  }
  return null;
}

/** HMAC-SHA256 of the payload, returned as unpadded base64url (cookie-safe). */
async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * Signs a session: "<token-id>.<expiry-ms>.<hmac(token-id.expiry-ms)>".
 * Stateless — no store, revocation comes from the per-request list re-check.
 */
export async function signSession(
  tokenId: string,
  hmacSecret: string,
  now: number = Date.now(),
): Promise<{ value: string; maxAge: number }> {
  const expiryMs = now + SESSION_TTL_SECONDS * 1000;
  const payload = `${tokenId}.${expiryMs}`;
  const mac = await hmacSha256(hmacSecret, payload);
  return { value: `${payload}.${mac}`, maxAge: SESSION_TTL_SECONDS };
}

/** Verifies HMAC + expiry and returns the token id, or null on any failure. */
export async function verifySession(
  cookieValue: string,
  hmacSecret: string,
  now: number = Date.now(),
): Promise<string | null> {
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [tokenId, expiry, mac] = parts;
  const expiryMs = Number(expiry);
  if (!Number.isInteger(expiryMs) || expiryMs <= now) return null;

  const expected = await hmacSha256(hmacSecret, `${tokenId}.${expiry}`);
  if (!timingSafeEqualHex(mac, expected)) return null;
  return tokenId;
}

/** Reads the session cookie value from a Request, or null. */
export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME && rest.length > 0) {
      return rest.join("=");
    }
  }
  return null;
}

/**
 * The session decision, cookie in and TokenEntry out: signature + expiry, then
 * the token id re-checked against the current TOKEN_LIST. A removed entry dies
 * here. Returns null for unauthenticated / expired / revoked.
 */
export async function resolveSession(
  cookieValue: string | null,
  tokenListJson: string,
  hmacSecret: string,
): Promise<TokenEntry | null> {
  if (!cookieValue) return null;
  const tokenId = await verifySession(cookieValue, hmacSecret);
  if (!tokenId) return null;
  const list = parseTokenList(tokenListJson);
  return list.find((entry) => entry.id === tokenId) ?? null;
}

/**
 * The per-request gate: cookie signature + expiry AND the token id against the
 * current TOKEN_LIST. A removed entry dies at the holder's next request.
 * Returns the token id, or null for unauthenticated / expired / revoked.
 */
export async function verifySessionRequest(
  request: Request,
  tokenListJson: string,
  hmacSecret: string,
): Promise<string | null> {
  const entry = await resolveSession(
    readSessionCookie(request),
    tokenListJson,
    hmacSecret,
  );
  return entry?.id ?? null;
}
