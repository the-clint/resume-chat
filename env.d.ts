// Secrets set via `wrangler secret put` (never in wrangler.jsonc, so not in the
// generated bindings). Declared here so `env` access typechecks.
interface CloudflareEnv {
  OPENROUTER_API_KEY: string;
  TOKEN_LIST: string;
  SESSION_HMAC_KEY: string;
}
