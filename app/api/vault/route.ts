import { createServiceClient, getSessionUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery, validate } from "@/lib/api/validation";
import { z } from "zod";
import { SecretVaultEntrySchema } from "@/lib/api/schemas";
import { encryptSecret } from "@/lib/vault/crypto";
import { NextRequest } from "next/server";

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
});

const CreateSchema = SecretVaultEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  iv: true,
  keyVersion: true,
});

export async function GET(request: NextRequest) {
  const user = getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);
  const supabase = createServiceClient();

  let q = supabase
    .from("secret_vault_entries")
    .select("id, name, category, service_name, username, secret_type, url, notes, tags, expires_at, created_by, created_at, updated_at", { count: "exact" });

  if (query.data.category) q = q.eq("category", query.data.category);
  if (query.data.search) q = q.or(`name.ilike.%${query.data.search}%,service_name.ilike.%${query.data.search}%,username.ilike.%${query.data.search}%`);

  const from = (query.data.page - 1) * query.data.pageSize;
  const to = from + query.data.pageSize - 1;

  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, to);

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({
    data: data ?? [],
    total: count ?? 0,
    page: query.data.page,
    pageSize: query.data.pageSize,
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  const validated = validate(CreateSchema, body);

  const secretPlaintext = validated.data.encryptedValue;
  if (!secretPlaintext || secretPlaintext.trim() === "") {
    return ApiError.badRequest("VALIDATION_ERROR", "Secret value is required").toResponse();
  }

  const { encrypted, iv } = encryptSecret(secretPlaintext);

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from("secret_vault_entries").insert({
    id,
    name: validated.data.name,
    category: validated.data.category ?? null,
    service_name: validated.data.serviceName ?? null,
    username: validated.data.username ?? null,
    secret_type: validated.data.secretType,
    url: validated.data.url ?? null,
    notes: validated.data.notes ?? null,
    tags: validated.data.tags ?? [],
    encrypted_value: encrypted,
    iv,
    key_version: 1,
    expires_at: validated.data.expiresAt ?? null,
    created_by: user.email ?? null,
    created_at: now,
    updated_at: now,
  });

  if (error) return ApiError.internal("DB_ERROR", error.message).toResponse();

  return Response.json({ id }, { status: 201 });
}
