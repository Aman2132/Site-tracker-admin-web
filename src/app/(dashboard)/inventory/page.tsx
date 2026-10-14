import type { Metadata } from "next";

import { InventoryView } from "@/components/views/InventoryView";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return <InventoryView />;
}
