import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validateQuery } from "@/lib/api/validation";
import { z } from "zod";
import { listFolders } from "@/lib/mail/imap";

const ListSchema = z.object({
  account: z.string().min(1, "account is required"),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 100, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const query = validateQuery(ListSchema, request.nextUrl.searchParams);

  try {
    const folders = await listFolders(query.data.account);
    return NextResponse.json(folders);
  } catch (err) {
    return ApiError.internal("FOLDERS_ERROR", err instanceof Error ? err.message : "Failed to list folders").toResponse();
  }
}
