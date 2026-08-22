import { NextRequest } from "next/server";

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toResponse(): Response {
    return jsonResponse(
      { error: this.message, code: this.code, details: this.details },
      this.status
    );
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
    const error = new ApiError(429, code, message, retryAfter ? { retryAfter } : undefined);
    return error;
  }

  static internal(code = "INTERNAL_ERROR", message = "Internal server error") {
    return new ApiError(500, code, message);
  }
}

export function toJson(error: unknown): Response {
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  return jsonResponse({ error: message, code: "INTERNAL_ERROR" }, 500);
}
