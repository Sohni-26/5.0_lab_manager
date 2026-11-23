import crypto from "crypto";
import { prisma, type DbClient } from "@/lib/prisma";
import {
  assertCampusScope,
  assertRole,
  getEffectiveCampusScope,
  requireUserCampusId,
} from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import { realtimeEventBus } from "@/lib/realtime/event-bus";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AuthUserDTO,
  IssueCategory,
  IssueTicketDTO,
  PaginationMeta,
  TicketCommentDTO,
  TicketPriority,
  TicketStatus,
  UserRole,
} from "@/types/contracts";

function generateTicketCode(campusCode: string): string {
  const short = crypto.randomBytes(3).toString("hex").toUpperCase();
  const year = new Date().getFullYear();
  return `TKT-${year}-${campusCode}-${short}`;
}

const TICKET_INCLUDE = {
  campus: { select: { id: true, code: true, name: true } },
  createdBy: {
    select: { id: true, fullName: true, email: true, role: true },
  },
  assignedTo: { select: { id: true, fullName: true, email: true } },
  item: { select: { id: true, code: true, name: true } },
  comments: {
    include: {
      author: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicketToDTO(t: any): IssueTicketDTO {
  return {
    id: t.id,
    ticketCode: t.ticketCode,
    campusId: t.campusId,
    createdById: t.createdById,
    assignedToId: t.assignedToId ?? null,
    itemId: t.itemId ?? null,
    category: t.category as IssueCategory,
    priority: t.priority as TicketPriority,
    status: t.status as TicketStatus,
    title: t.title,
    description: t.description,
    attachmentUrls: t.attachmentUrls ?? [],
    resolutionNotes: t.resolutionNotes ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
    campus: t.campus,
    createdBy: {
      id: t.createdBy.id,
      fullName: t.createdBy.fullName,
      email: t.createdBy.email,
      role: t.createdBy.role as UserRole,
    },
    assignedTo: t.assignedTo ?? null,
    item: t.item ?? null,
    comments: (t.comments ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any): TicketCommentDTO => ({
        id: c.id,
        ticketId: c.ticketId,
        authorId: c.authorId,
        body: c.body,
        attachmentUrls: c.attachmentUrls ?? [],
        createdAt: c.createdAt.toISOString(),
        author: {
          id: c.author.id,
          fullName: c.author.fullName,
          role: c.author.role as UserRole,
        },
      })
    ),
  };
}

export async function listIssueTickets(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: {
    campusId?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: IssueCategory;
  } = {},
  db: DbClient = prisma
): Promise<{ data: IssueTicketDTO[]; meta: PaginationMeta }> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER", "INSTRUCTOR"],
    "Students do not have access to operational issue tickets"
  );

  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};
  if (effectiveCampusId) {
    where.campusId = effectiveCampusId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.category) {
    where.category = filters.category;
  }
  if (pagination.search) {
    where.OR = [
      { ticketCode: { contains: pagination.search, mode: "insensitive" } },
      { title: { contains: pagination.search, mode: "insensitive" } },
      { description: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  const orderByField = pagination.sortBy ?? "createdAt";
  const orderBy = { [orderByField]: pagination.sortOrder };

  const [tickets, total] = await Promise.all([
    db.issueTicket.findMany({
      where,
      include: TICKET_INCLUDE,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.issueTicket.count({ where }),
  ]);

  return {
    data: tickets.map(mapTicketToDTO),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getIssueTicketById(
  actor: AuthUserDTO,
  ticketId: string,
  db: DbClient = prisma
): Promise<IssueTicketDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER", "INSTRUCTOR"],
    "Students do not have access to issue tickets"
  );

  const ticket = await db.issueTicket.findUnique({
    where: { id: ticketId },
    include: TICKET_INCLUDE,
  });
  if (!ticket) {
    throw new NotFoundError(`Issue ticket '${ticketId}' not found`);
  }

  assertCampusScope(actor, ticket.campusId, "view this issue ticket");
  return mapTicketToDTO(ticket);
}

export async function createIssueTicket(
  actor: AuthUserDTO,
  input: {
    category: IssueCategory;
    priority?: TicketPriority;
    title: string;
    description: string;
    itemId?: string | null;
    attachmentUrls?: string[];
  },
  db: DbClient = prisma
): Promise<IssueTicketDTO> {
  assertRole(
    actor,
    ["INSTRUCTOR"],
    "Only Instructors can raise operational lab issue tickets"
  );
  const campusId = requireUserCampusId(actor);

  const campus = await db.campus.findUnique({ where: { id: campusId } });
  if (!campus) {
    throw new NotFoundError("Assigned campus not found");
  }

  if (input.itemId) {
    const item = await db.item.findUnique({ where: { id: input.itemId } });
    if (!item) {
      throw new NotFoundError(`Item '${input.itemId}' not found`);
    }
  }

  const ticketCode = generateTicketCode(campus.code);

  const created = await db.$transaction(async (tx) => {
    const ticket = await tx.issueTicket.create({
      data: {
        ticketCode,
        campusId,
        createdById: actor.id,
        itemId: input.itemId ?? null,
        category: input.category,
        priority: input.priority ?? "MEDIUM",
        status: "OPEN",
        title: input.title.trim(),
        description: input.description.trim(),
        attachmentUrls: input.attachmentUrls ?? [],
      },
      include: TICKET_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId,
      action: "ISSUE_TICKET_CREATED",
      entityType: "IssueTicket",
      entityId: ticket.id,
      newState: {
        ticketCode,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
      },
    });

    return ticket;
  });

  realtimeEventBus.publish({
    type: "ticket.created",
    campusId,
    entityType: "IssueTicket",
    entityId: created.id,
    actorId: actor.id,
    summary: `New ${created.priority} issue ticket ${created.ticketCode}: ${created.title}`,
  });

  return mapTicketToDTO(created);
}

export async function updateIssueTicket(
  actor: AuthUserDTO,
  ticketId: string,
  input: {
    status?: TicketStatus;
    assignedToId?: string | null;
    priority?: TicketPriority;
    resolutionNotes?: string | null;
  },
  db: DbClient = prisma
): Promise<IssueTicketDTO> {
  assertRole(
    actor,
    ["LAB_MANAGER"],
    "Only a Campus Lab Manager can update, assign, or resolve issue tickets"
  );

  const existing = await db.issueTicket.findUnique({
    where: { id: ticketId },
  });
  if (!existing) {
    throw new NotFoundError(`Issue ticket '${ticketId}' not found`);
  }

  assertCampusScope(
    actor,
    existing.campusId,
    "update issue tickets for another campus"
  );

  if (input.assignedToId) {
    const assignee = await db.user.findUnique({
      where: { id: input.assignedToId },
    });
    if (
      !assignee ||
      assignee.campusId !== existing.campusId ||
      assignee.role !== "LAB_MANAGER" ||
      assignee.status !== "ACTIVE"
    ) {
      throw new BadRequestError(
        "Assignee must be an active Lab Manager from the same campus"
      );
    }
  }

  const nextStatus =
    input.status ??
    (input.assignedToId && existing.status === "OPEN"
      ? "ASSIGNED"
      : existing.status);

  const resolvedAt =
    nextStatus === "RESOLVED" || nextStatus === "CLOSED"
      ? existing.resolvedAt ?? new Date()
      : nextStatus === "REOPENED" || nextStatus === "IN_PROGRESS"
        ? null
        : existing.resolvedAt;

  const updated = await db.$transaction(async (tx) => {
    const ticket = await tx.issueTicket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        ...(input.assignedToId !== undefined
          ? { assignedToId: input.assignedToId }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.resolutionNotes !== undefined
          ? { resolutionNotes: input.resolutionNotes }
          : {}),
        resolvedAt,
      },
      include: TICKET_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: existing.campusId,
      action: "ISSUE_TICKET_UPDATED",
      entityType: "IssueTicket",
      entityId: ticket.id,
      previousState: {
        status: existing.status,
        priority: existing.priority,
        assignedToId: existing.assignedToId,
      },
      newState: {
        status: ticket.status,
        priority: ticket.priority,
        assignedToId: ticket.assignedToId,
      },
    });

    return ticket;
  });

  realtimeEventBus.publish({
    type: "ticket.updated",
    campusId: existing.campusId,
    entityType: "IssueTicket",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Ticket ${updated.ticketCode} updated to ${updated.status}`,
  });

  return mapTicketToDTO(updated);
}

export async function addTicketComment(
  actor: AuthUserDTO,
  ticketId: string,
  input: { body: string; attachmentUrls?: string[] },
  db: DbClient = prisma
): Promise<IssueTicketDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER", "INSTRUCTOR"],
    "Students cannot comment on operational issue tickets"
  );

  const ticket = await db.issueTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new NotFoundError(`Issue ticket '${ticketId}' not found`);
  }

  assertCampusScope(actor, ticket.campusId, "comment on this issue ticket");

  const updatedTicket = await db.$transaction(async (tx) => {
    const c = await tx.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: actor.id,
        body: input.body.trim(),
        attachmentUrls: input.attachmentUrls ?? [],
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: ticket.campusId,
      action: "TICKET_COMMENT_ADDED",
      entityType: "IssueTicket",
      entityId: ticket.id,
      metadata: { commentId: c.id },
    });

    return tx.issueTicket.findUnique({
      where: { id: ticket.id },
      include: TICKET_INCLUDE,
    });
  });

  realtimeEventBus.publish({
    type: "ticket.updated",
    campusId: ticket.campusId,
    entityType: "IssueTicket",
    entityId: ticket.id,
    actorId: actor.id,
    summary: `New comment added to ticket ${ticket.ticketCode}`,
  });

  return mapTicketToDTO(updatedTicket);
}
