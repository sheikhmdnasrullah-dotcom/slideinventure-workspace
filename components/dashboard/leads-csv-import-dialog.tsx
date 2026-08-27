"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { FileSpreadsheet, FileUp, UploadCloud } from "lucide-react"
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
import {
  DEDICATED_FIELD_OPTIONS,
  CUSTOM_FIELD_OPTIONS,
  inferFieldMapping,
  mapRowToLead,
  selectValueToTarget,
  targetToSelectValue,
  type HeaderMapping,
} from "@/lib/leads/csv-mapping"

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function CsvImportDialog({ open, onOpenChange, onImported }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<HeaderMapping>({})
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setHeaders([])
      setRows([])
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

    // header:true hands back row/column/value already correctly associated
    // by PapaParse's own (well-tested) CSV parser — quoted commas, ragged
    // rows, and column order are all handled by the library rather than by
    // hand-zipping a raw header array against positional row arrays.
    Papa.parse<Record<string, string>>(selected, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const data = results.data.filter((row) => Object.values(row).some((v) => (v ?? "").toString().trim()))
        const fields = results.meta.fields ?? []
        if (fields.length === 0 || data.length === 0) {
          toast.error("CSV file is empty")
          return
        }
        setHeaders(fields)
        setRows(data)
        setMapping(inferFieldMapping(fields))
      },
      error() {
        toast.error("Failed to parse CSV file")
      },
    })
  }, [])

  const mappedLeads = useMemo(() => {
    return rows.map((row) => mapRowToLead(row, mapping))
  }, [rows, mapping])

  const totalCount = rows.length

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

      const json = await res.json().catch(() => ({}))
      const imported = typeof json.imported === "number" ? json.imported : totalCount
      toast.success(`Imported ${imported} of ${totalCount} leads`)
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
            Upload a CSV file. Columns are matched to lead fields automatically — review or correct the mapping below before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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
                      value={targetToSelectValue(mapping[header] ?? { kind: "unmapped" })}
                      onValueChange={(value) => {
                        if (!value) return
                        setMapping((prev) => ({ ...prev, [header]: selectValueToTarget(value) }))
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Keep as custom field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">Skip this column</SelectItem>
                        {DEDICATED_FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        {CUSTOM_FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={`custom:${opt.value}`}>
                            {opt.label} (custom field)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Preview (first 5 rows)</Label>
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
                      {rows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {headers.map((h) => (
                            <TableCell key={h} className="text-xs">
                              {row[h]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
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
