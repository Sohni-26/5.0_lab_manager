"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { LoopsiiWordmark } from "@/components/landing/primitives";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { DEMO_MOCK_USERS } from "@/lib/demo-data";
import {
  ROLE_DASHBOARD_ROUTES,
  type MockUserOptionDTO,
  type UserRole,
} from "@/types/contracts";

const loginSchema = z.object({
  email: z.string().min(3, "Enter your institutional email or ID").trim(),
  password: z.string().min(4, "Password must be at least 4 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ENABLE_MOCK_SWITCHER =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true" ||
  process.env.NODE_ENV !== "production";

const ROLE_META: Record<UserRole, { label: string; bg: string }> = {
  CENTRAL_LAB_MANAGER: { label: "Central Lab Manager", bg: "#FA8E66" },
  LAB_MANAGER: { label: "Lab Manager", bg: "#9EC3D5" },
  INSTRUCTOR: { label: "Instructor", bg: "#AAC2AA" },
  STUDENT: { label: "Student", bg: "#C4F041" },
};

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [mockUsers, setMockUsers] = useState<MockUserOptionDTO[]>(DEMO_MOCK_USERS);
  const [loadingMockId, setLoadingMockId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "central@campuslab.edu",
      password: "demo-password",
      rememberMe: true,
    },
  });

  useEffect(() => {
    if (user) {
      router.replace(ROLE_DASHBOARD_ROUTES[user.role]);
    }
  }, [user, router]);

  useEffect(() => {
    if (!ENABLE_MOCK_SWITCHER) return;
    apiClient.auth
      .mockUsers()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const byRole = new Map<UserRole, MockUserOptionDTO>();
          for (const u of res.data) {
            if (!byRole.has(u.role)) byRole.set(u.role, u);
          }
          const ordered: UserRole[] = [
            "CENTRAL_LAB_MANAGER",
            "LAB_MANAGER",
            "INSTRUCTOR",
            "STUDENT",
          ];
          const primary = ordered
            .map((r) => byRole.get(r))
            .filter(Boolean) as MockUserOptionDTO[];
          setMockUsers(primary.length > 0 ? primary : res.data.slice(0, 6));
        }
      })
      .catch(() => {
        setMockUsers(DEMO_MOCK_USERS);
      });
  }, []);

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const loggedIn = await login({
        email: values.email,
        password: values.password,
      });
      toast.success(`Signed in as ${loggedIn.fullName}`);
      router.push(ROLE_DASHBOARD_ROUTES[loggedIn.role]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (option: MockUserOptionDTO) => {
    setLoadingMockId(option.id);
    try {
      const loggedIn = await login({ userId: option.id, email: option.email });
      toast.success(`Signed in as ${loggedIn.fullName}`);
      router.push(ROLE_DASHBOARD_ROUTES[loggedIn.role]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quick sign-in failed");
    } finally {
      setLoadingMockId(null);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#101010] text-[#F0F0F0] selection:bg-[#C4F041] selection:text-black"
      style={{
        fontFamily: "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Matching Footer Ambient Glow Background (static — no motion) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-32 -left-24 h-[520px] w-[560px] rounded-full bg-[#C4F041]/20 blur-[140px]" />
        <div className="absolute -bottom-28 -right-20 h-[520px] w-[560px] rounded-full bg-[#BCE6FA]/22 blur-[140px]" />
        <div className="absolute -bottom-36 left-1/2 h-[420px] w-[460px] -translate-x-1/2 rounded-full bg-[#FA8E66]/16 blur-[130px]" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-[1220px] items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="text-white">
          <LoopsiiWordmark inverse className="h-9 w-auto" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white/80 hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to overview
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1220px] flex-1 items-center justify-center px-5 pb-14 pt-2 sm:px-8">
        {/* Architectural hairline frame with 4 crisp corner registration dots */}
        <div className="relative w-full border border-white/12 p-4 sm:p-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-[3.5px] -top-[3.5px] h-[7px] w-[7px] bg-white"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-[3.5px] -top-[3.5px] h-[7px] w-[7px] bg-white"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[3.5px] -left-[3.5px] h-[7px] w-[7px] bg-white"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[3.5px] -right-[3.5px] h-[7px] w-[7px] bg-white"
          />

          <div className="grid w-full items-start gap-6 lg:grid-cols-12">
            {/* Left: Sign-In Form Card */}
            <div className="rounded-[22px] border border-white/12 bg-[#161615]/85 p-7 backdrop-blur-md sm:p-9 lg:col-span-6">
              <div className="mb-7 space-y-2">
                <p
                  className="text-[24px] leading-none text-[#C4F041]"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  Institutional access
                </p>
                <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#F0F0F0] sm:text-[34px]">
                  Welcome back to CampusLab
                </h1>
                <p className="text-[14px] text-white/55">
                  Sign in with your institutional email or ID to open your role workspace.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/60"
                  >
                    Email or Institutional ID
                  </label>
                  <input
                    id="email"
                    type="text"
                    placeholder="name@campuslab.edu or STU-0101"
                    className="h-11 w-full rounded-[12px] border border-white/15 bg-[#101010]/85 px-3.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#C4F041] focus:outline-none"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-[12px] font-medium text-[#FA8E66]">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-[11px] font-medium uppercase tracking-[0.08em] text-white/60"
                    >
                      Password
                    </label>
                    <span className="text-[11px] text-white/40">SSO / Campus Credentials</span>
                  </div>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 w-full rounded-[12px] border border-white/15 bg-[#101010]/85 px-3.5 text-[14px] text-white placeholder:text-white/30 focus:border-[#C4F041] focus:outline-none"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-[12px] font-medium text-[#FA8E66]">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/65">
                    <Checkbox
                      checked={watch("rememberMe")}
                      onCheckedChange={(v) => setValue("rememberMe", Boolean(v))}
                      className="border-white/30 data-[state=checked]:border-[#C4F041] data-[state=checked]:bg-[#C4F041] data-[state=checked]:text-black"
                    />
                    <span>Keep me signed in</span>
                  </label>
                  <span
                    className="text-[11px] text-white/45"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    40 CAMPUSES ENABLED
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-12 w-full cursor-pointer items-center justify-between rounded-full bg-[#C4F041] px-6 text-[15px] font-semibold text-black hover:bg-[#D4F664] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="mx-auto inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span>Sign in to Workspace</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right: Development Role Switcher + Multi-Campus Isolation */}
            <div className="space-y-5 lg:col-span-6">
              {ENABLE_MOCK_SWITCHER && (
                <div className="rounded-[22px] border border-white/12 bg-[#161615]/85 p-6 backdrop-blur-md sm:p-7">
                  <div className="mb-5">
                    <p
                      className="text-[22px] leading-none text-[#BCE6FA]"
                      style={{ fontFamily: "var(--font-caveat), cursive" }}
                    >
                      Development role switcher
                    </p>
                    <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#F0F0F0]">
                      One-click workspace access
                    </h2>
                    <p className="mt-1 text-[13px] text-white/50">
                      Sign in as any seeded role to inspect permissions, live stock sheets, and
                      approval workflows.
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    {mockUsers.map((opt) => {
                      const isLoading = loadingMockId === opt.id;
                      const roleInfo = ROLE_META[opt.role];
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={Boolean(loadingMockId)}
                          onClick={() => handleQuickLogin(opt)}
                          className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] p-4 text-left hover:border-[#C4F041]/60 hover:bg-white/[0.06] disabled:opacity-60"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-semibold text-[#F0F0F0]">
                                {opt.fullName}
                              </span>
                              <span
                                style={{ backgroundColor: roleInfo.bg }}
                                className="inline-flex rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold text-black"
                              >
                                {roleInfo.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/50">
                              <span className="truncate">{opt.email}</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {opt.campusCode
                                  ? `${opt.campusCode} (${opt.campusName})`
                                  : "Global Scope (40 Campuses)"}
                              </span>
                            </div>
                          </div>

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 group-hover:border-[#C4F041] group-hover:bg-[#C4F041] group-hover:text-black">
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3.5 rounded-[20px] border border-white/12 bg-[#161615]/75 p-5 backdrop-blur-md">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[#C4F041]">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="space-y-1.5 text-[12px] text-white/55">
                  <p className="font-semibold text-[#F0F0F0]">
                    Strict Multi-Campus Isolation Enforced
                  </p>
                  <p className="leading-relaxed">
                    Only one Central Lab Manager holds global cross-campus authority. Lab
                    Managers, Instructors, and Students are automatically scoped to their
                    assigned campus at the API and database layers.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] font-medium text-[#C4F041]">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> HTTP-only session
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Live SSE updates
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
