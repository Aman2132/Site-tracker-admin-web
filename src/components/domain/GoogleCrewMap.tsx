"use client";

import { useEffect, useRef, useState } from "react";

import { loadGoogleMaps, onGoogleAuthFailure } from "@/lib/googleMaps";
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

/** Advanced markers need a map id; Google's demo id works for any key. Set a real one to style the map. */
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";

const detach = (marker: google.maps.marker.AdvancedMarkerElement) => {
  marker.map = null;
};

interface MapState {
  map: google.maps.Map;
  info: google.maps.InfoWindow;
  markers: Map<string, google.maps.marker.AdvancedMarkerElement>;
  /** Latest popup content per person, read when their pin is clicked. */
  popups: Map<string, HTMLElement>;
  fitted: string | null;
}

/**
 * Live crew positions on Google Maps (street, satellite and hybrid views).
 * Calls `onFailure` if the script can't load or Google rejects the key, so the
 * caller can fall back to the free map.
 */
export function GoogleCrewMap({
  crew,
  sites,
  fitKey,
  focusId,
  className,
  apiKey,
  onFailure,
}: CrewMapProps & { apiKey: string; onFailure: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MapState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stopListening = onGoogleAuthFailure(onFailure);

    (async () => {
      try {
        await loadGoogleMaps(apiKey);
        const { Map: GoogleMap, InfoWindow } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        await google.maps.importLibrary("marker");
        if (cancelled || !containerRef.current) return;
        const map = new GoogleMap(containerRef.current, {
          center: START_CENTER,
          zoom: START_ZOOM,
          mapId: MAP_ID,
          mapTypeControl: true,
          streetViewControl: false,
        });
        stateRef.current = { map, info: new InfoWindow(), markers: new Map(), popups: new Map(), fitted: null };
        setReady(true);
      } catch (error) {
        console.warn("[map] Google Maps failed —", error);
        if (!cancelled) onFailure();
      }
    })();

    return () => {
      cancelled = true;
      stopListening();
      const state = stateRef.current;
      if (state) {
        state.info.close();
        for (const marker of state.markers.values()) detach(marker);
      }
      stateRef.current = null;
      setReady(false);
    };
  }, [apiKey, onFailure]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const { map, info, markers, popups } = state;
    const located = crew.filter(hasPosition);

    for (const [id, marker] of markers) {
      if (!located.some(p => p.id === id)) {
        detach(marker);
        markers.delete(id);
        popups.delete(id);
      }
    }
    for (const person of located) {
      const position = { lat: person.lat, lng: person.lng };
      // A marker is anchored by its bottom edge; shifting the pin down half its height centres it on the spot.
      const content = pinElement(person);
      content.style.transform = "translateY(50%)";
      popups.set(person.id, popupFor(person, siteNamesFor(person, sites)));

      const existing = markers.get(person.id);
      if (existing) {
        existing.position = position;
        existing.content = content;
      } else {
        const marker = new google.maps.marker.AdvancedMarkerElement({ map, position, content, title: person.name });
        marker.addListener("gmp-click", () => {
          const popup = popups.get(person.id);
          if (!popup) return;
          info.setContent(popup);
          info.open({ map, anchor: marker });
        });
        markers.set(person.id, marker);
      }
    }

    if (state.fitted !== fitKey && located.length) {
      if (located.length === 1) {
        map.setCenter({ lat: located[0].lat, lng: located[0].lng });
        map.setZoom(MAX_FIT_ZOOM);
      } else {
        const bounds = new google.maps.LatLngBounds();
        for (const person of located) bounds.extend({ lat: person.lat, lng: person.lng });
        map.fitBounds(bounds, FIT_PADDING_PX);
        // fitBounds can zoom in very far on a tight cluster.
        google.maps.event.addListenerOnce(map, "idle", () => {
          if ((map.getZoom() ?? 0) > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
        });
      }
      state.fitted = fitKey;
    }
  }, [ready, crew, sites, fitKey]);

  useEffect(() => {
    const state = stateRef.current;
    const marker = focusId ? state?.markers.get(focusId) : undefined;
    const popup = focusId ? state?.popups.get(focusId) : undefined;
    if (!state || !marker || !popup || !marker.position) return;
    state.map.panTo(marker.position);
    state.map.setZoom(MAX_FIT_ZOOM);
    state.info.setContent(popup);
    state.info.open({ map: state.map, anchor: marker });
  }, [ready, focusId]);

  return <div ref={containerRef} className={cn("isolate z-0 overflow-hidden rounded-2xl bg-muted", className)} />;
}
