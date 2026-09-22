// The app root: the server decides the first screen from the session cookie, using
// the same check the per-request gate runs (signature + expiry + live-list re-check).
// Rendering per request is deliberate — the gate state must never be cached, and the
// render itself does no rendering work beyond an HMAC verify.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, resolveSession } from "@/lib/auth";

import ChatApp from "./chat-app";

/** The gate state must never be cached; this route renders per request. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const cookieValue = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;

  const { TOKEN_LIST, SESSION_HMAC_KEY } = env;
  const session =
    TOKEN_LIST && SESSION_HMAC_KEY
      ? await resolveSession(cookieValue, TOKEN_LIST, SESSION_HMAC_KEY)
      : null;

  return <ChatApp initialName={session?.name ?? null} />;
}
