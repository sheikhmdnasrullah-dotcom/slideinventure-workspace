"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useKnowledge } from "./use-knowledge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function AddContextDialog() {
  const { addOpen, setAddOpen, refresh } = useKnowledge()
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [category, setCategory] = React.useState("auto")
  const [tags, setTags] = React.useState("")
  const [source, setSource] = React.useState("dashboard")
  const [file, setFile] = React.useState<File | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit() {
    if (!file && !content.trim() && !title.trim()) {
      toast.error("Add a file, or paste some text, first")
      return
    }

    setSubmitting(true)
    try {
      let res: Response
      if (file) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("title", title)
        fd.append("category", category)
        fd.append("source", source)
        fd.append("tags", tags)
        res = await fetch("/api/knowledge/add", { method: "POST", body: fd })
      } else {
        res = await fetch("/api/knowledge/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            category,
            source,
            tags: tags.split(",").map(t => t.trim()).filter(Boolean)
          })
        })
      }

      if (!res.ok) {
        throw new Error(await res.text())
      }

      toast.success("Knowledge added successfully")
      setAddOpen(false)
      setTitle("")
      setContent("")
      setTags("")
      refresh()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Context to Knowledge Base</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title (optional: inferred if left blank)</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Supabase Auth Flow" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val || "auto")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="system">System Doc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. dashboard, url, meeting" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. auth, setup, backend" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="file">Upload a file (PDF, CSV, MD, TXT, JPG, etc.)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.docx,.csv,.tsv,.md,.markdown,.txt,.text,.json,.log,.yml,.yaml,.env,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""))
              }}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                Selected: {file.name}. Content will be read from this file.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="content">Content (optional if you uploaded a file; Markdown supported)</Label>
            <Textarea 
              id="content" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder={file ? "Leave blank to use the uploaded file's contents." : "Paste your context, code snippets, or notes here..."}
              disabled={!!file}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save to Knowledge Base"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
