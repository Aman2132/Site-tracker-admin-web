import type { Metadata } from "next";

import { CrewProfileView } from "@/components/views/CrewProfileView";
import { CREW } from "@/lib/mock/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: CREW.find(c => c.id === id)?.name ?? "Crew member" };
}

export default async function CrewProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrewProfileView id={id} />;
}
