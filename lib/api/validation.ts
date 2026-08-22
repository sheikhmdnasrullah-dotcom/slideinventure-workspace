
import { z } from "zod";
import { ApiError } from "./errors";

export type Validated<T> = {
  data: T;
};

export function validate<T extends z.ZodType>(schema: T, raw: unknown): Validated<z.infer<T>> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { data: result.data };
  }

  const details = result.error.flatten();
  throw ApiError.badRequest("VALIDATION_ERROR", "Invalid request body", {
    issues: details.fieldErrors,
  });
}

export function validateQuery<T extends z.ZodType>(schema: T, searchParams: URLSearchParams): Validated<z.infer<T>> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    const existing = raw[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing !== undefined) {
      raw[key] = [existing, value];
    } else {
      raw[key] = value;
    }
  }
  return validate(schema, raw);
}
