import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma, type DbClient } from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { AuthUserDTO } from "@/types/contracts";

export const SESSION_COOKIE_NAME = "campuslab_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionTokenPayload {
  uid: string;
  iat: number;
  exp: number;
}

export interface AuthProvider {
  readonly name: string;
  getAuthenticatedUser(db?: DbClient): Promise<AuthUserDTO | null>;
  createSessionCookieValue(userId: string): string;
  verifySessionCookieValue(token: string): SessionTokenPayload | null;
}

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    "dev-only-campuslab-session-secret-change-in-production-32chars"
  );
}

export function isMockAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_MOCK_AUTH === "true"
  );
}

export function assertMockAuthEnabled(): void {
  if (!isMockAuthEnabled()) {
    throw new ForbiddenError(
      "Mock authentication is disabled in production environment"
    );
  }
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class MockAuthProvider implements AuthProvider {
  public readonly name = "mock";

  createSessionCookieValue(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionTokenPayload = {
      uid: userId,
      iat: now,
      exp: now + SESSION_MAX_AGE_SECONDS,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url"
    );
    const signature = signPayload(encoded);
    return `${encoded}.${signature}`;
  }

  verifySessionCookieValue(token: string): SessionTokenPayload | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    if (!encoded || !signature) return null;

    const expectedSig = signPayload(encoded);
    if (!constantTimeEqual(signature, expectedSig)) return null;

    try {
      const json = Buffer.from(encoded, "base64url").toString("utf8");
      const parsed = JSON.parse(json) as Partial<SessionTokenPayload>;
      if (
        typeof parsed.uid !== "string" ||
        typeof parsed.exp !== "number" ||
        parsed.exp < Math.floor(Date.now() / 1000)
      ) {
        return null;
      }
      return {
        uid: parsed.uid,
        iat: typeof parsed.iat === "number" ? parsed.iat : 0,
        exp: parsed.exp,
      };
    } catch {
      return null;
    }
  }

  async getAuthenticatedUser(db: DbClient = prisma): Promise<AuthUserDTO | null> {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawCookie) return null;

    const payload = this.verifySessionCookieValue(rawCookie);
    if (!payload) return null;

    // ALWAYS resolve user, role, status, and campus from the server-side DB
    const user = await db.user.findUnique({
      where: { id: payload.uid },
      include: {
        campus: {
          select: { id: true, code: true, name: true, city: true, status: true },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    // Ensure non-central users belong to an active campus
    if (user.role !== "CENTRAL_LAB_MANAGER") {
      if (!user.campusId || !user.campus || user.campus.status !== "ACTIVE") {
        return null;
      }
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      institutionalId: user.institutionalId,
      role: user.role,
      status: user.status,
      campusId: user.campusId,
      campus: user.campus
        ? {
            id: user.campus.id,
            code: user.campus.code,
            name: user.campus.name,
            city: user.campus.city,
          }
        : null,
    };
  }
}

const activeAuthProvider: AuthProvider = new MockAuthProvider();

export function getAuthProvider(): AuthProvider {
  return activeAuthProvider;
}

export async function getSessionUser(
  db: DbClient = prisma
): Promise<AuthUserDTO | null> {
  return activeAuthProvider.getAuthenticatedUser(db);
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = activeAuthProvider.createSessionCookieValue(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function resolveAuthFromRequestCookie(
  rawCookieValue: string | undefined,
  db: DbClient = prisma
): Promise<AuthUserDTO> {
  if (!rawCookieValue) {
    throw new UnauthorizedError("Authentication required");
  }
  const payload = activeAuthProvider.verifySessionCookieValue(rawCookieValue);
  if (!payload) {
    throw new UnauthorizedError("Invalid or expired session");
  }
  const user = await db.user.findUnique({
    where: { id: payload.uid },
    include: {
      campus: {
        select: { id: true, code: true, name: true, city: true, status: true },
      },
    },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new UnauthorizedError("User account is inactive or unavailable");
  }
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    institutionalId: user.institutionalId,
    role: user.role,
    status: user.status,
    campusId: user.campusId,
    campus: user.campus
      ? {
          id: user.campus.id,
          code: user.campus.code,
          name: user.campus.name,
          city: user.campus.city,
        }
      : null,
  };
}
