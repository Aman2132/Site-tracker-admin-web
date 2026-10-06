import { timeAgo } from "@/lib/format";

import type { CrewMember, PresenceStatus, Site } from "@/types/domain";

/** What every map implementation takes. */
export interface CrewMapProps {
  crew: CrewMember[];
  sites: Site[];
  /** The map frames the pins once per key (so a new site filter re-frames it), then leaves the view alone. */
  fitKey: string;
  /** Flies to and opens this person's pin. */
  focusId?: string | null;
  className?: string;
}

export type Located = CrewMember & { lat: number; lng: number };

export const hasPosition = (person: CrewMember): person is Located => person.lat != null && person.lng != null;

/** Shown before any position arrives (centre of the region). */
export const START_CENTER = { lat: 22.5, lng: 79 };
export const START_ZOOM = 5;
export const MAX_FIT_ZOOM = 17;
export const FIT_PADDING_PX = 48;
const PIN_SIZE_PX = 34;
/** Dark text for the white popup box, whatever the dashboard theme is. */
const POPUP_TEXT = "#1a1f36";

/** Ring colour per presence status; the fill is the person's own colour, as on the mobile app's map. */
const RING: Record<PresenceStatus, string> = {
  online: "#0f9d58",
  idle: "#e2670f",
  offline: "#9aa0b0",
  invited: "#9aa0b0",
  deactivated: "#9aa0b0",
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const safeColor = (color: string) => (/^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#1c4ff0");

/** The round pin for one person. Built from DOM nodes with textContent, never innerHTML: names are user-entered. */
export function pinElement(person: CrewMember): HTMLElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: `${PIN_SIZE_PX}px`,
    height: `${PIN_SIZE_PX}px`,
    borderRadius: "50%",
    background: safeColor(person.color),
    border: `3px solid ${RING[person.status]}`,
    color: "#fff",
    font: "700 11px system-ui",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,.35)",
    opacity: person.status === "online" ? "1" : "0.75",
    boxSizing: "border-box",
  });
  el.textContent = initialsOf(person.name);
  return el;
}

/** The names of the sites a pin's popup should list: where they're checked in, else where they're assigned. */
export function siteNamesFor(person: CrewMember, sites: Site[]): string[] {
  const ids = person.currentSiteId ? [person.currentSiteId] : person.siteIds;
  return ids.map(id => sites.find(s => s.id === id)?.name).filter((name): name is string => !!name);
}

/**
 * Popup content, also built from DOM nodes. Both map libraries draw it on a white
 * box, so the text colour is set here: left to inherit, it would be the
 * dashboard's light text in dark mode and vanish on the white.
 */
export function popupFor(person: CrewMember, siteNames: string[]): HTMLElement {
  const root = document.createElement("div");
  Object.assign(root.style, { color: POPUP_TEXT, fontSize: "13px", lineHeight: "1.45", minWidth: "150px" });
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
