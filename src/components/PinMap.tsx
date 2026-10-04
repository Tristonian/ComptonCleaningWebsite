'use client';

import { useEffect, useRef } from 'react';
import type { LatLng } from '@/lib/geo';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * A small map with one draggable pin (ADR 0005 era: Mapbox, chosen by Tristan 2026-10-04).
 * mapbox-gl is imported on demand, so a visitor who never opens the map never downloads it.
 * `point` moves the pin from outside (postcode lookup, "use my location"); dragging the pin or
 * tapping the map reports the new spot through `onMove`. If WebGL or the token fails, `onFail`
 * fires and the form carries on with the typed address.
 */
export function PinMap({
  token,
  point,
  onMove,
  onFail,
}: {
  token: string;
  point: LatLng;
  onMove: (p: LatLng) => void;
  onFail: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const marker = useRef<import('mapbox-gl').Marker | null>(null);
  const latest = useRef({ onMove, onFail, point });
  latest.current = { onMove, onFail, point };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled || !box.current) return;
        mapboxgl.accessToken = token;
        const start = latest.current.point;
        // A mouse (hover + fine pointer): the wheel zooms the map and a drag pans it. A touchscreen:
        // one finger must keep scrolling the page, so the map needs two fingers (pinch to zoom, drag
        // to pan) and says so. The +/- buttons work for everyone, including keyboard users.
        const mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const m = new mapboxgl.Map({
          container: box.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [start.lng, start.lat],
          zoom: 17,
          minZoom: 5,
          maxZoom: 20,
          attributionControl: true,
          cooperativeGestures: !mouse,
          scrollZoom: true,
          pitchWithRotate: false,
          dragRotate: false,
        });
        m.touchZoomRotate.enable();
        m.touchZoomRotate.disableRotation(); // pinch zooms, it never spins the map
        m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        // Exposed as data-zoom so tests (and curious developers) can see the zoom level.
        const reportZoom = () => {
          m.getContainer().dataset.zoom = m.getZoom().toFixed(2);
        };
        m.on('load', reportZoom);
        m.on('zoom', reportZoom);
        m.on('error', (e) => {
          // A bad or restricted token surfaces as a map error: give up quietly.
          if (!m.loaded()) latest.current.onFail();
          console.warn('[map]', e.error?.message);
        });
        const pin = new mapboxgl.Marker({ draggable: true, color: '#085478' })
          .setLngLat([start.lng, start.lat])
          .addTo(m);
        pin.on('dragend', () => {
          const { lat, lng } = pin.getLngLat();
          latest.current.onMove({ lat, lng });
        });
        m.on('click', (e) => {
          pin.setLngLat(e.lngLat);
          latest.current.onMove({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
        map.current = m;
        marker.current = pin;
      } catch (err) {
        console.warn('[map] could not start:', err);
        latest.current.onFail();
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [token]);

  // Follow external changes (a new postcode, detected location) without rebuilding the map.
  useEffect(() => {
    const m = map.current;
    const pin = marker.current;
    if (!m || !pin) return;
    const cur = pin.getLngLat();
    if (Math.abs(cur.lat - point.lat) < 1e-7 && Math.abs(cur.lng - point.lng) < 1e-7) return;
    pin.setLngLat([point.lng, point.lat]);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) m.jumpTo({ center: [point.lng, point.lat] });
    else m.easeTo({ center: [point.lng, point.lat], duration: 600 });
  }, [point]);

  return <div ref={box} className="h-64 w-full overflow-hidden rounded-xl ring-1 ring-ink/20" />;
}
