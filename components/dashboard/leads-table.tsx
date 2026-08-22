"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { flexRender } from "@tanstack/react-table";
import {
  type LegacyColumnDef as ColumnDef,
  type LegacyRow as Row,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy";
import { Loader2, Plus, Save, Search, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const emptyForm = {
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
};

const statusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "new":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "contacted":
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "qualified":
    case "won":
      return "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400";
    case "lost":
      return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "border-border text-foreground";
  }
};

const exactFilter = (row: Row<Lead>, columnId: string, value: string) =>
  row.getValue(columnId) === value;

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilterValue, setStatusFilterValue] = useState("");
  const [sourceFilterValue, setSourceFilterValue] = useState("");

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
      setForm(emptyForm);
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

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        id: "contact",
        accessorFn: (lead) => `${lead.first_name} ${lead.last_name} ${lead.email}`,
        header: "Contact",
        cell: ({ row }) => {
          const lead = row.original;
          const initials =
            `${lead.first_name?.[0] ?? ""}${lead.last_name?.[0] ?? ""}`.toUpperCase();
          return (
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">
                  {lead.first_name} {lead.last_name}
                </span>
                <span className="text-sm text-muted-foreground">{lead.email}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "company",
        accessorFn: (lead) => lead.company ?? "",
        header: "Company",
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{lead.company || "—"}</span>
              {lead.job_title && (
                <span className="text-sm text-muted-foreground">{lead.job_title}</span>
              )}
            </div>
          );
        },
      },
      {
        id: "phone",
        accessorFn: (lead) => lead.phone ?? "",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.phone || "—"}</span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <span className="text-sm">{row.getValue("source")}</span>,
        filterFn: exactFilter,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge variant="outline" className={statusColor(status)}>
              {status}
            </Badge>
          );
        },
        filterFn: exactFilter,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleDelete(row.original.id)}
            disabled={loading}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Delete lead</span>
          </Button>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [loading]
  );

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const lead = row.original as Lead;
      const haystack = `${lead.first_name} ${lead.last_name} ${lead.email} ${lead.company ?? ""}`.toLowerCase();
      return haystack.includes(String(filterValue).toLowerCase());
    },
    state: { globalFilter },
  });

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source))).filter(Boolean),
    [leads]
  );
  const statuses = useMemo(
    () => Array.from(new Set(leads.map((l) => l.status))).filter(Boolean),
    [leads]
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {leads.length}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-3.5" /> Add Lead
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="status-filter" className="text-sm font-medium">
            Status
          </Label>
          <Select
            value={statusFilterValue}
            onValueChange={(value) => {
              const v = value === "all" ? "" : (value ?? "");
              setStatusFilterValue(v);
              table.getColumn("status")?.setFilterValue(v || undefined);
            }}
          >
            <SelectTrigger id="status-filter" className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-filter" className="text-sm font-medium">
            Source
          </Label>
          <Select
            value={sourceFilterValue}
            onValueChange={(value) => {
              const v = value === "all" ? "" : (value ?? "");
              setSourceFilterValue(v);
              table.getColumn("source")?.setFilterValue(v || undefined);
            }}
          >
            <SelectTrigger id="source-filter" className="w-full">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No leads yet. Click &quot;Add Lead&quot; to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Lead</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 overflow-y-auto px-4">
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
              className="min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            />
            <SheetFooter className="px-0">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Save className="mr-1 size-3.5" />
                )}
                Save Lead
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
