import type { Metadata } from "next";

import { CrewProfileView } from "@/components/views/CrewProfileView";

/** The name is only known to the client once data loads, so the tab title stays generic. */
export const metadata: Metadata = { title: "Crew member" };

export default async function CrewProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrewProfileView id={id} />;
}
