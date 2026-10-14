import type { Metadata } from "next";

import { AuditLogView } from "@/components/views/AuditLogView";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage() {
  return <AuditLogView />;
}
