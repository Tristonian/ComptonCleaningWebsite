/** Times are stored in UTC and shown in Europe/London (CLAUDE.md). */
export function formatLondon(value: Date | string, withTime = true): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d);
}

/** "5 minutes ago", "3 hours ago", "2 days ago", else the date. For lists. */
export function timeAgo(value: Date | string, now: Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (Number.isNaN(mins)) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatLondon(d, false);
}
