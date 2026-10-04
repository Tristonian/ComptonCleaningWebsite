import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache on purpose (ADR 0001 addendum): every route renders per request (it
// reads the session cookie and D1 overrides) and nothing uses ISR or revalidatePath, so the
// R2 cache HairByRachel needs would be dead weight here. Add r2IncrementalCache back, with the
// NEXT_INC_CACHE_R2_BUCKET binding, if static pages with revalidation are ever introduced.
export default defineCloudflareConfig({});
