"use client";

import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";

import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CrewMember, PresenceStatus, Site } from "@/types/domain";

/** Ring colour per presence status; the fill is the person's own colour, as on the mobile app's map. */
const RING: Record<PresenceStatus, string> = {
  online: "#0f9d58",
  idle: "#e2670f",
  offline: "#9aa0b0",
  invited: "#9aa0b0",
  deactivated: "#9aa0b0",
};

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/** Shown before any position arrives (centre of India). */
const START_VIEW: [number, number] = [22.5, 79];
const START_ZOOM = 5;
const MAX_FIT_ZOOM = 17;

type Located = CrewMember & { lat: number; lng: number };

const hasPosition = (person: CrewMember): person is Located => person.lat != null && person.lng != null;

/** Letters and digits only: the result goes into an HTML string. */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : ""))
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const safeColor = (color: string) => (/^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#1c4ff0");

/** Built from DOM nodes with textContent, never innerHTML: names and titles are user-entered. */
function popupFor(person: CrewMember, siteNames: string[]): HTMLElement {
  const root = document.createElement("div");
  const line = (text: string, bold = false) => {
    const el = document.createElement("div");
    if (bold) el.style.fontWeight = "700";
    el.textContent = text;
    root.appendChild(el);
  };
  line(person.name, true);
  line(`${person.jobTitle} · ${person.status}`);
  if (siteNames.length) line(siteNames.join(", "));
  line(`Updated ${timeAgo(person.lastSeenAt)}`);
  if (person.accuracy != null) line(`GPS ±${Math.round(person.accuracy)} m`);
  return root;
}

/**
 * Live crew positions on a real map (OpenStreetMap tiles, no API key). Pins
 * follow `crew` as it updates. The map frames the pins once per `fitKey` (so a
 * new site filter re-frames it) and leaves the view alone after that, so
 * panning isn't undone by the next position update.
 */
export function CrewMap({
  crew,
  sites,
  fitKey,
  focusId,
  className,
}: {
  crew: CrewMember[];
  sites: Site[];
  fitKey: string;
  /** Flies to and opens this person's pin. */
  focusId?: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    L: typeof import("leaflet");
    map: LeafletMap;
    markers: Map<string, Marker>;
    fitted: string | null;
  } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: LeafletMap | undefined;
    import("leaflet").then(L => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current).setView(START_VIEW, START_ZOOM);
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      created = map;
      stateRef.current = { L, map, markers: new Map(), fitted: null };
      setReady(true);
    });
    return () => {
      cancelled = true;
      created?.remove();
      stateRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const { L, map, markers } = state;
    const located = crew.filter(hasPosition);
    const siteName = (id: string) => sites.find(s => s.id === id)?.name;

    for (const [id, marker] of markers) {
      if (!located.some(p => p.id === id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const person of located) {
      const icon = L.divIcon({
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div style="width:34px;height:34px;border-radius:50%;background:${safeColor(person.color)};border:3px solid ${RING[person.status]};color:#fff;font:700 11px system-ui;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);opacity:${person.status === "online" ? 1 : 0.75}">${initialsOf(person.name)}</div>`,
      });
      const names = (person.currentSiteId ? [person.currentSiteId] : person.siteIds).map(siteName).filter((n): n is string => !!n);
      const existing = markers.get(person.id);
      if (existing) {
        existing.setLatLng([person.lat, person.lng]).setIcon(icon).setPopupContent(popupFor(person, names));
      } else {
        markers.set(person.id, L.marker([person.lat, person.lng], { icon }).bindPopup(popupFor(person, names)).addTo(map));
      }
    }

    if (state.fitted !== fitKey && located.length) {
      const bounds = L.latLngBounds(located.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: MAX_FIT_ZOOM });
      state.fitted = fitKey;
    }
  }, [ready, crew, sites, fitKey]);

  useEffect(() => {
    const state = stateRef.current;
    const marker = focusId ? state?.markers.get(focusId) : undefined;
    if (!state || !marker) return;
    state.map.flyTo(marker.getLatLng(), MAX_FIT_ZOOM);
    marker.openPopup();
  }, [ready, focusId]);

  // `isolate` keeps Leaflet's high z-indexes from covering the sticky header and dialogs.
  return <div ref={containerRef} className={cn("isolate z-0 overflow-hidden rounded-2xl bg-muted", className)} />;
}
