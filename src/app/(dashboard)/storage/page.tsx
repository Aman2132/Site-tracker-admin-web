import type { Metadata } from "next";

import { StorageView } from "@/components/views/StorageView";

export const metadata: Metadata = { title: "Storage" };

export default function StoragePage() {
  return <StorageView />;
}
