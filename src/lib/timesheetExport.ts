import { formatDay, formatTime } from "./format";
import { attendanceFor, MIN_SHIFT_MS } from "./insights";
import { HOUR } from "./time";
import type { CrewMember, PresenceSession, Site } from "@/types/domain";

/** Standard working day hours before overtime applies (8 hours). */
const STANDARD_HOURS_MS = 8 * HOUR;

function csvEscape(val: unknown): string {
  if (val == null) return "";
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface TimesheetExportOptions {
  crew: CrewMember[];
  sessions: PresenceSession[];
  sites: Site[];
  days: number[];
  siteId?: string;
  projectName?: string;
}

/**
 * Generates and downloads a payroll-ready Timesheet CSV formatted with:
 * - Worker demographics (Name, Job Title, Team, Email)
 * - Shift details per day (Date, Site, First Check-in, Last Check-out)
 * - Work hours, Regular Hours (up to 8h), Overtime (>8h)
 * - Attendance notes (Late, Dropped Signal)
 * - Summary row with totals
 */
export function downloadTimesheetCsv({
  crew,
  sessions,
  sites,
  days,
  siteId,
}: TimesheetExportOptions): { rowCount: number; totalHours: number } {
  const siteMap = new Map(sites.map(s => [s.id, s.name]));
  const targetCrew = crew.filter(c => c.status !== "invited" && c.status !== "deactivated");
  const filteredSessions = siteId && siteId !== "all" ? sessions.filter(s => s.siteId === siteId) : sessions;

  const headers = [
    "Worker Name",
    "Job Title / Role",
    "Team",
    "Email",
    "Date",
    "Day of Week",
    "Site",
    "First Check-In (Nepal Time)",
    "Last Check-Out (Nepal Time)",
    "Sessions",
    "Hours Worked",
    "Regular Hours (<= 8h)",
    "Overtime Hours (> 8h)",
    "Late Arrival (> 9:15 am)",
    "Dropped Signal",
  ];

  const rows: (string | number)[][] = [];
  let totalWorkedMs = 0;
  let totalRegularMs = 0;
  let totalOvertimeMs = 0;

  for (const person of targetCrew) {
    const cells = attendanceFor(person.id, filteredSessions, days);

    for (const cell of cells) {
      if (cell.workedMs < MIN_SHIFT_MS && cell.sessions.length === 0) continue;

      const regularMs = Math.min(cell.workedMs, STANDARD_HOURS_MS);
      const overtimeMs = Math.max(0, cell.workedMs - STANDARD_HOURS_MS);

      totalWorkedMs += cell.workedMs;
      totalRegularMs += regularMs;
      totalOvertimeMs += overtimeMs;

      const firstSession = cell.sessions[0];
      const siteName = firstSession ? siteMap.get(firstSession.siteId) ?? "Unknown site" : "—";
      const timeout = cell.sessions.some(s => s.endReason === "timeout");

      rows.push([
        person.name,
        person.jobTitle || "Worker",
        person.team || "—",
        person.email || "—",
        formatDay(cell.day),
        new Date(cell.day).toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kathmandu" }),
        siteName,
        cell.firstIn ? formatTime(cell.firstIn) : "—",
        cell.open ? "On Shift" : cell.lastOut ? formatTime(cell.lastOut) : "—",
        cell.sessions.length,
        (cell.workedMs / HOUR).toFixed(2),
        (regularMs / HOUR).toFixed(2),
        (overtimeMs / HOUR).toFixed(2),
        cell.late ? "Yes" : "No",
        timeout ? "Yes" : "No",
      ]);
    }
  }

  // Summary Row at the bottom
  rows.push([]);
  rows.push([
    "TOTALS",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    (totalWorkedMs / HOUR).toFixed(2),
    (totalRegularMs / HOUR).toFixed(2),
    (totalOvertimeMs / HOUR).toFixed(2),
    "",
    "",
  ]);

  const csvContent = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `timesheet-${siteId && siteId !== "all" ? siteId : "all"}-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { rowCount: rows.length - 2, totalHours: Math.round((totalWorkedMs / HOUR) * 10) / 10 };
}

/**
 * Downloads a personal timesheet CSV for an individual crew member on /crew/[id].
 */
export function downloadCrewTimesheetCsv({
  person,
  sessions,
  sites,
  days,
}: {
  person: CrewMember;
  sessions: PresenceSession[];
  sites: Site[];
  days: number[];
}): { rowCount: number; totalHours: number } {
  const siteMap = new Map(sites.map(s => [s.id, s.name]));
  const personSessions = sessions.filter(s => s.personId === person.id);
  const cells = attendanceFor(person.id, personSessions, days);

  const headers = [
    "Date",
    "Day of Week",
    "Site",
    "First Check-In (Nepal Time)",
    "Last Check-Out (Nepal Time)",
    "Sessions",
    "Hours Worked",
    "Regular Hours (<= 8h)",
    "Overtime Hours (> 8h)",
    "Status / Notes",
  ];

  const rows: (string | number)[][] = [];
  let totalWorkedMs = 0;
  let totalRegularMs = 0;
  let totalOvertimeMs = 0;

  for (const cell of cells) {
    if (cell.workedMs < MIN_SHIFT_MS && cell.sessions.length === 0) continue;

    const regularMs = Math.min(cell.workedMs, STANDARD_HOURS_MS);
    const overtimeMs = Math.max(0, cell.workedMs - STANDARD_HOURS_MS);

    totalWorkedMs += cell.workedMs;
    totalRegularMs += regularMs;
    totalOvertimeMs += overtimeMs;

    const firstSession = cell.sessions[0];
    const siteName = firstSession ? siteMap.get(firstSession.siteId) ?? "Unknown site" : "—";
    const timeout = cell.sessions.some(s => s.endReason === "timeout");

    const notes: string[] = [];
    if (cell.late) notes.push("Late arrival");
    if (timeout) notes.push("Signal dropped");
    if (cell.long) notes.push("Long shift (>12h)");
    if (cell.open) notes.push("Currently on shift");

    rows.push([
      formatDay(cell.day),
      new Date(cell.day).toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kathmandu" }),
      siteName,
      cell.firstIn ? formatTime(cell.firstIn) : "—",
      cell.open ? "On Shift" : cell.lastOut ? formatTime(cell.lastOut) : "—",
      cell.sessions.length,
      (cell.workedMs / HOUR).toFixed(2),
      (regularMs / HOUR).toFixed(2),
      (overtimeMs / HOUR).toFixed(2),
      notes.join("; ") || "Normal",
    ]);
  }

  // Summary row
  rows.push([]);
  rows.push([
    "TOTALS",
    "",
    "",
    "",
    "",
    "",
    (totalWorkedMs / HOUR).toFixed(2),
    (totalRegularMs / HOUR).toFixed(2),
    (totalOvertimeMs / HOUR).toFixed(2),
    "",
  ]);

  const csvContent = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = person.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  a.download = `timesheet-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { rowCount: rows.length - 2, totalHours: Math.round((totalWorkedMs / HOUR) * 10) / 10 };
}
