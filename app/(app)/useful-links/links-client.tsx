"use client";

import { useState, useEffect } from "react";
import { UsefulLink } from "@/lib/api/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MoreVertical, Link as LinkIcon, Search, Trash, Edit } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/system/motion";

export function LinksClient() {
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<UsefulLink | null>(null);
  const [formData, setFormData] = useState({ title: "", url: "", description: "", tags: "" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function fetchLinks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/links?pageSize=100");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Failed to fetch links");
      }
      const json = await res.json();
      setLinks(json.data || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch links";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchLinks();
    });
  }, []);

  const filteredLinks = links.filter(link => 
    link.title.toLowerCase().includes(search.toLowerCase()) || 
    link.description?.toLowerCase().includes(search.toLowerCase()) ||
    link.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenDialog = (link?: UsefulLink) => {
    if (link) {
      setEditingLink(link);
      setFormData({
        title: link.title,
        url: link.url,
        description: link.description || "",
        tags: link.tags.join(", ")
      });
    } else {
      setEditingLink(null);
      setFormData({ title: "", url: "", description: "", tags: "" });
    }
    setSaveError(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        url: formData.url,
        description: formData.description,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean)
      };

      const url = editingLink ? `/api/links/${editingLink.id}` : "/api/links";
      const method = editingLink ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((typeof data?.error === "string" ? data.error : data?.error?.message) || "Failed to save");
      }
      
      toast.success(editingLink ? "Link updated" : "Link added");
      setIsDialogOpen(false);
      fetchLinks();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save link";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleteDialogOpen(false);
    try {
      const res = await fetch(`/api/links/${pendingDeleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Failed to delete");
      }
      toast.success("Link deleted");
      fetchLinks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete link");
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <Reveal className="flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search links..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 motion-card">
          <Plus className="h-4 w-4" /> Add Link
        </Button>
      </Reveal>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse bg-muted/20 h-40" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void fetchLinks()}>Retry</Button>
          </CardContent>
        </Card>
      ) : filteredLinks.length === 0 ? (
        <Reveal className="flex flex-col items-center justify-center flex-1 py-12 text-center text-muted-foreground">
          <LinkIcon className="h-12 w-12 mb-4 text-muted-foreground/30" />
          <p>No links found.</p>
          {search && <p className="text-sm">Try adjusting your search query.</p>}
        </Reveal>
      ) : (
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map(link => (
            <StaggerItem key={link.id}>
            <Card className="motion-card group relative overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {link.favicon ? (
                       // eslint-disable-next-line @next/next/no-img-element
                      <img src={link.favicon} alt="" className="h-5 w-5 rounded-sm" />
                    ) : (
                      <LinkIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base line-clamp-1">{link.title}</CardTitle>
                    <Link href={link.url} target="_blank" className="text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 truncate block max-w-[180px]">
                      {link.url}
                    </Link>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground z-10 relative">
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenDialog(link)} className="gap-2">
                      <Edit className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteClick(link.id)} className="text-destructive gap-2">
                      <Trash className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="pb-4">
                <CardDescription className="line-clamp-2 text-sm text-foreground/70 min-h-[40px]">
                  {link.description || "No description provided."}
                </CardDescription>
              </CardContent>
              {link.tags && link.tags.length > 0 && (
                <CardFooter className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {link.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-secondary/50 text-xs text-secondary-foreground font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardFooter>
              )}
              <Link href={link.url} target="_blank" className="absolute inset-0 z-0">
                <span className="sr-only">Visit {link.title}</span>
              </Link>
            </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Link" : "Add Link"}</DialogTitle>
            <DialogDescription>
              {editingLink ? "Update your saved link." : "Save a new link to your bookmarks."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title (optional — inferred from the URL if left blank)</Label>
              <Input 
                id="title" 
                value={formData.title} 
                onChange={e => setFormData({ ...formData, title: e.target.value })} 
                placeholder="Google"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="text"
                value={formData.url}
                onChange={e => setFormData({ ...formData, url: e.target.value })} 
                placeholder="https://google.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Search engine"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <Input 
                id="tags" 
                value={formData.tags} 
                onChange={e => setFormData({ ...formData, tags: e.target.value })} 
                placeholder="search, tools, utility (comma separated)"
              />
            </div>
          </div>
          <DialogFooter>
            <div className="flex w-full items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">{saving ? "Saving…" : saveError ? "Couldn’t save — Retry" : ""}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={!formData.url || saving}>Save</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete link</DialogTitle>
            <DialogDescription>
              This will permanently remove this bookmark. This action can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex w-full items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
