// Bindings declared in wrangler.jsonc. OpenNext's getCloudflareContext() is typed from the
// global CloudflareEnv interface, so this is where R2 gets its type. The database is Neon
// (ADR 0005), reached through the DATABASE_URL secret, not a binding.
interface CloudflareEnv {
  SITE_IMAGES: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV?: string;
  SITE_URL?: string;
}
