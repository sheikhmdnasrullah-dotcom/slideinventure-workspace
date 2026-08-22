"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { FileUp, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const FIELD_MAP: Record<string, string> = {
  "First Name": "first_name",
  "Last Name": "last_name",
  "Full Name": "full_name",
  "Email": "email",
  "Company": "company",
  "Job Title": "job_title",
  "Phone": "phone",
  "Source": "source",
  "Status": "status",
  "Notes": "notes",
  "Tags": "tags",
}

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function CsvImportDialog({ open, onOpenChange, onImported }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview([])
      setHeaders([])
      setMapping({})
    }
  }, [open])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (selected.type && !selected.type.includes("csv") && !selected.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file")
      return
    }

    setFile(selected)

    Papa.parse<string[]>(selected, {
      header: false,
      skipEmptyLines: true,
      complete(results) {
        const rows = results.data as string[][]
        if (rows.length === 0) {
          toast.error("CSV file is empty")
          return
        }
        const h = rows[0]
        setHeaders(h)
        setPreview(rows.slice(0, 6))

        const autoMap: Record<string, string> = {}
        h.forEach((col) => {
          const normalized = col.trim().toLowerCase()
          const matched = Object.entries(FIELD_MAP).find(([label, key]) =>
            normalized.includes(label.toLowerCase())
          )
          if (matched) {
            autoMap[col] = matched[1]
          } else if (normalized.includes("name") && !autoMap[col]) {
            autoMap[col] = "first_name"
          }
        })
        setMapping(autoMap)
      },
      error() {
        toast.error("Failed to parse CSV file")
      },
    })
  }, [])

  const mappedLeads = useMemo(() => {
    if (preview.length < 2) return []
    const result: Record<string, unknown>[] = []
    for (let i = 1; i < preview.length; i++) {
      const row: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        const field = mapping[header]
        if (field && field !== "ignore") {
          const value = preview[i][index]?.trim() || ""
          if (field === "tags") {
            row[field] = value ? value.split(",").map((s) => s.trim()) : []
          } else {
            row[field] = value
          }
        }
      })
      result.push(row)
    }
    return result
  }, [preview, headers, mapping])

  const handleImport = useCallback(async () => {
    if (!file || mappedLeads.length === 0) {
      toast.error("No data to import")
      return
    }

    setImporting(true)
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: mappedLeads }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Import failed")
      }

      toast.success(`Imported ${mappedLeads.length} leads`)
      onImported()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }, [file, mappedLeads, onImported, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file, map the columns, and preview the data before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>CSV File</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={!!file}
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileUp className="size-4" />
                {file.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => {
                    setFile(null)
                    setPreview([])
                    setHeaders([])
                    setMapping({})
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </div>

          {headers.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {headers.map((header) => (
                  <div key={header} className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">{header}</Label>
                    <Select
                      value={mapping[header] || ""}
                      onValueChange={(value) => {
                        if (value) {
                          setMapping((prev) => ({ ...prev, [header]: value }))
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Map to..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">Skip</SelectItem>
                        <SelectItem value="first_name">First Name</SelectItem>
                        <SelectItem value="last_name">Last Name</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="job_title">Job Title</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="source">Source</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                        <SelectItem value="tags">Tags</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {preview.length > 1 && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Preview ({preview.length - 1} rows)
                  </Label>
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((h) => (
                            <TableHead key={h} className="text-xs">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.slice(1).map((row, idx) => (
                          <TableRow key={idx}>
                            {row.map((cell, cellIdx) => (
                              <TableCell key={cellIdx} className="text-xs">
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || !file}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
