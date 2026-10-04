'use client';

import { usePathname } from 'next/navigation';

/**
 * The bottom tab bar on every /admin page, thumb-reachable like HairByRachel's: an icon over a label.
 * Rendered by AdminBar, so no page has to opt in. Padding for it comes from `body:has(.admin-tabs)`
 * in globals.css, so the last item on a page is never hidden behind it.
 */
const TABS = [
  { href: '/admin', label: 'Home', icon: '🏠' },
  { href: '/admin/work', label: 'Work', icon: '🧽' },
  { href: '/admin/calendar', label: 'Calendar', icon: '📅' },
  { href: '/admin/customers', label: 'Customers', icon: '👥' },
  { href: '/admin/enquiries', label: 'Enquiries', icon: '📥' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

/** Screens reached from the Settings hub keep its tab lit. */
const SETTINGS_PATHS = ['/admin/settings', '/admin/rounds', '/admin/templates', '/admin/appearance'];

export function AdminTabs() {
  const path = usePathname() ?? '';
  const inside = (href: string) => path === href || path.startsWith(`${href}/`);
  const active = (href: string) =>
    href === '/admin' ? path === '/admin' : href === '/admin/settings' ? SETTINGS_PATHS.some(inside) : inside(href);
  return (
    <nav aria-label="Admin" className="admin-tabs fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-6">
        {TABS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            aria-current={active(t.href) ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active(t.href) ? 'font-black text-brand-deep' : 'text-ink/70'}`}
          >
            <span className="text-xl" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
