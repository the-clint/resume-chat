// Login (ticket 10): POST { token } — digests the raw token, digest-compares it
// against the TOKEN_LIST secret, and sets the stateless signed session cookie on
// match. Every failure — wrong token, missing secret, malformed body — returns
// the same 401 with the same body: the plain token screen is message-free and
// deliberately indistinguishable across unauthorised/expired/revoked. No rate
// limit here: a 128-bit token space makes brute force impractical (ticket 10).

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { SESSION_COOKIE_NAME, signSession, verifyToken } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  let token: unknown;
  try {
    const body = await request.json();
    if (body !== null && typeof body === "object" && "token" in body) {
      token = (body as { token: unknown }).token;
    }
  } catch {
    // fall through: token stays undefined
  }
  if (typeof token !== "string" || token.length === 0) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const tokenListJson = env.TOKEN_LIST;
  const hmacSecret = env.SESSION_HMAC_KEY;
  if (!tokenListJson || !hmacSecret) {
    console.error("Missing TOKEN_LIST or SESSION_HMAC_KEY secret");
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const entry = await verifyToken(tokenListJson, token);
  if (!entry) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const { value, maxAge } = await signSession(entry.id, hmacSecret);
  const response = Response.json({ ok: true, name: entry.name });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
  return response;
}
