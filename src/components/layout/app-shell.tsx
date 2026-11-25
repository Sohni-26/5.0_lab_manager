"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUSES } from "@/lib/demo-data";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import {
  ROLE_DASHBOARD_ROUTES,
  ROLE_LABELS,
  type CampusDTO,
  type UserRole,
} from "@/types/contracts";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  CENTRAL_LAB_MANAGER: [
    { label: "Dashboard", href: "/central/dashboard", icon: LayoutDashboard },
    { label: "Campuses", href: "/central/campuses", icon: Building2 },
    { label: "Master Inventory", href: "/central/inventory", icon: Package },
    { label: "Allocations", href: "/central/allocations", icon: Send },
    { label: "Users", href: "/central/users", icon: Users },
    { label: "Requests", href: "/central/requests", icon: ClipboardList },
    { label: "Issue Tickets", href: "/central/tickets", icon: ShieldAlert },
    { label: "Audit Logs", href: "/central/audit-logs", icon: FileClock },
    { label: "Settings", href: "/central/settings", icon: Settings },
  ],
  LAB_MANAGER: [
    { label: "Dashboard", href: "/lab-manager/dashboard", icon: LayoutDashboard },
    { label: "Campus Inventory", href: "/lab-manager/inventory", icon: FileSpreadsheet },
    { label: "Incoming Stock", href: "/lab-manager/incoming-stock", icon: PackageCheck },
    { label: "Student Requests", href: "/lab-manager/requests", icon: ClipboardCheck },
    { label: "Issue Tickets", href: "/lab-manager/tickets", icon: ShieldAlert },
    { label: "History & Ledger", href: "/lab-manager/history", icon: History },
    { label: "Reports", href: "/lab-manager/reports", icon: BarChart3 },
  ],
  INSTRUCTOR: [
    { label: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
    { label: "Campus Inventory", href: "/instructor/inventory", icon: Package },
    { label: "Student Requests", href: "/instructor/requests", icon: ClipboardCheck },
    { label: "Return Verification", href: "/instructor/return-verification", icon: RotateCcw },
    { label: "Issue Tickets", href: "/instructor/tickets", icon: ShieldAlert },
    { label: "History", href: "/instructor/history", icon: History },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "Browse Inventory", href: "/student/inventory", icon: Package },
    { label: "My Requests", href: "/student/requests", icon: ClipboardList },
    { label: "Borrowed Items", href: "/student/borrowed", icon: Camera },
    { label: "Returns", href: "/student/returns", icon: RotateCcw },
    { label: "History", href: "/student/history", icon: History },
  ],
};

interface AppShellProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export function AppShell({ allowedRole, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    loading,
    isDemoMode,
    selectedCampusId,
    setSelectedCampusId,
    logout,
  } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);

  const { events } = useRealtime({
    enabled: Boolean(user),
    isDemoMode,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== allowedRole) {
      router.replace(ROLE_DASHBOARD_ROUTES[user.role]);
    }
  }, [loading, user, allowedRole, router]);

  useEffect(() => {
    if (user?.role !== "CENTRAL_LAB_MANAGER") return;
    apiClient.campuses
      .list({ pageSize: 50 })
      .then((res) => setCampuses(res.data))
      .catch(() => setCampuses(DEMO_CAMPUSES));
  }, [user?.role]);

  if (loading || !user || user.role !== allowedRole) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-[24px] border border-black/12 bg-white p-8 shadow-card">
          <BrandLogo />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
          <p className="text-xs text-black/55">Loading your CampusLab workspace...</p>
        </div>
      </div>
    );
  }

  const navItems = ROLE_NAV_ITEMS[user.role];
  const activeNav =
    navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    navItems[0];

  const renderNavLinks = (isCompact = false) => (
    <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-[#C4F041] text-black font-semibold"
                : "text-black/65 hover:bg-black/[0.05] hover:text-black",
              isCompact && "justify-center px-2"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive ? "text-black" : "text-black/50 group-hover:text-black"
              )}
            />
            {!isCompact && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-black flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 border-r border-black/12 bg-white transition-all duration-200 sticky top-0 h-screen",
          collapsed ? "w-[76px]" : "w-[254px]"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-black/10 px-4">
          <Link href={ROLE_DASHBOARD_ROUTES[user.role]}>
            <BrandLogo compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-full p-1.5 text-black/55 hover:bg-black/[0.06] hover:text-black cursor-pointer"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderNavLinks(collapsed)}

        {/* Sidebar Profile Card */}
        <div className="border-t border-black/10 p-3">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-2xl bg-[#F5F5F3] border border-black/10 p-2.5",
              collapsed && "justify-center p-2"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[#AAC2AA] text-black font-semibold text-xs">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-black truncate">
                  {user.fullName}
                </p>
                <p className="text-[11px] text-black/55 truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="rounded-full p-1.5 text-black/55 hover:bg-[#FA8E66]/30 hover:text-black cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-black/10 px-4">
              <BrandLogo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-1.5 text-black/60 hover:bg-black/[0.06]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavLinks(false)}
            <div className="border-t border-black/10 p-4">
              <Button variant="outline" size="sm" className="w-full" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-black/12 bg-[#F0F0F0]/90 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-full border border-black/15 bg-white p-2 text-black hover:bg-[#EAEAE6]"
              aria-label="Open menu"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0">
              <p className="text-[16px] font-medium tracking-[-0.02em] text-black truncate">
                {activeNav?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Scope Selector for Central Lab Manager OR plain Campus Text */}
            {user.role === "CENTRAL_LAB_MANAGER" ? (
              <div className="hidden sm:block w-56">
                <Select
                  value={selectedCampusId || "ALL"}
                  onValueChange={(v) => setSelectedCampusId(v === "ALL" ? "" : v)}
                >
                  <SelectTrigger className="h-10 rounded-full text-[14px] bg-white border-black/15">
                    <SelectValue placeholder="All 40 Campuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Global · All 40 Campuses</SelectItem>
                    {campuses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              user.campus && (
                <span className="hidden sm:inline text-[14px] font-medium text-black/65 truncate max-w-[220px]">
                  {user.campus.name}
                </span>
              )
            )}

            {/* Live Events / Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-full">
                  <Bell className="h-4 w-4 text-black" />
                  {events.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#FA8E66] ring-2 ring-white" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="text-[14px] font-medium text-black">
                  Live Campus Activity
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {events.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[14px] text-black/55">
                    <Activity className="mx-auto h-5 w-5 text-black/30 mb-1.5" />
                    No new live events yet.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-black/10">
                    {events.map((ev) => (
                      <div key={ev.id} className="px-3 py-2.5 text-[14px]">
                        <p className="font-medium text-black">{ev.summary}</p>
                        <p className="mt-0.5 text-[13px] text-black/55">
                          {ev.type} · {formatRelativeTime(ev.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2.5 text-[14px] font-medium text-black hover:opacity-75 transition-opacity cursor-pointer"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#C4F041] text-black text-[13px] font-semibold">
                      {getInitials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline max-w-[130px] truncate">
                    {user.fullName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="space-y-1">
                  <p className="text-sm font-semibold text-black">{user.fullName}</p>
                  <p className="text-xs font-normal text-black/55 truncate">
                    {user.email}
                  </p>
                  <div className="pt-1">
                    <RoleBadge role={user.role} />
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/login")}>
                  <AlertCircle className="h-4 w-4 text-black/55" />
                  Switch Role / Account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="text-[#B33C17] focus:text-[#B33C17]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Main Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
