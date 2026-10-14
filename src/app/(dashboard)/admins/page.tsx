import type { Metadata } from "next";

import { AdminsView } from "@/components/views/AdminsView";

export const metadata: Metadata = { title: "Admins" };

export default function AdminsPage() {
  return <AdminsView />;
}
