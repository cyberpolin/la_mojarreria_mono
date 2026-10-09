import type { Response } from "express";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(params: { status: number; code: string; message: string }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
  }
}

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
) {
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

export function requireString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: `El campo ${name} es requerido.`,
    });
  }
  return value.trim();
}
