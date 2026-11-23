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
  Database,
  FileClock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PlusCircle,
  Radio,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/landing/brand-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
    { label: "New Request", href: "/student/new-request", icon: PlusCircle },
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
    switchDemoRole,
  } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);

  const { status: realtimeStatus, events } = useRealtime({
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
      <div className="min-h-screen bg-[#F2F1ED] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-[#E6E5E0] bg-white p-8 shadow-card">
          <BrandLogo />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
          <p className="text-xs text-[#72736E]">Loading your CampusLab workspace...</p>
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
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-[#FFF0E9] text-[#DA5835]"
                : "text-[#585955] hover:bg-[#EAE9E4]/75 hover:text-[#222321]",
              isCompact && "justify-center px-2"
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#F26943]" />
            )}
            <Icon
              className={cn(
                "h-4.5 w-4.5 shrink-0 transition-colors",
                isActive ? "text-[#F26943]" : "text-[#72736E] group-hover:text-[#222321]"
              )}
            />
            {!isCompact && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F2F1ED] text-[#222321] flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 border-r border-[#E6E5E0] bg-white transition-all duration-200 sticky top-0 h-screen",
          collapsed ? "w-[76px]" : "w-[254px]"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#EFECE6] px-4">
          <Link href={ROLE_DASHBOARD_ROUTES[user.role]}>
            <BrandLogo compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-1.5 text-[#72736E] hover:bg-[#EAE9E4] hover:text-[#222321] cursor-pointer"
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
        <div className="border-t border-[#EFECE6] p-3">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl bg-[#FAF9F6] border border-[#EFECE6] p-2.5",
              collapsed && "justify-center p-2"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#222321] truncate">
                  {user.fullName}
                </p>
                <p className="text-[11px] text-[#72736E] truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="rounded-lg p-1.5 text-[#72736E] hover:bg-[#EAE9E4] hover:text-[#D9534F] cursor-pointer"
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
            className="fixed inset-0 bg-[#222321]/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[#EFECE6] px-4">
              <BrandLogo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-[#72736E] hover:bg-[#EAE9E4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNavLinks(false)}
            <div className="border-t border-[#EFECE6] p-4">
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
        {/* Demo Mode Banner (ONLY shown when PostgreSQL / backend DB is unreachable) */}
        {isDemoMode && (
          <div className="bg-[#FFF0E9] border-b border-[#F26943]/25 px-4 py-2 text-xs text-[#9E3C1F] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-[#F26943] shrink-0" />
              <span>
                <strong>Demo Preview Mode</strong> — Connect PostgreSQL (
                <code className="font-mono text-[11px]">docker compose up -d</code> +{" "}
                <code className="font-mono text-[11px]">npm run db:seed</code>) for live
                persistence.
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(["CENTRAL_LAB_MANAGER", "LAB_MANAGER", "INSTRUCTOR", "STUDENT"] as UserRole[]).map(
                (r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => switchDemoRole(r)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                      user.role === r
                        ? "bg-[#F26943] text-white"
                        : "bg-white/80 text-[#9E3C1F] hover:bg-white"
                    )}
                  >
                    {r === "CENTRAL_LAB_MANAGER"
                      ? "Central"
                      : r === "LAB_MANAGER"
                        ? "Lab Mgr"
                        : r === "INSTRUCTOR"
                          ? "Instructor"
                          : "Student"}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E6E5E0] bg-white/90 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-xl border border-[#E6E5E0] bg-white p-2 text-[#222321] hover:bg-[#F2F1ED]"
              aria-label="Open menu"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#72736E]">
                <span>{ROLE_LABELS[user.role]}</span>
                <span>/</span>
                <span className="text-[#222321] truncate">{activeNav?.label}</span>
              </div>
              <p className="text-sm font-semibold text-[#222321] truncate font-display">
                {activeNav?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Scope Selector for Central Lab Manager OR Campus Badge for Campus Roles */}
            {user.role === "CENTRAL_LAB_MANAGER" ? (
              <div className="hidden sm:block w-52">
                <Select
                  value={selectedCampusId || "ALL"}
                  onValueChange={(v) => setSelectedCampusId(v === "ALL" ? "" : v)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-[#FAF9F6]">
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
                <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#E6E5E0] bg-[#FAF9F6] px-3 py-1.5 text-xs font-medium text-[#222321]">
                  <Building2 className="h-3.5 w-3.5 text-[#F26943]" />
                  <span className="font-mono text-[11px] text-[#72736E]">
                    {user.campus.code}
                  </span>
                  <span className="max-w-[150px] truncate">{user.campus.name}</span>
                </div>
              )
            )}

            {/* Realtime SSE Indicator */}
            <div
              className={cn(
                "hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                realtimeStatus === "connected"
                  ? "border-[#288568]/25 bg-[#EAF6F1] text-[#288568]"
                  : realtimeStatus === "demo"
                    ? "border-[#F26943]/25 bg-[#FFF0E9] text-[#DA5835]"
                    : "border-[#D69A35]/30 bg-[#FDF6E7] text-[#A8741C]"
              )}
            >
              <Radio
                className={cn(
                  "h-3 w-3",
                  realtimeStatus === "connected" && "animate-pulse"
                )}
              />
              {realtimeStatus === "connected"
                ? "Live Sync"
                : realtimeStatus === "demo"
                  ? "Preview"
                  : "Syncing"}
            </div>

            {/* Live Events / Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-9 w-9 rounded-xl">
                  <Bell className="h-4 w-4 text-[#222321]" />
                  {events.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#F26943] ring-2 ring-white" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Live Campus Activity</span>
                  <Badge variant="outline" className="text-[10px]">
                    SSE Stream
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {events.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-[#72736E]">
                    <Activity className="mx-auto h-5 w-5 text-[#B8B7AF] mb-1.5" />
                    No new live events yet. Mutations appear here instantly.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#EFECE6]">
                    {events.map((ev) => (
                      <div key={ev.id} className="px-3 py-2.5 text-xs">
                        <p className="font-medium text-[#222321]">{ev.summary}</p>
                        <p className="mt-0.5 text-[11px] text-[#72736E]">
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
                  className="flex items-center gap-2 rounded-xl border border-[#E6E5E0] bg-white p-1 pr-2.5 hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-xs font-semibold text-[#222321] max-w-[110px] truncate">
                    {user.fullName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="space-y-1">
                  <p className="text-sm font-semibold text-[#222321]">{user.fullName}</p>
                  <p className="text-xs font-normal text-[#72736E] truncate">
                    {user.email}
                  </p>
                  <div className="pt-1">
                    <RoleBadge role={user.role} />
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/login")}>
                  <AlertCircle className="h-4 w-4 text-[#72736E]" />
                  Switch Role / Account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="text-[#D9534F] focus:text-[#D9534F]"
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
