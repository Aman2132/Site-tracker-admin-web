"use client";

import { useCallback, useState } from "react";

import { GoogleCrewMap } from "./GoogleCrewMap";
import { LeafletCrewMap } from "./LeafletCrewMap";
import type { CrewMapProps } from "./crewMapShared";

/** Inlined at build time; put it in .env.local. Without it the free OpenStreetMap map is used. */
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Live crew positions: Google Maps when a key is set, otherwise (or if Google
 * rejects the key) the free OpenStreetMap map. Same props either way.
 */
export function CrewMap(props: CrewMapProps) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const fallBack = useCallback(() => setGoogleFailed(true), []);

  if (!GOOGLE_MAPS_KEY || googleFailed) return <LeafletCrewMap {...props} />;
  return <GoogleCrewMap {...props} apiKey={GOOGLE_MAPS_KEY} onFailure={fallBack} />;
}
