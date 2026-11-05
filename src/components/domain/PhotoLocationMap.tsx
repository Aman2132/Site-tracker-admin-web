"use client";

import "leaflet/dist/leaflet.css";

import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import { Compass, ExternalLink, MapPin, Mountain } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { headingToCompass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SitePhoto } from "@/types/domain";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function PhotoLocationMap({ photo, className }: { photo: SitePhoto; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    L: typeof import("leaflet");
    map: LeafletMap;
    marker: Marker;
    circle: Circle;
  } | null>(null);
  const [ready, setReady] = useState(false);

  const hasCoords = (photo.lat !== 0 || photo.lng !== 0) && !isNaN(photo.lat) && !isNaN(photo.lng);

  useEffect(() => {
    if (!hasCoords) return;
    let cancelled = false;
    let created: LeafletMap | undefined;

    import("leaflet").then(L => {
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([photo.lat, photo.lng], 17);

      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      created = map;

      // Accuracy circle
      const circle = L.circle([photo.lat, photo.lng], {
        radius: Math.max(photo.accuracy || 10, 5),
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        weight: 1.5,
      }).addTo(map);

      // Custom photo thumbnail pin
      const icon = createPhotoIcon(L, photo);
      const marker = L.marker([photo.lat, photo.lng], { icon, interactive: false }).addTo(map);

      stateRef.current = { L, map, marker, circle };
      setReady(true);

      // Invalidate size once modal spring animation settles
      timer = setTimeout(() => {
        if (!cancelled && map) {
          map.invalidateSize();
        }
      }, 250);
    });

    let timer: NodeJS.Timeout | undefined;

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      created?.remove();
      stateRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCoords]);

  // Update position and icon when photo changes
  useEffect(() => {
    const state = stateRef.current;
    if (!state || !hasCoords) return;

    const { L, map, marker, circle } = state;
    map.setView([photo.lat, photo.lng], 17, { animate: true });
    circle.setLatLng([photo.lat, photo.lng]);
    circle.setRadius(Math.max(photo.accuracy || 10, 5));
    marker.setLatLng([photo.lat, photo.lng]);
    marker.setIcon(createPhotoIcon(L, photo));
    map.invalidateSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.lat, photo.lng, photo.accuracy, photo.heading, photo.thumbUrl, hasCoords]);

  if (!hasCoords) {
    return (
      <div className={cn("flex h-[200px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground", className)}>
        <MapPin className="mb-1 size-5 opacity-40" />
        No GPS coordinates recorded for this photo
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${photo.lat},${photo.lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${photo.lat}&mlon=${photo.lng}#map=18/${photo.lat}/${photo.lng}`;

  return (
    <div className={cn("group relative h-[210px] w-full overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-sm", className)}>
      <div ref={containerRef} className="size-full z-0" />

      {/* Map loading skeleton */}
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/60 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="size-2 animate-ping rounded-full bg-primary" />
            Loading map…
          </div>
        </div>
      )}

      {/* Floating chips (top-left) */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-[11px] font-semibold text-foreground shadow-xs backdrop-blur-md">
          ±{photo.accuracy} m
        </span>
        {photo.altitude != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-xs backdrop-blur-md">
            <Mountain className="size-3 text-primary" />
            {Math.round(photo.altitude)} m ASL
          </span>
        )}
        {photo.heading != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-xs backdrop-blur-md">
            <Compass className="size-3 text-primary" />
            {photo.heading}° {headingToCompass(photo.heading)}
          </span>
        )}
      </div>

      {/* External Map links (bottom-right) */}
      <div className="absolute right-2.5 bottom-2.5 z-20 flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-background hover:text-primary"
          title="Open in Google Maps"
        >
          Google <ExternalLink className="size-3 opacity-60" />
        </a>
        <a
          href={osmUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-background hover:text-primary"
          title="Open in OpenStreetMap"
        >
          OSM <ExternalLink className="size-3 opacity-60" />
        </a>
      </div>
    </div>
  );
}

function createPhotoIcon(L: typeof import("leaflet"), photo: SitePhoto) {
  const PIN_WIDTH = 46;
  const PIN_HEIGHT = 54;
  const hasHeading = photo.heading != null;
  const headingDeg = photo.heading ?? 0;

  // Safe image URL escaping
  const safeThumb = photo.thumbUrl.replace(/"/g, "&quot;");

  const headingHtml = hasHeading
    ? `<div style="
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%) rotate(${headingDeg}deg);
        transform-origin: 50% 28px;
        pointer-events: none;
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 9px solid #1c4ff0;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
        "></div>
      </div>`
    : "";

  const html = `
    <div style="position: relative; width: ${PIN_WIDTH}px; height: ${PIN_HEIGHT}px; display: flex; flex-direction: column; align-items: center; cursor: default;">
      ${headingHtml}
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2.5px solid #ffffff;
        background: #111;
        box-shadow: 0 4px 14px rgba(0,0,0,0.38);
        overflow: hidden;
        flex-shrink: 0;
        position: relative;
        z-index: 2;
      ">
        <img
          src="${safeThumb}"
          alt="Photo capture"
          style="width: 100%; height: 100%; object-fit: cover; display: block;"
        />
      </div>
      <div style="
        width: 10px;
        height: 10px;
        background: #ffffff;
        transform: rotate(45deg);
        margin-top: -6px;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
        z-index: 1;
        border-right: 1px solid rgba(0,0,0,0.1);
        border-bottom: 1px solid rgba(0,0,0,0.1);
      "></div>
    </div>
  `;

  return L.divIcon({
    className: "photo-pin-marker",
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
    html,
  });
}

