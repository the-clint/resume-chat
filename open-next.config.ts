// OpenNext Cloudflare adapter config (ticket 11: OpenNext + Next 15.5.x on Workers).
// Defaults: no incremental cache override — the landing page is prerendered and the
// chat route is a streaming route handler, so no tag/ISR cache is needed yet.
// https://opennext.js.org/cloudflare/config
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
