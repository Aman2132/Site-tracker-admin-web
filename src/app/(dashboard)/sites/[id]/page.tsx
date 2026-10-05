import type { Metadata } from "next";

import { SiteDetailView } from "@/components/views/SiteDetailView";
import { SITES } from "@/lib/mock/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: SITES.find(s => s.id === id)?.name ?? "Site" };
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SiteDetailView id={id} />;
}
