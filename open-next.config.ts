import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

// R2-backed cache for on-demand revalidation (ADR 0001) - see the
// NEXT_INC_CACHE_R2_BUCKET binding in wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
