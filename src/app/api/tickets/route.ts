import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parsePaginationParams } from "@/lib/pagination";
import {
  createTicketSchema,
  issueCategorySchema,
  ticketPrioritySchema,
  ticketStatusSchema,
} from "@/lib/validators/schemas";
import {
  createIssueTicket,
  listIssueTickets,
} from "@/services/ticket.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 20,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      allowedSortFields: ["createdAt", "updatedAt", "priority", "status"],
    });

    const campusId = sp.get("campusId") ?? undefined;
    const rawStatus = sp.get("status");
    const rawPriority = sp.get("priority");
    const rawCategory = sp.get("category");

    const status = rawStatus ? ticketStatusSchema.parse(rawStatus) : undefined;
    const priority = rawPriority
      ? ticketPrioritySchema.parse(rawPriority)
      : undefined;
    const category = rawCategory
      ? issueCategorySchema.parse(rawCategory)
      : undefined;

    const result = await listIssueTickets(actor, pagination, {
      campusId,
      status,
      priority,
      category,
    });
    return apiSuccess(result.data, result.meta);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const body = await request.json();
    const input = createTicketSchema.parse(body);
    const ticket = await createIssueTicket(actor, input);
    return apiSuccess(ticket, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
