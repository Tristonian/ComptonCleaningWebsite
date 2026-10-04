import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/** The only place that reaches for the D1 binding. */
export function getDb(): D1Database {
  return getCloudflareContext().env.DB;
}
