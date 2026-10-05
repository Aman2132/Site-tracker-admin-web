import type { Metadata } from "next";

import { CrewView } from "@/components/views/CrewView";

export const metadata: Metadata = { title: "Crew" };

export default function CrewPage() {
  return <CrewView />;
}
