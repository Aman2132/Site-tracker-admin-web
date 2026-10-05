import {
  Activity,
  CalendarClock,
  Building2,
  Images,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, description: "Today at a glance" },
  { href: "/sites", label: "Sites", icon: Building2, description: "Projects and geofences" },
  { href: "/crew", label: "Crew", icon: Users, description: "People, roles and assignments" },
  { href: "/photos", label: "Photos", icon: Images, description: "Geotagged site photos" },
  { href: "/attendance", label: "Attendance", icon: CalendarClock, description: "Online / offline history" },
  { href: "/activity", label: "Activity", icon: Activity, description: "Everything that happened" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Alerts, roles and profile" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
