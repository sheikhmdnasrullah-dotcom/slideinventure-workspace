"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  type LegacyColumnDef as ColumnDef,
  type LegacyRow as Row,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy"
import { type SortingState, type ColumnFiltersState, flexRender } from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  Download,
  EllipsisVertical,
  Eye,
  FileUp,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import Papa from "papaparse"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnConfigDialog, type LeadColumnConfig } from "./leads-column-config-dialog"
import { CsvImportDialog } from "./leads-csv-import-dialog"

export type Lead = {
  id: string
  first_name: string
  last_name: string
  email: string
  company?: string | null
  job_title?: string | null
  phone?: string | null
  source: string
  status: string
  notes?: string | null
  tags?: string[]
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
}

type LeadFormValues = {
  id?: string
  first_name: string
  last_name: string
  email: string
  company: string
  job_title: string
  phone: string
  source: string
  status: string
  notes: string
  tags: string[]
  custom_fields: Record<string, unknown>
}

const emptyForm: LeadFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  company: "",
  job_title: "",
  phone: "",
  source: "manual",
  status: "new",
  notes: "",
  tags: [],
  custom_fields: {},
}

const statusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "new":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    case "contacted":
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    case "qualified":
    case "won":
      return "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
    case "lost":
      return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
    default:
      return "border-border text-foreground"
  }
}

const DEFAULT_COLUMNS: LeadColumnConfig[] = [
  { id: "select", key: "_select", label: "", visible: true, sortable: false, filterable: false, type: "select", width: 50 },
  { id: "contact", key: "first_name", label: "Contact", visible: true, sortable: true, filterable: true, type: "composite", width: 300 },
  { id: "company", key: "company", label: "Company", visible: true, sortable: true, filterable: false, type: "composite", width: 250 },
  { id: "phone", key: "phone", label: "Phone", visible: true, sortable: true, filterable: false, type: "text", width: 150 },
  { id: "source", key: "source", label: "Source", visible: true, sortable: true, filterable: true, type: "select", width: 120 },
  { id: "status", key: "status", label: "Status", visible: true, sortable: true, filterable: true, type: "status", width: 120 },
  { id: "actions", key: "_actions", label: "", visible: true, sortable: false, filterable: false, type: "actions", width: 100 },
]

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [form, setForm] = useState<LeadFormValues>(emptyForm)
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [columns, setColumns] = useState<LeadColumnConfig[]>(DEFAULT_COLUMNS)
  const [showColumnConfig, setShowColumnConfig] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(pagination.pageIndex + 1))
      params.set("pageSize", String(pagination.pageSize))
      sorting.forEach((s) => {
        params.set("sortBy", s.id)
        params.set("sortOrder", s.desc ? "desc" : "asc")
      })
      if (globalFilter) params.set("search", globalFilter)

      const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        setLeads(json.data ?? [])
        setPagination((prev) => ({
          ...prev,
          pageIndex: Math.max(0, (json.page ?? prev.pageIndex + 1) - 1),
          pageSize: json.pageSize ?? prev.pageSize,
        }))
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [pagination.pageIndex, pagination.pageSize, sorting, globalFilter])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  useEffect(() => {
    fetch("/api/leads/column-config")
      .then((res) => (res.ok ? res.json() : Promise.resolve({ columns: DEFAULT_COLUMNS })))
      .then((json) => {
        const saved = json.columns as LeadColumnConfig[]
        if (Array.isArray(saved) && saved.length > 0) {
          setColumns(saved)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const keys = new Set<string>()
    leads.forEach((lead) => {
      if (lead.custom_fields) {
        Object.keys(lead.custom_fields).forEach((k) => keys.add(k))
      }
    })
    setCustomFieldKeys(Array.from(keys))
  }, [leads])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        tags: form.tags?.filter(Boolean) ?? [],
        custom_fields: form.custom_fields ?? {},
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        toast.error("Failed to save lead")
        return
      }

      toast.success(editingLead ? "Lead updated" : "Lead saved")
      setForm(emptyForm)
      setEditingLead(null)
      setShowForm(false)
      await loadLeads()
    } catch {
      toast.error("Failed to save lead")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead)
    setForm({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      company: lead.company ?? "",
      job_title: lead.job_title ?? "",
      phone: lead.phone ?? "",
      source: lead.source,
      status: lead.status,
      notes: lead.notes ?? "",
      tags: lead.tags ?? [],
      custom_fields: lead.custom_fields ?? {},
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        toast.error("Delete failed")
        return
      }

      toast.success("Lead deleted")
      await loadLeads()
    } catch {
      toast.error("Delete failed")
    }
  }

  const handleBulkDelete = async () => {
    const selectedIds = table.getFilteredSelectedRowModel().rows.map((r) => r.original.id)
    if (selectedIds.length === 0) return

    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: selectedIds }),
      })

      if (!res.ok) {
        toast.error("Bulk delete failed")
        return
      }

      toast.success(`Deleted ${selectedIds.length} leads`)
      setRowSelection({})
      await loadLeads()
    } catch {
      toast.error("Bulk delete failed")
    }
  }

  const handleExportCsv = useCallback(() => {
    const activeColumns = columns.filter((c) => c.visible && c.type !== "select" && c.type !== "actions")
    const headers = activeColumns.map((c) => c.label || c.key)
    const rows = leads.map((lead) =>
      activeColumns.map((col) => {
        if (col.key.startsWith("_")) return ""
        if (col.key === "first_name" || col.key === "last_name") {
          return col.key === "first_name" ? lead.first_name : lead.last_name
        }
        if (col.key === "company") return lead.company ?? ""
        if (col.key === "job_title") return lead.job_title ?? ""
        if (col.key === "phone") return lead.phone ?? ""
        if (col.key === "source") return lead.source
        if (col.key === "status") return lead.status
        if (col.key === "notes") return lead.notes ?? ""
        if (col.key === "tags") return (lead.tags ?? []).join(", ")
        if (col.key === "email") return lead.email
        if (lead.custom_fields && col.key in lead.custom_fields) {
          return String(lead.custom_fields[col.key] ?? "")
        }
        return ""
      })
    )

    const csv = Papa.unparse([headers, ...rows])
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("CSV exported")
  }, [leads, columns])

  const handleExportPdf = useCallback(() => {
    const activeColumns = columns.filter((c) => c.visible && c.type !== "select" && c.type !== "actions")
    const headers = activeColumns.map((c) => c.label || c.key)
    const rows = leads.map((lead) =>
      activeColumns.map((col) => {
        if (col.key.startsWith("_")) return ""
        if (col.key === "first_name" || col.key === "last_name") {
          return col.key === "first_name" ? lead.first_name : lead.last_name
        }
        if (col.key === "company") return lead.company ?? ""
        if (col.key === "job_title") return lead.job_title ?? ""
        if (col.key === "phone") return lead.phone ?? ""
        if (col.key === "source") return lead.source
        if (col.key === "status") return lead.status
        if (col.key === "notes") return lead.notes ?? ""
        if (col.key === "tags") return (lead.tags ?? []).join(", ")
        if (col.key === "email") return lead.email
        if (lead.custom_fields && col.key in lead.custom_fields) {
          return String(lead.custom_fields[col.key] ?? "")
        }
        return ""
      })
    )

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text("Leads Export", 14, 16)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    })

    doc.save(`leads-export-${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success("PDF exported")
  }, [leads, columns])

  const handleSaveColumns = async (newColumns: LeadColumnConfig[]) => {
    setColumns(newColumns)
    try {
      await fetch("/api/leads/column-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: newColumns }),
      })
    } catch {
      // silent
    }
  }

  const visibleColumns = useMemo<ColumnDef<Lead>[]>(() => {
    const active = columns.filter((c) => c.visible)
    return active.map((config) => {
      if (config.type === "select") {
        return {
          id: "select",
          header: ({ table }: { table: { getIsAllPageRowsSelected: () => boolean; getIsSomePageRowsSelected: () => boolean; toggleAllPageRowsSelected: (v: boolean) => void } }) => (
          <div className="flex items-center justify-center px-2">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
          ),
          cell: ({ row }: { row: Row<Lead> }) => (
            <div className="flex items-center justify-center px-2">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
          size: config.width ?? 50,
        }
      }

      if (config.type === "actions") {
        return {
          id: "actions",
          header: "",
          cell: ({ row }: { row: Row<Lead> }) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                onClick={() => handleEdit(row.original)}
              >
                <Pencil className="size-3.5" />
                <span className="sr-only">Edit lead</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                    <EllipsisVertical className="size-3.5" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(row.original)}>
                    <Eye className="mr-2 size-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => handleEdit(row.original)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={() => handleDelete(row.original.id)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
          size: config.width ?? 100,
        }
      }

      if (config.type === "composite") {
        if (config.key === "first_name") {
          return {
            id: config.id,
            accessorFn: (row: Lead) => `${row.first_name} ${row.last_name} ${row.email}`,
            header: config.label,
            cell: ({ row }: { row: Row<Lead> }) => {
              const lead = row.original
              const initials = `${lead.first_name?.[0] ?? ""}${lead.last_name?.[0] ?? ""}`.toUpperCase()
              return (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </span>
                    <span className="text-sm text-muted-foreground">{lead.email}</span>
                  </div>
                </div>
              )
            },
            size: config.width ?? 300,
          }
        }
        if (config.key === "company") {
          return {
            id: config.id,
            accessorFn: (row: Lead) => row.company ?? "",
            header: config.label,
            cell: ({ row }: { row: Row<Lead> }) => {
              const lead = row.original
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{lead.company || "—"}</span>
                  {lead.job_title && (
                    <span className="text-sm text-muted-foreground">{lead.job_title}</span>
                  )}
                </div>
              )
            },
            size: config.width ?? 250,
          }
        }
      }

      if (config.type === "status") {
        return {
          id: config.id,
          accessorKey: config.key,
          header: config.label,
          cell: ({ row }: { row: Row<Lead> }) => {
            const value = row.getValue(config.key) as string
            return (
              <Badge variant="outline" className={statusColor(value)}>
                {value}
              </Badge>
            )
          },
          size: config.width ?? 120,
        }
      }

      if (config.type === "custom") {
        return {
          id: config.id,
          accessorFn: (row: Lead) => (row.custom_fields?.[config.key] as string) ?? "—",
          header: config.label,
          cell: ({ row }: { row: Row<Lead> }) => {
            const value = row.original.custom_fields?.[config.key]
            return <span className="text-sm">{value !== undefined && value !== null ? String(value) : "—"}</span>
          },
          enableSorting: false,
          enableFiltering: false,
          size: config.width ?? 180,
        }
      }

      return {
        id: config.id,
        accessorKey: config.key,
        header: config.label,
        cell: ({ row }: { row: Row<Lead> }) => <span className="text-sm">{String(row.getValue(config.key) ?? "—")}</span>,
        size: config.width,
      }
    })
  }, [columns])

  const table = useReactTable({
    data: leads,
    columns: visibleColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    onPaginationChange: setPagination,
  })

  const statuses = useMemo(
    () => Array.from(new Set(leads.map((l) => l.status))).filter((s): s is string => Boolean(s)),
    [leads]
  )
  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source))).filter((s): s is string => Boolean(s)),
    [leads]
  )

  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {leads.length}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm">
                <Download className="mr-2 size-4" />
                Export
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer" onClick={handleExportCsv}>
                <FileUp className="mr-2 size-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={handleExportPdf}>
                <Download className="mr-2 size-4" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <FileUp className="mr-2 size-4" />
            Import
          </Button>
          <Button size="sm" onClick={() => { setEditingLead(null); setForm(emptyForm); setShowForm(true) }}>
            <Plus className="mr-2 size-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
          <span className="text-sm text-muted-foreground">
            {selectedCount} lead{selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkDelete} className="text-destructive">
              <Trash2 className="mr-2 size-4" />
              Delete Selected
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setRowSelection({})}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="status-filter" className="text-sm font-medium">
            Status
          </Label>
          <Select
            value={(table.getColumn("status")?.getFilterValue() as string | undefined) ?? ""}
            onValueChange={(value) => {
              table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)
            }}
          >
            <SelectTrigger className="cursor-pointer w-full" id="status-filter">
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
            value={(table.getColumn("source")?.getFilterValue() as string | undefined) ?? ""}
            onValueChange={(value) => {
              table.getColumn("source")?.setFilterValue(value === "all" ? "" : value)
            }}
          >
            <SelectTrigger className="cursor-pointer w-full" id="source-filter">
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
        <div className="space-y-2">
          <Label htmlFor="column-visibility" className="text-sm font-medium">
            Columns
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger id="column-visibility">
              <Button variant="outline" className="cursor-pointer w-full">
                Columns <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {columns
                .filter((column) => column.type !== "select" && column.type !== "actions")
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={table.getColumn(column.id)?.getIsVisible() ?? column.visible}
                    onCheckedChange={(value) =>
                      table.getColumn(column.id)?.toggleVisibility(!!value)
                    }
                  >
                    {column.label || column.key}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Manage</Label>
          <Button
            variant="outline"
            className="cursor-pointer w-full"
            onClick={() => setShowColumnConfig(true)}
          >
            <Settings2 className="mr-2 size-4" />
            Customize Columns
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
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
                <TableCell colSpan={visibleColumns.length} className="h-24 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leads found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex items-center space-x-2">
          <Label htmlFor="page-size" className="text-sm font-medium">
            Show
          </Label>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="w-20 cursor-pointer" id="page-size">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 text-sm text-muted-foreground hidden sm:block">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2 hidden sm:block">
            <p className="text-sm font-medium">Page</p>
            <strong className="text-sm">
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </strong>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingLead ? "Edit Lead" : "Add Lead"}</SheetTitle>
            <SheetDescription>
              {editingLead ? "Update lead details below." : "Fill in the details for the new lead."}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">First Name</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="First name"
                  required
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Last name"
                  required
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                required
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Company</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company"
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  placeholder="Job title"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone"
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Source</Label>
              <Select
                value={form.source}
                onValueChange={(value) => value && setForm({ ...form, source: value })}
              >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="cold-outreach">Cold Outreach</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => value && setForm({ ...form, status: value })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Tags</Label>
              <Input
                value={(form.tags ?? []).join(", ")}
                onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="Tags (comma-separated)"
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                className="min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
              />
            </div>
            {customFieldKeys.length > 0 && (
              <div className="flex flex-col gap-3">
                <Label className="text-xs font-medium text-muted-foreground">Custom Fields</Label>
                {customFieldKeys.map((key) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label className="text-xs capitalize">{key.replace(/_/g, " ")}</Label>
                    <Input
                      value={String((form.custom_fields?.[key] as string) ?? "")}
                      onChange={(e) => setForm({
                        ...form,
                        custom_fields: { ...form.custom_fields, [key]: e.target.value },
                      })}
                      placeholder={key}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            )}
            <SheetFooter className="px-0">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                {editingLead ? "Update Lead" : "Save Lead"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ColumnConfigDialog
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        columns={columns}
        onSave={handleSaveColumns}
        customFieldKeys={customFieldKeys}
      />

      <CsvImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={loadLeads}
      />
    </div>
  )
}
