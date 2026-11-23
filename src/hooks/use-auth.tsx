"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, isBackendUnavailableError } from "@/lib/api-client";
import { DEMO_USERS } from "@/lib/demo-data";
import { ROLE_DASHBOARD_ROUTES, type AuthUserDTO, type UserRole } from "@/types/contracts";

interface AuthContextValue {
  user: AuthUserDTO | null;
  loading: boolean;
  isDemoMode: boolean;
  selectedCampusId: string;
  setSelectedCampusId: (campusId: string) => void;
  refreshUser: () => Promise<void>;
  login: (payload: { email?: string; userId?: string; password?: string }) => Promise<AuthUserDTO>;
  logout: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER_STORAGE_KEY = "campuslab_demo_user_id";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient.auth.me();
      setUser(res.data);
      setIsDemoMode(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(DEMO_USER_STORAGE_KEY);
      }
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        // Check if user previously entered demo preview mode
        if (typeof window !== "undefined") {
          const demoId = window.sessionStorage.getItem(DEMO_USER_STORAGE_KEY);
          if (demoId) {
            const found = DEMO_USERS.find((u) => u.id === demoId) ?? DEMO_USERS[0];
            setUser(found);
            setIsDemoMode(true);
          } else {
            setUser(null);
            setIsDemoMode(true);
          }
        }
      } else {
        setUser(null);
        setIsDemoMode(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: { email?: string; userId?: string; password?: string }) => {
      try {
        const res = await apiClient.auth.mockLogin(payload);
        setUser(res.data);
        setIsDemoMode(false);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(DEMO_USER_STORAGE_KEY);
        }
        return res.data;
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          // Graceful fallback into preview mode when DB isn't running
          const emailLower = payload.email?.trim().toLowerCase();
          const demoUser =
            DEMO_USERS.find(
              (u) =>
                (payload.userId && u.id === payload.userId) ||
                (emailLower &&
                  (u.email.toLowerCase() === emailLower ||
                    u.institutionalId.toLowerCase() === emailLower))
            ) ?? DEMO_USERS[0];
          setUser(demoUser);
          setIsDemoMode(true);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(DEMO_USER_STORAGE_KEY, demoUser.id);
          }
          return demoUser;
        }
        throw err;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.auth.logout();
    } catch {
      // ignore if backend offline
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(DEMO_USER_STORAGE_KEY);
    }
    setUser(null);
    setSelectedCampusId("");
    router.push("/login");
  }, [router]);

  const switchDemoRole = useCallback(
    (role: UserRole) => {
      const target = DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[0];
      setUser(target);
      setIsDemoMode(true);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(DEMO_USER_STORAGE_KEY, target.id);
      }
      router.push(ROLE_DASHBOARD_ROUTES[target.role]);
    },
    [router]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode,
        selectedCampusId,
        setSelectedCampusId,
        refreshUser,
        login,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
