"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { FileSpreadsheet, FileUp, UploadCloud, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
  "Name": "first_name",
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

const DUPLICATE_ACTIONS = {
  skip: "skip",
  update: "update",
  create: "create",
}

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function CsvImportDialog({ open, onOpenChange, onImported }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [allRows, setAllRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

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
        // Store all data rows (excluding header) for import, but only preview the first few.
        const dataRows = rows.slice(1)
        setAllRows(dataRows)
        setTotalCount(dataRows.length)
        setPreview([h, ...dataRows.slice(0, 5)])

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
    if (allRows.length === 0) return []
    const result: Record<string, unknown>[] = []
    for (let i = 0; i < allRows.length; i++) {
      const row: Record<string, unknown> = {}
      const customFields: Record<string, unknown> = {}
      let hasCustom = false
      headers.forEach((header, index) => {
        const field = mapping[header]
        const value = (allRows[i][index] ?? "").toString().trim()
        if (!value) return
        if (field && field !== "ignore" && field !== "custom") {
          if (field === "tags") {
            row[field] = value ? value.split(",").map((s) => s.trim()) : []
          } else {
            row[field] = value
          }
        } else {
          // Unmapped or explicitly "custom" -> preserve every column in custom_fields
          customFields[header] = value
          hasCustom = true
        }
      })
      if (hasCustom) row.custom_fields = customFields
      result.push(row)
    }
    return result
  }, [allRows, mapping, headers])

  const handleImport = async () => {
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

      toast.success(`Imported ${totalCount} leads`)
      onImported()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

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
          {/* Modern File Upload Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">CSV File</Label>
            <div className="relative">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={!!file}
                className="sr-only"
                id="csv-file-input"
              />
              <Label
                htmlFor="csv-file-input"
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-all cursor-pointer ${
                  file
                    ? "border-green-500 bg-green-50"
                    : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/50"
                }`}
              >
                <div className="text-center space-y-3">
                  <div className="mx-auto rounded-full bg-muted p-3">
                    {file ? (
                      <FileSpreadsheet className="h-6 w-6 text-green-600" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {file ? (
                        <span className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          {file.name}
                        </span>
                      ) : (
                        "Click to upload CSV file"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {file ? (
                        <span className="flex items-center gap-1">
                          <FileUp className="h-3 w-3" />
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      ) : (
                        "Drag and drop or browse to select a CSV file"
                      )}
                    </p>
                  </div>
                </div>
              </Label>
            </div>
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
                          <SelectItem value="custom">Keep as custom field</SelectItem>
                          <SelectItem value="first_name">Name / First Name</SelectItem>
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Preview
                    </Label>
                    <Badge variant="secondary" className="text-xs">
                      {totalCount} {totalCount === 1 ? "lead" : "leads"} to import
                    </Badge>
                  </div>
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
