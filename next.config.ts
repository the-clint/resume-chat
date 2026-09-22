import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Provisions local Cloudflare bindings (wrangler.jsonc + .dev.vars secrets) for
// getCloudflareContext() in dev. A no-op in production.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {/* config options here */};

export default nextConfig;
