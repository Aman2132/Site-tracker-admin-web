import type { Metadata } from "next";

import { AttendanceView } from "@/components/views/AttendanceView";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  return <AttendanceView />;
}
