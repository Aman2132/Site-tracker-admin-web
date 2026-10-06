import type { Metadata } from "next";

import { LiveMapView } from "@/components/views/LiveMapView";

export const metadata: Metadata = { title: "Live map" };

export default function LiveMapPage() {
  return <LiveMapView />;
}
