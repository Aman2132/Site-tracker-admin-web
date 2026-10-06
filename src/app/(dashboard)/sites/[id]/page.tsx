import type { Metadata } from "next";

import { SiteDetailView } from "@/components/views/SiteDetailView";

/** The name is only known to the client once data loads, so the tab title stays generic. */
export const metadata: Metadata = { title: "Site" };

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SiteDetailView id={id} />;
}
