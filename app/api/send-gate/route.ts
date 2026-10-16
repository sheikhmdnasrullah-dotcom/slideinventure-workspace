import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError } from "@/lib/api/errors";
import { getSendGateStatus } from "@/lib/send-gate";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const status = await getSendGateStatus();
  return NextResponse.json(status);
}
