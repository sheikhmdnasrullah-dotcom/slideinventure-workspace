"use client"

import { format } from "date-fns"
import { Download, ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { STIRLING_PDF_URL } from "@/lib/pdf-editor"
import { useDocuments } from "./use-documents"

export function DocumentDisplay() {
  const { selectedDocument, deleteDocument } = useDocuments()

  if (!selectedDocument) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        No document selected
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center p-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="grid gap-1">
            <div className="font-semibold">{selectedDocument.title}</div>
            <div className="line-clamp-1 text-xs">{selectedDocument.filename}</div>
          </div>
        </div>
        {selectedDocument.created_at && (
          <div className="ml-auto text-xs text-muted-foreground">
            {format(new Date(selectedDocument.created_at), "PPpp")}
          </div>
        )}
      </div>
      <Separator />
      <div className="flex items-center p-4">
        <div className="flex items-center gap-2">
          <a  href={selectedDocument.url} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"><ExternalLink className="h-4 w-4" /></a>
          <a  href={selectedDocument.url} download={selectedDocument.filename} title="Download" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"><Download className="h-4 w-4" /></a>
          {selectedDocument.mime_type === "application/pdf" && (
            <a href={STIRLING_PDF_URL} target="_blank" rel="noopener noreferrer" title="Edit PDF" className="inline-flex items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9">
              <Pencil className="h-4 w-4" /> Edit PDF
            </a>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"><MoreVertical className="h-4 w-4" /><span className="sr-only">More</span></div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => deleteDocument(selectedDocument.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator />
      <div className="flex-1 overflow-hidden p-4">
        {selectedDocument.mime_type === "application/pdf" ? (
          <iframe
            src={selectedDocument.url}
            className="h-full w-full rounded-md border"
            title={selectedDocument.title}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Preview not available for {selectedDocument.mime_type}
          </div>
        )}
      </div>
    </div>
  )
}
