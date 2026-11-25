import type { PaginationMeta } from "@/types/contracts";

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
  sortBy?: string;
  sortOrder: "asc" | "desc";
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 250;

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options?: {
    defaultPageSize?: number;
    maxPageSize?: number;
    defaultSortBy?: string;
    defaultSortOrder?: "asc" | "desc";
    allowedSortFields?: string[];
  }
): PaginationParams {
  const rawPage = Number(searchParams.get("page") ?? DEFAULT_PAGE);
  const defaultSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxSize = options?.maxPageSize ?? MAX_PAGE_SIZE;
  const rawPageSize = Number(searchParams.get("pageSize") ?? defaultSize);

  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : DEFAULT_PAGE;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), maxSize)
      : defaultSize;

  const rawSearch = searchParams.get("search")?.trim();
  const search = rawSearch && rawSearch.length > 0 ? rawSearch : undefined;

  const rawSortBy = searchParams.get("sortBy")?.trim();
  let sortBy = options?.defaultSortBy;
  if (rawSortBy) {
    if (
      !options?.allowedSortFields ||
      options.allowedSortFields.includes(rawSortBy)
    ) {
      sortBy = rawSortBy;
    }
  }

  const rawSortOrder = searchParams.get("sortOrder")?.toLowerCase();
  const sortOrder: "asc" | "desc" =
    rawSortOrder === "asc" || rawSortOrder === "desc"
      ? rawSortOrder
      : options?.defaultSortOrder ?? "desc";

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    search,
    sortBy,
    sortOrder,
  };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function parseBooleanParam(
  value: string | null
): boolean | undefined {
  if (value === null || value === "") return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}
