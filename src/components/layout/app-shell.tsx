"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  Camera,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type RealtimeEventType,
  type UserRole,
} from "@/types/contracts";

const EVENT_DISPLAY_META: Record<
  RealtimeEventType,
  { label: string; dotClass: string }
> = {
  "inventory.updated": { label: "Stock updated", dotClass: "bg-[#7BB628]" },
  "inventory.visibility_changed": { label: "Catalog visibility", dotClass: "bg-[#111111]" },
  "allocation.created": { label: "New dispatch", dotClass: "bg-[#2563EB]" },
  "allocation.status_changed": { label: "Dispatch update", dotClass: "bg-[#2563EB]" },
  "allocation.verified": { label: "Stock received", dotClass: "bg-[#16A34A]" },
  "request.created": { label: "New request", dotClass: "bg-[#D97706]" },
  "request.status_changed": { label: "Request update", dotClass: "bg-[#7BB628]" },
  "borrowing.issued": { label: "Equipment issued", dotClass: "bg-[#111111]" },
  "return.submitted": { label: "Return submitted", dotClass: "bg-[#2563EB]" },
  "return.verified": { label: "Return verified", dotClass: "bg-[#16A34A]" },
  "ticket.created": { label: "Issue reported", dotClass: "bg-[#DC2626]" },
  "ticket.updated": { label: "Ticket updated", dotClass: "bg-[#D97706]" },
  heartbeat: { label: "System sync", dotClass: "bg-black/30" },
};

const ROLE_DOT_COLOR: Record<UserRole, string> = {
  CENTRAL_LAB_MANAGER: "bg-[#FA8E66]",
  LAB_MANAGER: "bg-[#5EA9CE]",
  INSTRUCTOR: "bg-[#7EA47E]",
  STUDENT: "bg-[#84B823]",
};

interface NavItem {
  label: string;
  mobileLabel?: string;
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
    { label: "Dashboard", mobileLabel: "Dashboard", href: "/lab-manager/dashboard", icon: LayoutDashboard },
    { label: "Campus Inventory", mobileLabel: "Inventory", href: "/lab-manager/inventory", icon: FileSpreadsheet },
    { label: "Incoming Stock", mobileLabel: "Incoming", href: "/lab-manager/incoming-stock", icon: PackageCheck },
    { label: "Issue Tickets", mobileLabel: "Tickets", href: "/lab-manager/tickets", icon: ShieldAlert },
    { label: "History & Ledger", mobileLabel: "Ledger", href: "/lab-manager/history", icon: History },
    { label: "Reports", mobileLabel: "Reports", href: "/lab-manager/reports", icon: BarChart3 },
  ],
  INSTRUCTOR: [
    { label: "Dashboard", mobileLabel: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
    { label: "Campus Inventory", mobileLabel: "Inventory", href: "/instructor/inventory", icon: Package },
    { label: "Student Requests", mobileLabel: "Requests", href: "/instructor/requests", icon: ClipboardCheck },
    { label: "Return Verification", mobileLabel: "Validate", href: "/instructor/return-verification", icon: RotateCcw },
    { label: "Issue Tickets", mobileLabel: "Tickets", href: "/instructor/tickets", icon: ShieldAlert },
    { label: "History", mobileLabel: "History", href: "/instructor/history", icon: History },
  ],
  STUDENT: [
    { label: "Dashboard", mobileLabel: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "Browse Inventory", mobileLabel: "Inventory", href: "/student/inventory", icon: Package },
    { label: "My Requests", mobileLabel: "Requests", href: "/student/requests", icon: ClipboardList },
    { label: "Borrowed Items", mobileLabel: "Borrowed", href: "/student/borrowed", icon: Camera },
    { label: "Returns", mobileLabel: "Returns", href: "/student/returns", icon: RotateCcw },
    { label: "History", mobileLabel: "History", href: "/student/history", icon: History },
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
  const [lastSeenEventId, setLastSeenEventId] = useState<string | null>(null);
  const activeMobilePillRef = useRef<HTMLAnchorElement | null>(null);
  const drawerTouchStartX = useRef<number | null>(null);
  const showMobileQuickNav =
    user?.role === "STUDENT" ||
    user?.role === "INSTRUCTOR" ||
    user?.role === "LAB_MANAGER";

  const { events, status: realtimeStatus } = useRealtime({
    enabled: Boolean(user),
    isDemoMode,
  });

  const unreadCount = (() => {
    if (events.length === 0) return 0;
    if (!lastSeenEventId) return events.length;
    const idx = events.findIndex((e) => e.id === lastSeenEventId);
    return idx === -1 ? events.length : idx;
  })();

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!showMobileQuickNav) return;
    activeMobilePillRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [pathname, showMobileQuickNav]);

  if (loading || !user || user.role !== allowedRole) {
    return (
      <div className="min-h-dvh lg:min-h-screen bg-[#F0F0F0] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-4 rounded-[24px] border border-black/12 bg-white p-6 sm:p-8 shadow-card">
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

  const renderNavLinks = (isCompact = false, isMobile = false) => (
    <nav
      className={cn(
        "flex-1 overflow-y-auto",
        isMobile ? "space-y-1.5 px-3.5 py-4" : "space-y-1 px-3 py-4"
      )}
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-full transition-all",
              isMobile
                ? "min-h-[44px] px-4 py-2.5 text-[15px] font-medium active:scale-[0.98]"
                : "px-3.5 py-2.5 text-sm font-medium",
              isActive
                ? "bg-[#C4F041] text-black font-semibold"
                : "text-black/65 hover:bg-black/[0.05] hover:text-black",
              isCompact && "justify-center px-2"
            )}
          >
            <Icon
              className={cn(
                "shrink-0 transition-colors",
                isMobile ? "h-[18px] w-[18px]" : "h-4 w-4",
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
    <div className="min-h-dvh lg:min-h-screen w-full max-w-full overflow-x-clip bg-[#F0F0F0] text-black flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 border-r border-black/12 bg-white transition-all duration-200 sticky top-0 h-screen",
          collapsed ? "w-[76px]" : "w-[254px]"
        )}
      >
        <div className="relative flex h-16 items-center justify-center border-b border-black/10 px-4">
          <Link
            href={ROLE_DASHBOARD_ROUTES[user.role]}
            className="flex items-center justify-center"
          >
            <BrandLogo compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "rounded-full p-1.5 text-black/55 hover:bg-black/[0.06] hover:text-black cursor-pointer",
              collapsed ? "ml-1" : "absolute right-3"
            )}
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
        <div className="border-t border-black/[0.07] p-3">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-[20px] bg-[#F5F5F2] ring-1 ring-black/[0.04] p-2.5",
              collapsed && "justify-center p-2"
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[#C4F041] text-black font-semibold text-xs">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-black truncate">
                  {user.fullName}
                </p>
                <p className="text-[12px] text-[#5E5E5A] truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/50 transition-colors hover:bg-white hover:text-[#B91C1C] cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden flex h-[100dvh] transition-[opacity,visibility] duration-200",
          mobileOpen
            ? "visible pointer-events-auto opacity-100"
            : "invisible pointer-events-none opacity-0"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setMobileOpen(false)}
        />
        <div
          role="dialog"
          aria-modal={mobileOpen}
          aria-label="Navigation menu"
          onTouchStart={(e) => {
            drawerTouchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (drawerTouchStartX.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? drawerTouchStartX.current;
            if (drawerTouchStartX.current - endX > 64) {
              setMobileOpen(false);
            }
            drawerTouchStartX.current = null;
          }}
          className={cn(
            "relative z-10 flex h-full w-[292px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out pb-[env(safe-area-inset-bottom)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-black/10 px-4">
            <Link
              href={ROLE_DASHBOARD_ROUTES[user.role]}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center"
            >
              <BrandLogo />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-black/65 hover:bg-black/[0.06] hover:text-black active:scale-95 transition-all cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {renderNavLinks(false, true)}
          <div className="shrink-0 border-t border-black/10 bg-[#FAF9F7] p-3.5 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-[#C4F041] text-black font-semibold text-sm">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-black truncate">
                  {user.fullName}
                </p>
                <p className="text-xs text-black/60 truncate">
                  {user.campus?.name
                    ? `${ROLE_LABELS[user.role]} · ${user.campus.name}`
                    : ROLE_LABELS[user.role]}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full min-h-[44px] rounded-full text-sm font-medium border-black/15 bg-white text-[#B33C17] hover:bg-[#FDE5DC]/50 hover:text-[#B33C17]"
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 sm:gap-3 border-b border-black/12 bg-[#F0F0F0]/90 backdrop-blur-md px-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black hover:bg-[#EAEAE6] active:scale-95 transition-all cursor-pointer"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[16px] font-semibold sm:font-medium tracking-[-0.02em] text-black truncate">
                {activeNav?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
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
            <DropdownMenu
              onOpenChange={(open) => {
                if (open && events.length > 0) {
                  setLastSeenEventId(events[0].id);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black ring-1 ring-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#F5F5F2] cursor-pointer"
                >
                  <Bell className="h-[17px] w-[17px] text-black" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7BB628] opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C4F041] ring-2 ring-white" />
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(22.5rem,calc(100vw-1.5rem))] sm:w-[360px] p-2.5 rounded-[26px]"
              >
                {/* Inset Soft Header Cushion */}
                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#F5F5F2] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold tracking-[-0.015em] text-black">
                      Campus Activity
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#5E5E5A]">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          realtimeStatus === "connected" || isDemoMode
                            ? "bg-[#7BB628]"
                            : "bg-[#D97706]"
                        )}
                      />
                      <span>
                        {isDemoMode
                          ? "Live cross-tab sync"
                          : realtimeStatus === "connected"
                            ? "Live updates active"
                            : "Reconnecting…"}
                      </span>
                    </div>
                  </div>
                  {events.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLastSeenEventId(events[0].id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-[#5E5E5A] ring-1 ring-black/[0.06] transition-colors hover:text-black cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Caught up</span>
                    </button>
                  )}
                </div>

                {/* Activity Feed */}
                <div className="mt-2">
                  {events.length === 0 ? (
                    <div className="rounded-[18px] bg-[#F5F5F2]/55 px-5 py-8 text-center">
                      <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-black/[0.05] shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                        <Bell className="h-[18px] w-[18px] text-black/45" />
                      </div>
                      <p className="text-[14px] font-semibold text-black">
                        All caught up
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#5E5E5A]">
                        Stock changes, approvals, and dispatches will appear here in real time.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] space-y-1 overflow-y-auto pr-0.5">
                      {events.slice(0, 12).map((ev) => {
                        const meta = EVENT_DISPLAY_META[ev.type] ?? {
                          label: "Campus update",
                          dotClass: "bg-black/40",
                        };
                        return (
                          <div
                            key={ev.id}
                            className="flex items-start gap-3 rounded-[16px] px-3 py-2.5 transition-colors hover:bg-[#F5F5F2]"
                          >
                            <span
                              className={cn(
                                "mt-[7px] h-2 w-2 shrink-0 rounded-full",
                                meta.dotClass
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-medium leading-snug text-black">
                                {ev.summary}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#5E5E5A]">
                                <span>{meta.label}</span>
                                <span className="text-black/25">·</span>
                                <span className="tabular-nums">
                                  {formatRelativeTime(ev.timestamp)}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-white p-1 sm:pr-3 text-[14px] font-medium text-black ring-1 ring-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#F5F5F2] cursor-pointer shrink-0"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#C4F041] text-black text-[12.5px] font-semibold">
                      {getInitials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline max-w-[130px] truncate text-[13.5px] font-medium text-black">
                    {user.fullName}
                  </span>
                  <ChevronDown className="hidden sm:inline h-3.5 w-3.5 text-black/45" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(19.5rem,calc(100vw-1.5rem))] sm:w-[296px] p-2.5 rounded-[26px]"
              >
                {/* Inset Soft Identity Card */}
                <div className="rounded-[18px] bg-[#F5F5F2] p-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white shadow-sm">
                      <AvatarFallback className="bg-[#C4F041] text-black text-[14px] font-semibold">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-black">
                        {user.fullName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-[#5E5E5A]">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            ROLE_DOT_COLOR[user.role]
                          )}
                        />
                        <span className="truncate">{ROLE_LABELS[user.role]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 border-t border-black/[0.06] pt-2.5 text-[12.5px] text-[#5E5E5A]">
                    <p className="truncate">{user.email}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-black/40" />
                        <span className="truncate">
                          {user.campus?.name ?? "All 40 Campuses"}
                        </span>
                      </span>
                      {user.institutionalId && (
                        <span className="shrink-0 font-medium text-black/70 tabular-nums">
                          {user.institutionalId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clean Editorial Actions */}
                <div className="mt-2 space-y-1">
                  <DropdownMenuItem
                    onClick={() => router.push("/login")}
                    className="group min-h-[44px] rounded-[16px] px-2.5 py-2 focus:bg-[#F5F5F2]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F2] text-black transition-colors group-hover:bg-white group-focus:bg-white">
                      <ArrowLeftRight className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-black">
                        Switch account
                      </p>
                      <p className="text-[12px] font-normal text-[#5E5E5A]">
                        Change campus role or user
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-black/35" />
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={logout}
                    className="group min-h-[44px] rounded-[16px] px-2.5 py-2 text-[#B91C1C] focus:bg-[#FEF2F2] focus:text-[#B91C1C]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2] text-[#B91C1C] transition-colors group-hover:bg-white group-focus:bg-white">
                      <LogOut className="h-4 w-4" />
                    </span>
                    <span className="text-[13.5px] font-medium">Sign out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile 1-Tap Quick-Navigation Strip (zero bottom dock overlap) */}
        {showMobileQuickNav && (
          <nav
            aria-label={
              user.role === "LAB_MANAGER"
                ? "Lab Manager quick navigation"
                : user.role === "INSTRUCTOR"
                  ? "Instructor quick navigation"
                  : "Student quick navigation"
            }
            className="lg:hidden sticky top-16 z-20 border-b border-black/10 bg-[#F0F0F0]/95 backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto px-3.5 sm:px-6 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    ref={isActive ? activeMobilePillRef : undefined}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] transition-all active:scale-[0.97]",
                      isActive
                        ? "bg-[#C4F041] text-black font-semibold border border-black/15 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        : "bg-white/85 text-black/70 font-medium border border-black/10 hover:bg-white hover:text-black"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive ? "text-black" : "text-black/55"
                      )}
                    />
                    <span>{item.mobileLabel ?? item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Page Main Container */}
        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-[1600px] w-full min-w-0 mx-auto space-y-5 sm:space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
