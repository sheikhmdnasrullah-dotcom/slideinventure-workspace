import { z } from "zod";

// Shared intake schema (client + server safe — no fs imports here).
// Versioned: bump version + migrate in store.ts if the shape changes.

export const OfferSchema = z.object({
  name: z.string().trim().min(1, "Offer name is required").max(120),
  description: z.string().trim().max(2000).default(""),
  idealOutcome: z.string().trim().max(500).default(""),
});

export const IcpSchema = z.object({
  titles: z.array(z.string().trim().max(120)).max(30).default([]),
  industries: z.array(z.string().trim().max(120)).max(30).default([]),
  companySizes: z.array(z.string().trim().max(120)).max(20).default([]),
  geographies: z.array(z.string().trim().max(120)).max(30).default([]),
  painPoints: z.array(z.string().trim().max(500)).max(30).default([]),
  disqualifiers: z.array(z.string().trim().max(500)).max(30).default([]),
});

export const BusinessProfileSchema = z.object({
  version: z.literal(1).default(1),
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  website: z.string().trim().max(300).default(""),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .default("")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Contact email must be a valid email address",
    }),
  description: z.string().trim().max(4000).default(""),
  offers: z.array(OfferSchema).min(1, "Add at least one offer").max(10),
  icp: IcpSchema.default({
    titles: [],
    industries: [],
    companySizes: [],
    geographies: [],
    painPoints: [],
    disqualifiers: [],
  }),
  notes: z.string().trim().max(4000).default(""),
  updatedAt: z.string().default(""),
});

export type Offer = z.infer<typeof OfferSchema>;
export type Icp = z.infer<typeof IcpSchema>;
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

/** Blank profile used to seed the intake form on fresh installs. */
export function emptyProfile(): BusinessProfile {
  return {
    version: 1,
    businessName: "",
    website: "",
    contactEmail: "",
    description: "",
    offers: [{ name: "", description: "", idealOutcome: "" }],
    icp: {
      titles: [],
      industries: [],
      companySizes: [],
      geographies: [],
      painPoints: [],
      disqualifiers: [],
    },
    notes: "",
    updatedAt: "",
  };
}
