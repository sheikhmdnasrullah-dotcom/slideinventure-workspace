import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import {  ApiError , toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { sendMail } from "@/lib/mail/smtp";
import { recordAudit } from "@/lib/api/audit";

const SendSchema = z.object({
  account: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => null);
  if (!body) return ApiError.badRequest("INVALID_BODY", "Invalid JSON body").toResponse();

  const validated = validate(SendSchema, body);

  try {
    const result = await sendMail(validated.data.account, {
      to: validated.data.to,
      subject: validated.data.subject,
      body: validated.data.body,
      inReplyTo: validated.data.inReplyTo,
      references: validated.data.references,
    });

    await recordAudit({
      table: "emails",
      recordId: result.messageId,
      action: "send",
      metadata: { to: validated.data.to, subject: validated.data.subject, account: validated.data.account },
      actor: { userEmail: user.email ?? undefined, userId: user.id },
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    return ApiError.internal("SEND_ERROR", err instanceof Error ? err.message : "Failed to send message").toResponse();
  }
}
