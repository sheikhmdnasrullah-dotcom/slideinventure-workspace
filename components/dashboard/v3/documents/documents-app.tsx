"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { FileText, Search, Upload, RefreshCw, Folder, PanelRightClose, PanelRightOpen } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"

import { DocumentDisplay } from "./document-display"
import { DocumentList } from "./document-list"
import { useDocuments, DocumentsProvider } from "./use-documents"
import { SectionErrorBoundary } from "@/components/system/error-boundary"

const FOLDERS = [
  { title: "All Documents", folder: "All" },
]

function DocumentsAppInner() {
  const [collapsed, setCollapsed] = React.useState(false)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const {
    loading, search, setSearch,
    setFolder, folder, refresh
  } = useDocuments()

  // Command palette's "Upload Document" entry lands here with ?upload=1.
  const searchParams = useSearchParams()
  React.useEffect(() => {
    if (searchParams.get("upload") === "1") setUploadOpen(true)
  }, [searchParams])

  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = React.useState("")
  const [uploadTags, setUploadTags] = React.useState("")
  const [uploading, setUploading] = React.useState(false)

  async function handleUpload() {
    if (!uploadFile) {
      toast.error("Please select a file")
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("title", uploadTitle || uploadFile.name)
      formData.append("tags", uploadTags)

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      toast.success("Document uploaded")
      setUploadOpen(false)
      setUploadFile(null)
      setUploadTitle("")
      setUploadTags("")
      refresh()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-full overflow-hidden">
        <div
          className={cn(
            "flex h-full flex-col border-r transition-all duration-300",
            collapsed ? "w-[56px]" : "w-[220px]"
          )}
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="flex h-[52px] items-center justify-between px-3">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--text-accent)]" />
                <span className="text-sm font-semibold">Documents</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </Button>
          </div>
          <Separator />
          <div className="p-2">
            <Button
              className={cn("w-full justify-start gap-2", collapsed && "justify-center px-0")}
              size="sm"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4" />
              {!collapsed && <span>Upload Document</span>}
            </Button>
          </div>
          <nav className="flex flex-col gap-1 px-2 py-2">
            {FOLDERS.map((item) => (
              <Button
                key={item.folder}
                variant={folder === item.folder ? "default" : "ghost"}
                className={cn("justify-start gap-2", collapsed && "justify-center px-2")}
                size="sm"
                onClick={() => setFolder(item.folder)}
              >
                <Folder className="h-4 w-4" />
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <h1 className="text-lg font-semibold capitalize">{folder}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={refresh}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          <Separator />
          <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </form>
          </div>
          <ScrollArea className="flex-1">
            <DocumentList />
          </ScrollArea>
        </div>

        <DocumentPreviewSheet />

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Custom title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="invoice, Q3, finance"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                />
              </div>
              <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

function DocumentPreviewSheet() {
  const { selected, setSelected, selectedDocument } = useDocuments()

  return (
    <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
      <SheetContent className="w-full overflow-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{selectedDocument?.title || "Preview"}</SheetTitle>
        </SheetHeader>
        <DocumentDisplay />
      </SheetContent>
    </Sheet>
  )
}

export function DocumentsApp(_props: DocumentsAppProps) {
  return (
    <SectionErrorBoundary label="Documents">
      <DocumentsProvider>
        <React.Suspense fallback={null}>
          <DocumentsAppInner />
        </React.Suspense>
      </DocumentsProvider>
    </SectionErrorBoundary>
  )
}

interface DocumentsAppProps {
  navCollapsedSize?: number
}
