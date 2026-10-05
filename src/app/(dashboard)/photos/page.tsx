import type { Metadata } from "next";

import { PhotosView } from "@/components/views/PhotosView";

export const metadata: Metadata = { title: "Photos" };

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ site?: string | string[] }> }) {
  const { site } = await searchParams;
  return <PhotosView initialSite={typeof site === "string" ? site : undefined} />;
}
