import type { ComponentType } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Award,
  CheckCircle2,
  ClipboardList,
  Bookmark,
  User,
  ShieldCheck,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Shown in the mobile bottom nav (max ~5 items fit comfortably). */
  primary?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, primary: true },
  { label: "Programs", href: "/programs", icon: GraduationCap, primary: true },
  { label: "Scholarships", href: "/scholarships", icon: Award, primary: true },
  { label: "Eligibility", href: "/eligibility", icon: CheckCircle2 },
  { label: "Applications", href: "/applications", icon: ClipboardList },
  { label: "Saved", href: "/saved", icon: Bookmark, primary: true },
  { label: "Profile", href: "/profile", icon: User, primary: true },
  { label: "Admin", href: "/admin", icon: ShieldCheck, adminOnly: true },
];
