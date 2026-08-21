"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  job_title?: string;
  phone?: string;
  source: string;
  status: string;
  notes?: string;
  tags?: string[];
  created_at: string;
};

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company: "",
    job_title: "",
    phone: "",
    source: "manual",
    status: "new",
    notes: "",
    tags: "",
  });

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Lead[];
        setLeads(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        toast.error("Failed to save lead");
        return;
      }

      toast.success("Lead saved");
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        company: "",
        job_title: "",
        phone: "",
        source: "manual",
        status: "new",
        notes: "",
        tags: "",
      });
      setShowForm(false);
      await loadLeads();
    } catch {
      toast.error("Failed to save lead");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }

      toast.success("Lead deleted");
      await loadLeads();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          Leads
          <Badge variant="outline" className="text-xs">
            {leads.length}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : <><Plus className="size-3 mr-1" /> Add Lead</>}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="First name"
                  required
                />
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Last name"
                  required
                />
              </div>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company"
                />
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  placeholder="Job title"
                />
              </div>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Source"
                />
                <Input
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  placeholder="Status"
                />
              </div>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Tags (comma-separated)"
              />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                className="w-full min-h-[80px] rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
              />
              <Button type="submit" disabled={saving} className="self-end">
                {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-3 mr-1" />}
                Save Lead
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads yet. Click "Add Lead" to create one.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {lead.first_name} {lead.last_name}
                    </span>
                    <Badge variant="outline" className="border-brand/30 bg-brand-soft text-signal text-xs">
                      {lead.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{lead.email}</span>
                    {lead.company && <span>• {lead.company}</span>}
                    {lead.job_title && <span>• {lead.job_title}</span>}
                  </div>
                  {lead.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(lead.id)}
                  disabled={loading}
                >
                  <Trash2 className="size-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
