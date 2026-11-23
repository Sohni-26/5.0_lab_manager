import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import type {
  ApiErrorResponse,
  ApiSuccess,
  PaginationMeta,
} from "@/types/contracts";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, string[]> | unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details?: Record<string, string[]> | unknown
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    details?: Record<string, string[]> | unknown
  ) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Database service is currently unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

export function apiSuccess<T>(
  data: T,
  meta?: PaginationMeta,
  status = 200
): NextResponse<ApiSuccess<T>> {
  const payload: ApiSuccess<T> = meta
    ? { success: true, data, meta }
    : { success: true, data };
  return NextResponse.json(payload, { status });
}

export function formatZodError(err: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!details[key]) {
      details[key] = [];
    }
    details[key].push(issue.message);
  }
  return details;
}

export function handleApiError(err: unknown): NextResponse<ApiErrorResponse> {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      { status: err.statusCode }
    );
  }

  if (err instanceof ZodError) {
    const details = formatZodError(err);
    const firstIssue = err.issues[0];
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: firstIssue
            ? `${firstIssue.path.join(".") || "Input"}: ${firstIssue.message}`
            : "Invalid request payload",
          details,
        },
      },
      { status: 422 }
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(", ")
        : String(err.meta?.target ?? "unique field");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: `A record with this ${target} already exists`,
            details: { target },
          },
        },
        { status: 409 }
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Requested record was not found",
          },
        },
        { status: 404 }
      );
    }
    if (err.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message:
              "Operation failed due to a related record reference constraint",
          },
        },
        { status: 409 }
      );
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message:
            "Unable to connect to PostgreSQL database. Please ensure PostgreSQL is running and migrations/seed have been applied.",
        },
      },
      { status: 503 }
    );
  }

  if (err instanceof SyntaxError && err.message.includes("JSON")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid JSON request body",
        },
      },
      { status: 400 }
    );
  }

  console.error("[CampusLab API Error]", err);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected internal server error occurred",
      },
    },
    { status: 500 }
  );
}
