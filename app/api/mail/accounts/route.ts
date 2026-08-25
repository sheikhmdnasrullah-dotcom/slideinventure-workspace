import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { getPublicAccounts, createDbAccount } from "@/lib/mail/accounts";
import { NextRequest } from "next/server";

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  provider: z.enum(["imap_smtp", "google", "microsoft"]),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().positive(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
  password: z.string().min(1),
});

export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(_request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  try {
    const accounts = await getPublicAccounts();
    return Response.json(accounts);
  } catch {
    return ApiError.internal("ACCOUNTS_ERROR", "Failed to load mail accounts").toResponse();
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  if (validated.data.provider !== "imap_smtp") {
    return ApiError.badRequest("NOT_SUPPORTED", "Not yet supported").toResponse();
  }

  try {
    const { id } = await createDbAccount({
      email: validated.data.email,
      name: validated.data.name,
      imapHost: validated.data.imapHost,
      imapPort: validated.data.imapPort,
      smtpHost: validated.data.smtpHost,
      smtpPort: validated.data.smtpPort,
      password: validated.data.password,
    });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return ApiError.internal("DB_ERROR", err instanceof Error ? err.message : "Failed to add account").toResponse();
  }
}
