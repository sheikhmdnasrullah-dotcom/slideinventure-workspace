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
  const [category, setCategory] = React.useState("note")
  const [tags, setTags] = React.useState("")
  const [source, setSource] = React.useState("dashboard")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit() {
    if (!title || !content) {
      toast.error("Title and content are required")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/knowledge/add", {
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
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Supabase Auth Flow" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            <Label htmlFor="content">Content (Markdown supported)</Label>
            <Textarea 
              id="content" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder="Paste your context, code snippets, or notes here..."
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
