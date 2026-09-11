import type { Response } from "express";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "WORKSPACE_REQUIRED"
  | "WORKSPACE_FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "WHATSAPP_SERVICE_ERROR"
  | "BOT_SERVICE_ERROR"
  | "EMPTY_MESSAGE";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    status: number;
    code: ApiErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function paginated(
  res: Response,
  data: unknown[],
  params: { page: number; pageSize: number; total: number },
) {
  const totalPages = Math.max(1, Math.ceil(params.total / params.pageSize));
  return res.json({
    ok: true,
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: params.total,
      totalPages,
    },
  });
}

export function empty(res: Response) {
  return res.status(204).end();
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
      details: details ?? {},
    },
  });
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: `El campo ${name} es requerido.`,
      details: { field: name },
    });
  }
  return value.trim();
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(query.pageSize ?? 20) || 20),
  );
  return { page, pageSize };
}

export function slicePage<T>(
  items: T[],
  params: { page: number; pageSize: number },
) {
  return items.slice(
    (params.page - 1) * params.pageSize,
    params.page * params.pageSize,
  );
}
