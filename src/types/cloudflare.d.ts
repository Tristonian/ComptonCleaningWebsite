// Bindings declared in wrangler.jsonc. OpenNext's getCloudflareContext() is typed from the
// global CloudflareEnv interface, so this is where D1/R2 get their types.
interface CloudflareEnv {
  DB: D1Database;
  SITE_IMAGES: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV?: string;
  SITE_URL?: string;
}
