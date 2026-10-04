'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PIN_STATUSES, colourOf, labelOf, type PinStatus } from '@/lib/pin-status';
import 'mapbox-gl/dist/mapbox-gl.css';

export type MapCustomer = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: PinStatus;
  /** Short line for the popup, e.g. "Due Mon 12 Oct · £15". */
  detail: string;
};

const BRISTOL: [number, number] = [-2.5879, 51.4545];

/**
 * Every customer with a location, as a colour-keyed pin (red owes, orange overdue, yellow due this week,
 * green up to date, grey no schedule). The key under the map doubles as a filter: tap a colour to hide
 * or show it. Tapping a pin shows who it is and links to their page. mapbox-gl loads on demand.
 */
export function CustomerMap({ token, customers }: { token: string; customers: MapCustomer[] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const markers = useRef<{ marker: import('mapbox-gl').Marker; status: PinStatus }[]>([]);
  const [hidden, setHidden] = useState<Set<PinStatus>>(new Set());
  const [broken, setBroken] = useState(false);

  const counts = useMemo(() => {
    const c = new Map<PinStatus, number>();
    for (const k of customers) c.set(k.status, (c.get(k.status) ?? 0) + 1);
    return c;
  }, [customers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled || !box.current) return;
        mapboxgl.accessToken = token;
        // A touchscreen: one finger must keep scrolling the page, so the map needs two (same as the contact form's map).
        const mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const m = new mapboxgl.Map({
          container: box.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: BRISTOL,
          zoom: 10.5,
          cooperativeGestures: !mouse,
          pitchWithRotate: false,
          dragRotate: false,
        });
        m.touchZoomRotate.disableRotation();
        m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        m.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');
        m.on('error', () => {
          if (!m.loaded()) setBroken(true);
        });

        const bounds = new mapboxgl.LngLatBounds();
        markers.current = customers.map((c) => {
          const popup = new mapboxgl.Popup({ offset: 24, closeButton: true }).setDOMContent(popupNode(c));
          const marker = new mapboxgl.Marker({ color: colourOf(c.status) }).setLngLat([c.lng, c.lat]).setPopup(popup).addTo(m);
          // The pin is a button for keyboard and screen-reader users.
          const el = marker.getElement();
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', `${c.name}, ${labelOf(c.status)}`);
          el.tabIndex = 0;
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              marker.togglePopup();
            }
          });
          bounds.extend([c.lng, c.lat]);
          return { marker, status: c.status };
        });
        if (customers.length > 0) m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
        map.current = m;
      } catch (err) {
        console.warn('[map] could not start:', err);
        setBroken(true);
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current = [];
    };
  }, [token, customers]);

  // The key filters pins without rebuilding the map.
  useEffect(() => {
    for (const { marker, status } of markers.current) marker.getElement().style.display = hidden.has(status) ? 'none' : '';
  }, [hidden]);

  const toggle = (s: PinStatus) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  if (broken) {
    return (
      <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        The map could not load (check the Mapbox token and that this phone allows WebGL). The customer list still works.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="h-[60dvh] min-h-[320px] w-full overflow-hidden rounded-2xl ring-1 ring-ink/10" role="region" aria-label="Customer map" />
      <ul aria-label="Key" className="flex flex-wrap gap-2">
        {PIN_STATUSES.map((p) => {
          const n = counts.get(p.key) ?? 0;
          const off = hidden.has(p.key);
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => toggle(p.key)}
                aria-pressed={!off}
                title={p.hint}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ring-1 ring-ink/20 ${off ? 'bg-white text-ink/40 line-through' : 'bg-white text-ink'}`}
              >
                <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: off ? '#cfcfcf' : p.colour }} />
                {p.label} ({n})
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Built with DOM nodes, not an HTML string: customer names and addresses are data, never markup. */
function popupNode(c: MapCustomer): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'font: 14px/1.35 system-ui, sans-serif; min-width: 170px';
  const name = document.createElement('div');
  name.style.fontWeight = '800';
  name.textContent = c.name;
  const addr = document.createElement('div');
  addr.textContent = c.address;
  const status = document.createElement('div');
  status.style.cssText = `margin-top:4px;font-weight:700;color:${colourOf(c.status)}`;
  status.textContent = `${labelOf(c.status)}${c.detail ? ` · ${c.detail}` : ''}`;
  const link = document.createElement('a');
  link.href = `/admin/customers/${encodeURIComponent(c.id)}`;
  link.textContent = 'Open customer →';
  link.style.cssText = 'display:inline-block;margin-top:6px;font-weight:700;text-decoration:underline';
  for (const part of [name, addr, status, link]) root.appendChild(part);
  return root;
}
