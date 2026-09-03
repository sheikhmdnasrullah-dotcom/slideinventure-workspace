import { getSessionUser } from "@/lib/appwrite/auth";
import { ApiError, toJson } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { validate } from "@/lib/api/validation";
import { z } from "zod";
import { NextRequest } from "next/server";
import {
  createGroup,
  createTemplate,
  createAndLaunchCampaign,
  ensureTrackingLink,
  GophishError,
} from "@/lib/gophish";

const SEND_DELAY_MS = 4000;

const RecipientSchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

const SendSchema = z.object({
  recipients: z.array(RecipientSchema).min(1).max(500),
  sendingProfileName: z.string().min(1),
  landingPageName: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return ApiError.unauthorized().toResponse();

  const limit = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return ApiError.rateLimited().toResponse();

  const body = await request.json().catch(() => ({}));
  let recipients: z.infer<typeof SendSchema>["recipients"];
  let sendingProfileName: string;
  let landingPageName: string;
  try {
    const validated = validate(SendSchema, body);
    recipients = validated.data.recipients;
    sendingProfileName = validated.data.sendingProfileName;
    landingPageName = validated.data.landingPageName;
  } catch (error) {
    return toJson(error);
  }

  const campaignUrl = process.env.GOPHISH_CAMPAIGN_URL;
  if (!campaignUrl) {
    return ApiError.badRequest(
      "GOPHISH_NOT_CONFIGURED",
      "GOPHISH_CAMPAIGN_URL is not set on the server."
    ).toResponse();
  }

  const results: Array<{
    email: string;
    firstName: string;
    lastName: string;
    success: boolean;
    campaignId?: string;
    error?: string;
  }> = [];

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const timestamp = Date.now();
    const groupName = `custom-${recipient.email}-${timestamp}`;
    const templateName = `custom-${recipient.email}-${timestamp}`;
    const campaignName = `custom-${recipient.email}-${timestamp}`;

    try {
      await createGroup(groupName, [
        {
          email: recipient.email,
          first_name: recipient.firstName,
          last_name: recipient.lastName,
        },
      ]);

      await createTemplate(
        templateName,
        recipient.subject,
        ensureTrackingLink(recipient.message),
        ensureTrackingLink(recipient.message)
      );

      const campaign = await createAndLaunchCampaign({
        name: campaignName,
        templateName,
        groupName,
        sendingProfileName,
        landingPageName,
        url: campaignUrl,
      });

      results.push({
        email: recipient.email,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        success: true,
        campaignId: campaign.id,
      });
    } catch (error) {
      // Log failure WITHOUT ever logging the API key (it is only sent via header).
      const message =
        error instanceof GophishError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
      console.error(
        `[gophish] send failed for ${recipient.email} (campaign ${campaignName}): ${message}`
      );
      results.push({
        email: recipient.email,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        success: false,
        error: message,
      });
    }

    // Pause between recipients to avoid burst-sending (skip after the last one).
    if (i < recipients.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return Response.json({
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  });
}
