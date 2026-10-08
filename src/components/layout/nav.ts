import {
  Activity,
  CalendarClock,
  Building2,
  Images,
  LayoutDashboard,
  Map,
  Package,
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
  { href: "/map", label: "Live map", icon: Map, description: "Where the crew is now" },
  { href: "/sites", label: "Sites", icon: Building2, description: "Projects and their crew" },
  { href: "/crew", label: "Crew", icon: Users, description: "People, roles and assignments" },
  { href: "/photos", label: "Photos", icon: Images, description: "Geotagged site photos" },
  { href: "/inventory", label: "Inventory", icon: Package, description: "Items received on site" },
  { href: "/attendance", label: "Attendance", icon: CalendarClock, description: "Online / offline history" },
  { href: "/activity", label: "Activity", icon: Activity, description: "Everything that happened" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Your account and appearance" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
