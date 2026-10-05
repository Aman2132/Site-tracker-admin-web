import type { Metadata } from "next";

import { SitesView } from "@/components/views/SitesView";

export const metadata: Metadata = { title: "Sites" };

export default function SitesPage() {
  return <SitesView />;
}
