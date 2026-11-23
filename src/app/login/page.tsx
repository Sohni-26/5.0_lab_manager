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
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/landing/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RoleBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { DEMO_MOCK_USERS } from "@/lib/demo-data";
import {
  ROLE_DASHBOARD_ROUTES,
  type MockUserOptionDTO,
  type UserRole,
} from "@/types/contracts";

const loginSchema = z.object({
  email: z
    .string()
    .min(3, "Enter your institutional email or ID")
    .trim(),
  password: z.string().min(4, "Password must be at least 4 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ENABLE_MOCK_SWITCHER =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true" ||
  process.env.NODE_ENV !== "production";

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
          // Show one primary user per role + any extras cleanly (up to 6)
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
    <div className="min-h-screen bg-[#F2F1ED] flex flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/">
          <BrandLogo />
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Link>
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 pb-16 pt-2 sm:px-6">
        <div className="grid w-full gap-8 lg:grid-cols-12 items-start">
          {/* Left: Login Form Card */}
          <div className="lg:col-span-6 rounded-3xl border border-[#E6E5E0] bg-white p-7 sm:p-9 shadow-[0_18px_50px_rgba(34,35,33,0.06)]">
            <div className="space-y-2 mb-7">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E9] px-3 py-1 text-xs font-semibold text-[#DA5835]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Institutional Access
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#222321] font-display">
                Welcome back to CampusLab
              </h1>
              <p className="text-sm text-[#72736E]">
                Sign in with your institutional email or ID to open your role workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email or Institutional ID</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="name@campuslab.edu or STU-0101"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs font-medium text-[#D9534F]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <span className="text-xs text-[#72736E]">SSO / Campus Credentials</span>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs font-medium text-[#D9534F]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[#72736E] cursor-pointer">
                  <Checkbox
                    checked={watch("rememberMe")}
                    onCheckedChange={(v) => setValue("rememberMe", Boolean(v))}
                  />
                  <span>Keep me signed in</span>
                </label>
                <span className="text-xs text-[#72736E]">40 Campuses Enabled</span>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to Workspace
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Right: Development-Only Mock Role Switcher */}
          <div className="lg:col-span-6 space-y-5">
            {ENABLE_MOCK_SWITCHER && (
              <div className="rounded-3xl border border-[#E6E5E0] bg-white p-6 sm:p-7 shadow-card">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F26943] mb-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      Development Role Switcher
                    </div>
                    <h2 className="text-lg font-semibold text-[#222321] font-display">
                      One-click workspace access
                    </h2>
                    <p className="text-xs text-[#72736E] mt-0.5">
                      Instantly sign in as any seeded role to inspect permissions, live sheets,
                      and end-to-end approval flows.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {mockUsers.map((opt) => {
                    const isLoading = loadingMockId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={Boolean(loadingMockId)}
                        onClick={() => handleQuickLogin(opt)}
                        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E6E5E0] bg-[#FAF9F6] p-4 text-left transition-all hover:border-[#F26943]/50 hover:bg-[#FFF0E9]/40 cursor-pointer disabled:opacity-60"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[#222321]">
                              {opt.fullName}
                            </span>
                            <RoleBadge role={opt.role} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#72736E]">
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
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E6E5E0] text-[#72736E] group-hover:border-[#F26943] group-hover:bg-[#F26943] group-hover:text-white transition-colors">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[#E6E5E0] bg-[#EAE9E4]/65 p-5 flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#288568] border border-[#E6E5E0]">
                <UserCheck className="h-4.5 w-4.5" />
              </div>
              <div className="text-xs text-[#72736E] space-y-1">
                <p className="font-semibold text-[#222321]">
                  Strict Multi-Campus Isolation Enforced
                </p>
                <p className="leading-relaxed">
                  Only one Central Lab Manager holds global cross-campus authority. Lab
                  Managers, Instructors, and Students are automatically scoped to their
                  assigned campus at the API and database layers.
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] font-medium text-[#288568]">
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
    </div>
  );
}
