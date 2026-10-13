import "server-only";

import fs from "fs";
import path from "path";

import { BusinessProfileSchema, type BusinessProfile } from "./schema";

// File-backed business profile. Single-install deployments keep exactly one
// profile; writes are atomic (tmp + rename) so a crash can never corrupt it.
// Agents and prompts read through getBusinessProfile() — never the file.

const DATA_DIR = path.join(process.cwd(), ".data");
const PROFILE_FILE = path.join(DATA_DIR, "business-profile.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getBusinessProfile(): BusinessProfile | null {
  try {
    ensureDir();
    if (!fs.existsSync(PROFILE_FILE)) return null;
    const parsed = BusinessProfileSchema.safeParse(
      JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8"))
    );
    if (!parsed.success) {
      console.error("Business profile failed validation:", parsed.error.issues);
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.error("Failed to read business profile:", err);
    return null;
  }
}

/** True once the owner has completed the intake form at least once. */
export function isIntakeComplete(): boolean {
  const profile = getBusinessProfile();
  return (
    profile !== null &&
    profile.businessName.trim().length > 0 &&
    profile.offers.length > 0
  );
}

/** Validate + persist. Throws a ZodError on invalid input (API maps to 400). */
export function saveBusinessProfile(input: unknown): BusinessProfile {
  ensureDir();
  const profile = BusinessProfileSchema.parse(input);
  profile.updatedAt = new Date().toISOString();
  const tmp = `${PROFILE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(profile, null, 2), "utf-8");
  fs.renameSync(tmp, PROFILE_FILE);
  return profile;
}

/**
 * Prompt-ready business context for research/personalization agents.
 * Empty string when no profile exists — callers must handle that case by
 * skipping offer-fit commentary, never by inventing business facts.
 */
export function buildBusinessContext(): string {
  const profile = getBusinessProfile();
  if (!profile) return "";
  const lines = [
    `Business: ${profile.businessName}${profile.website ? ` (${profile.website})` : ""}`,
  ];
  if (profile.description) lines.push(`What we do: ${profile.description}`);
  for (const offer of profile.offers) {
    const detail = [offer.description, offer.idealOutcome ? `Ideal outcome: ${offer.idealOutcome}` : ""]
      .filter(Boolean)
      .join(" ");
    lines.push(`Offer — ${offer.name}${detail ? `: ${detail}` : ""}`);
  }
  const icp = profile.icp;
  const parts = [
    icp.titles.length ? `titles: ${icp.titles.join("; ")}` : "",
    icp.industries.length ? `industries: ${icp.industries.join("; ")}` : "",
    icp.companySizes.length ? `company sizes: ${icp.companySizes.join("; ")}` : "",
    icp.geographies.length ? `geographies: ${icp.geographies.join("; ")}` : "",
    icp.painPoints.length ? `pain points: ${icp.painPoints.join("; ")}` : "",
  ].filter(Boolean);
  if (parts.length) lines.push(`Ideal customer: ${parts.join(" | ")}`);
  if (icp.disqualifiers.length)
    lines.push(`Do NOT pursue: ${icp.disqualifiers.join("; ")}`);
  return lines.join("\n");
}
