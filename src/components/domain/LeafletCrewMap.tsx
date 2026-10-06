"use client";

import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  FIT_PADDING_PX,
  MAX_FIT_ZOOM,
  START_CENTER,
  START_ZOOM,
  hasPosition,
  pinElement,
  popupFor,
  siteNamesFor,
  type CrewMapProps,
} from "./crewMapShared";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PIN_SIZE_PX = 34;

/**
 * Free fallback map (OpenStreetMap tiles, no key), used when there is no
 * Google Maps key or Google rejects it. Pins follow `crew` as it updates.
 */
export function LeafletCrewMap({ crew, sites, fitKey, focusId, className }: CrewMapProps) {
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
      const map = L.map(containerRef.current).setView([START_CENTER.lat, START_CENTER.lng], START_ZOOM);
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

    for (const [id, marker] of markers) {
      if (!located.some(p => p.id === id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const person of located) {
      const icon = L.divIcon({
        className: "",
        iconSize: [PIN_SIZE_PX, PIN_SIZE_PX],
        iconAnchor: [PIN_SIZE_PX / 2, PIN_SIZE_PX / 2],
        html: pinElement(person),
      });
      const popup = popupFor(person, siteNamesFor(person, sites));
      const existing = markers.get(person.id);
      if (existing) {
        existing.setLatLng([person.lat, person.lng]).setIcon(icon).setPopupContent(popup);
      } else {
        markers.set(person.id, L.marker([person.lat, person.lng], { icon }).bindPopup(popup).addTo(map));
      }
    }

    if (state.fitted !== fitKey && located.length) {
      const bounds = L.latLngBounds(located.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [FIT_PADDING_PX, FIT_PADDING_PX], maxZoom: MAX_FIT_ZOOM });
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
