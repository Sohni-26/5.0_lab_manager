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
  Loader2,
  ShieldCheck,
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

const ROLE_META: Record<UserRole, { label: string; dot: string }> = {
  CENTRAL_LAB_MANAGER: { label: "Central Lab Manager", dot: "#FA8E66" },
  LAB_MANAGER: { label: "Lab Manager", dot: "#7BB1CC" },
  INSTRUCTOR: { label: "Instructor", dot: "#7EA47E" },
  STUDENT: { label: "Student", dot: "#9BC724" },
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
      className="flex min-h-screen flex-col text-black selection:bg-[#C4F041] selection:text-black"
      style={{
        backgroundColor: "#F2F2EF",
        backgroundImage:
          "radial-gradient(rgba(0, 0, 0, 0.16) 1.15px, transparent 1.15px)",
        backgroundSize: "20px 20px",
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Top Bar */}
      <header className="mx-auto flex w-full max-w-[1160px] items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="inline-flex items-center">
          <LoopsiiWordmark className="h-9 w-auto" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-black/14 bg-white px-4 py-2 text-[14px] font-medium text-black shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-colors hover:border-black/30 hover:bg-[#C4F041]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 items-center justify-center px-5 pb-14 pt-2 sm:px-8">
        <div
          className={
            ENABLE_MOCK_SWITCHER
              ? "grid w-full items-start gap-6 lg:grid-cols-12"
              : "mx-auto w-full max-w-[520px]"
          }
        >
          {/* Left: Sign-In Form Card */}
          <div
            className={`rounded-[28px] border border-black/14 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-10 ${
              ENABLE_MOCK_SWITCHER ? "lg:col-span-6" : ""
            }`}
          >
            <div className="mb-8 space-y-2.5">
              <h1 className="text-[30px] font-medium leading-[1.1] tracking-[-0.03em] text-black sm:text-[34px]">
                Sign in to NxtWave Lab
              </h1>
              <p className="text-[15px] leading-relaxed text-[#5E5E5A]">
                Enter your institutional email or ID to open your role workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-[14px] font-medium text-black"
                >
                  Email or Institutional ID
                </label>
                <input
                  id="email"
                  type="text"
                  placeholder="name@campuslab.edu or STU-0101"
                  className="h-12 w-full rounded-[14px] border border-black/15 bg-[#F7F7F5] px-4 text-[15px] text-black placeholder:text-black/35 transition-colors focus:border-black focus:bg-white focus:outline-none"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-[13px] font-medium text-[#B33C17]">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-[14px] font-medium text-black"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-12 w-full rounded-[14px] border border-black/15 bg-[#F7F7F5] px-4 text-[15px] text-black placeholder:text-black/35 transition-colors focus:border-black focus:bg-white focus:outline-none"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-[13px] font-medium text-[#B33C17]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-[14px] text-[#5E5E5A]">
                  <Checkbox
                    checked={watch("rememberMe")}
                    onCheckedChange={(v) => setValue("rememberMe", Boolean(v))}
                    className="border-black/25 data-[state=checked]:border-black data-[state=checked]:bg-[#C4F041] data-[state=checked]:text-black"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="lp-btn w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="lp-btn_text-wrapper h-[52px] w-full px-6 text-[15px] font-medium tracking-[-0.01em]">
                  <span className="lp-btn_layer lp-btn_layer--sage" />
                  <span className="lp-btn_layer lp-btn_layer--sky" />
                  <span className="lp-btn_layer lp-btn_layer--apricot" />
                  <span className="lp-btn_layer lp-btn_layer--main" />
                  <span className="lp-btn_content inline-flex items-center gap-2">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in to Workspace"
                    )}
                  </span>
                </span>
              </button>
            </form>
          </div>

          {/* Right: Development Role Switcher + Multi-Campus Isolation */}
          {ENABLE_MOCK_SWITCHER && (
            <div className="space-y-5 lg:col-span-6">
              <div className="rounded-[28px] border border-black/14 bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-9">
                <div className="mb-6 space-y-1.5">
                  <h2 className="text-[22px] font-medium tracking-[-0.025em] text-black sm:text-[24px]">
                    Quick workspace access
                  </h2>
                  <p className="text-[14px] leading-relaxed text-[#5E5E5A]">
                    Sign in as any seeded role to inspect permissions, live lab inventory, and
                    approval workflows.
                  </p>
                </div>

                <div className="grid gap-3">
                  {mockUsers.map((opt) => {
                    const isLoading = loadingMockId === opt.id;
                    const roleInfo = ROLE_META[opt.role];
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={Boolean(loadingMockId)}
                        onClick={() => handleQuickLogin(opt)}
                        className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-[18px] border border-black/12 bg-[#F7F7F5] px-4 py-3.5 text-left transition-colors hover:border-black/30 hover:bg-[#F3FBD4] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                            <span className="text-[15px] font-semibold text-black">
                              {opt.fullName}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#3A3A36]">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: roleInfo.dot }}
                                aria-hidden="true"
                              />
                              {roleInfo.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[#5E5E5A]">
                            <span className="truncate">{opt.email}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              {opt.campusCode
                                ? `${opt.campusCode} (${opt.campusName})`
                                : "Global Scope"}
                            </span>
                          </div>
                        </div>

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/12 bg-white text-black transition-colors group-hover:border-black group-hover:bg-[#C4F041]">
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

              <div className="flex items-start gap-3.5 rounded-[22px] border border-black/14 bg-white p-5 shadow-[0_12px_36px_rgba(0,0,0,0.04)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/12 bg-[#F3FBD4] text-black">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-1 text-[14px] text-[#5E5E5A]">
                  <p className="font-semibold text-black">
                    Campus-scoped access
                  </p>
                  <p className="leading-relaxed">
                    Only the Central Lab Manager holds cross-campus authority. Lab Managers,
                    Instructors, and Students are scoped to their assigned campus automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
