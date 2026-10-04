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
  { href: '/admin/customers', label: 'Customers', icon: '👥' },
  { href: '/admin/enquiries', label: 'Enquiries', icon: '📥' },
  { href: '/admin/templates', label: 'Templates', icon: '✉️' },
  { href: '/admin/appearance', label: 'Site', icon: '🎨' },
];

export function AdminTabs() {
  const path = usePathname() ?? '';
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
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
