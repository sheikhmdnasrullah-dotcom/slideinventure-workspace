"use client"

import * as React from "react"
import { FileText, Search, Upload, RefreshCw, Folder } from "lucide-react"
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"

import { DocumentDisplay } from "./document-display"
import { DocumentList } from "./document-list"
import { Nav } from "./nav"
import { useDocuments, DocumentsProvider } from "./use-documents"

interface DocumentsAppProps {
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

function DocumentsAppInner({
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: DocumentsAppProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const {
    loading, search, setSearch,
    setFolder, folder, refresh, uploadOpen, setUploadOpen
  } = useDocuments()

  // Upload form state
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
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(layout) => {
          document.cookie = `react-resizable-panels:layout:documents=${JSON.stringify(
            [layout.nav, layout.list, layout.display]
          )}`
        }}
        className="h-full max-h-[800px] items-stretch"
      >
        {/* ─── LEFT NAV ─── */}
        <ResizablePanel
          id="nav"
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={15}
          maxSize={20}
          onResize={(panelSize) => {
            const nowCollapsed = panelSize.asPercentage <= navCollapsedSize
            setIsCollapsed(nowCollapsed)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(nowCollapsed)}`
          }}
          className={cn(
            isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
        >
          <div className="flex h-[52px] items-center justify-center">
            <span className={cn("font-semibold", isCollapsed && "hidden")}>Documents</span>
            {isCollapsed && <FileText className="h-4 w-4" />}
          </div>
          <Separator />
          {/* Upload button */}
          {!isCollapsed && (
            <div className="px-2 py-2">
              <Button
                className="w-full justify-start gap-2"
                size="sm"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Upload PDF
              </Button>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Nav
            isCollapsed={isCollapsed}
            links={[
              { title: "All Documents", icon: Folder, variant: folder === "All" ? "default" : "ghost", onClick: () => setFolder("All") },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── DOCUMENT LIST ─── */}
        <ResizablePanel id="list" defaultSize={defaultLayout[1]} minSize={30}>
          <div className="flex items-center px-4 py-2">
            <h1 className="text-xl font-bold capitalize">
              {folder}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
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
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </form>
          </div>
          <DocumentList />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── DOCUMENT DISPLAY ─── */}
        <ResizablePanel id="display" defaultSize={defaultLayout[2]} minSize={30}>
          <DocumentDisplay />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ─── UPLOAD DIALOG ─── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="file">PDF File</Label>
              <Input
                id="file"
                type="file"
                accept="application/pdf"
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
    </TooltipProvider>
  )
}

export function DocumentsApp(props: DocumentsAppProps) {
  return (
    <DocumentsProvider>
      <DocumentsAppInner {...props} />
    </DocumentsProvider>
  )
}
