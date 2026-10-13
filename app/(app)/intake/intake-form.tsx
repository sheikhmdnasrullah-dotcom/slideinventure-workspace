"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyProfile,
  type BusinessProfile,
  type Icp,
} from "@/lib/intake/schema";

type IcpListKey = {
  [K in keyof Icp]: Icp[K] extends string[] ? K : never;
}[keyof Icp];

const ICP_LISTS: { key: IcpListKey; label: string; placeholder: string }[] = [
  { key: "titles", label: "Job titles", placeholder: "e.g. Founder, Head of Sales" },
  { key: "industries", label: "Industries", placeholder: "e.g. B2B SaaS, Agencies" },
  { key: "companySizes", label: "Company sizes", placeholder: "e.g. 11–50 people" },
  { key: "geographies", label: "Geographies", placeholder: "e.g. US, UK, remote-first" },
  { key: "painPoints", label: "Pain points you solve", placeholder: "e.g. No-shows kill their pipeline" },
  { key: "disqualifiers", label: "Who to skip", placeholder: "e.g. Enterprises over 1000 people" },
];

function ChipList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-64 truncate">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                className="hover:text-destructive rounded px-1"
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function IntakeForm({
  initial,
  completed,
}: {
  initial: BusinessProfile | null;
  completed: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BusinessProfile>(initial ?? emptyProfile());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(completed);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => null)) as {
        profile?: BusinessProfile;
        details?: { issues?: { path: string; message: string }[] };
        message?: string;
      } | null;
      if (!res.ok || !data?.profile) {
        const issues = data?.details?.issues ?? [];
        setErrors(
          issues.length
            ? issues.map((i) => `${i.path || "form"}: ${i.message}`)
            : [data?.message || "Save failed — please retry."]
        );
        toast.error("Intake did not save — fix the listed fields.");
        return;
      }
      setForm(data.profile);
      setDone(true);
      toast.success("Business profile saved.");
    } catch {
      setErrors(["Network error — is the dashboard backend reachable?"]);
      toast.error("Intake did not save — network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Business setup</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tell SlideIn about your business once. Research agents read this
            profile to find matching prospects and judge offer-fit.
          </p>
        </div>
        {done && <Badge variant="secondary">Saved</Badge>}
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">Please fix these fields:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your business</CardTitle>
          <CardDescription>Identity and context agents use when writing about you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="businessName">Business name *</Label>
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="Acme Outreach Co."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                placeholder="you@company.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">What does the business do?</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Two or three sentences agents can quote when describing you."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offers</CardTitle>
          <CardDescription>What you sell. Agents match these against each prospect&apos;s needs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {form.offers.map((offer, i) => (
            <div key={i} className="space-y-3">
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Offer {i + 1}</p>
                {form.offers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set("offers", form.offers.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`offer-name-${i}`}>Name *</Label>
                <Input
                  id={`offer-name-${i}`}
                  value={offer.name}
                  onChange={(e) => {
                    const next = [...form.offers];
                    next[i] = { ...next[i], name: e.target.value };
                    set("offers", next);
                  }}
                  placeholder="Done-for-you cold email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`offer-desc-${i}`}>Description</Label>
                <Textarea
                  id={`offer-desc-${i}`}
                  rows={2}
                  value={offer.description}
                  onChange={(e) => {
                    const next = [...form.offers];
                    next[i] = { ...next[i], description: e.target.value };
                    set("offers", next);
                  }}
                  placeholder="What the buyer gets, in plain terms."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`offer-outcome-${i}`}>Ideal outcome for the buyer</Label>
                <Input
                  id={`offer-outcome-${i}`}
                  value={offer.idealOutcome}
                  onChange={(e) => {
                    const next = [...form.offers];
                    next[i] = { ...next[i], idealOutcome: e.target.value };
                    set("offers", next);
                  }}
                  placeholder="e.g. 10 booked calls a month"
                />
              </div>
            </div>
          ))}
          {form.offers.length < 10 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                set("offers", [...form.offers, { name: "", description: "", idealOutcome: "" }])
              }
            >
              Add another offer
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ideal customer</CardTitle>
          <CardDescription>Who to pursue — and who to skip. Used to focus prospect research.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {ICP_LISTS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <ChipList
                values={form.icp[key]}
                placeholder={placeholder}
                onChange={(next) => set("icp", { ...form.icp, [key]: next })}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Anything else agents should know</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Positioning, proof points, constraints."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : done ? "Save changes" : "Save and continue"}
        </Button>
        <p className="text-muted-foreground text-sm">
          Stored on this server only — never sent anywhere until you run outreach.
        </p>
      </div>

      {done && (
        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
            <CardDescription>Your profile is saved. Research now judges every prospect against it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push("/lead-research")}>
              Research prospects
            </Button>
            <Button variant="outline" onClick={() => router.push("/leads")}>
              Open opportunities
            </Button>
            <Button variant="outline" onClick={() => router.push("/cold-outreach")}>
              Plan outreach
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
