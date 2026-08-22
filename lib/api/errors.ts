"use server";

import { NextRequest } from "next/server";

export class ApiError extends Response {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(
      JSON.stringify({ error: message, code, details }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    );
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(code = "BAD_REQUEST", message = "Bad request", details?: Record<string, unknown>) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = "UNAUTHORIZED", message = "Unauthorized") {
    return new ApiError(401, code, message);
  }

  static forbidden(code = "FORBIDDEN", message = "Forbidden") {
    return new ApiError(403, code, message);
  }

  static notFound(code = "NOT_FOUND", message = "Resource not found") {
    return new ApiError(404, code, message);
  }

  static conflict(code = "CONFLICT", message = "Conflict", details?: Record<string, unknown>) {
    return new ApiError(409, code, message, details);
  }

  static rateLimited(code = "RATE_LIMITED", message = "Too many requests", retryAfter?: number) {
    const headers = new Headers();
    if (retryAfter) {
      headers.set("Retry-After", String(retryAfter));
    }
    return new ApiError(429, code, message, retryAfter ? { retryAfter } : undefined);
  }

  static internal(code = "INTERNAL_ERROR", message = "Internal server error") {
    return new ApiError(500, code, message);
  }
}

export function toJson(error: unknown): Response {
  if (error instanceof ApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  return new ApiError(500, "INTERNAL_ERROR", message);
}
