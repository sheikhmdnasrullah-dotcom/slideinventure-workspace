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
import { Plus, MoreVertical, ExternalLink, Link as LinkIcon, Search, Trash, Edit, Star } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function LinksClient() {
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<UsefulLink | null>(null);
  const [formData, setFormData] = useState({ title: "", url: "", description: "", tags: "" });

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/links?pageSize=100");
      if (res.ok) {
        const json = await res.json();
        setLinks(json.data || []);
      }
    } catch (e) {
      toast.error("Failed to fetch links");
    } finally {
      setLoading(false);
    }
  };

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
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
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
        throw new Error(data?.error?.message || "Failed to save");
      }
      
      toast.success(editingLink ? "Link updated" : "Link added");
      setIsDialogOpen(false);
      fetchLinks();
    } catch (e: any) {
      toast.error(e.message || "Failed to save link");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link?")) return;
    
    try {
      const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Failed to delete");
      }
      toast.success("Link deleted");
      fetchLinks();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete link");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search links..." 
            className="pl-9 bg-background" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" /> Add Link
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse bg-muted/20 h-40" />
          ))}
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-muted-foreground">
          <LinkIcon className="h-12 w-12 mb-4 text-muted-foreground/30" />
          <p>No links found.</p>
          {search && <p className="text-sm">Try adjusting your search query.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map(link => (
            <Card key={link.id} className="group relative overflow-hidden transition-all hover:shadow-md border-border/50 bg-background/50 backdrop-blur-sm">
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
                  <DropdownMenuTrigger className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground z-10 relative">
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenDialog(link)} className="gap-2">
                      <Edit className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(link.id)} className="text-destructive gap-2">
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
          ))}
        </div>
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
              <Label htmlFor="title">Title</Label>
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
                type="url"
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title || !formData.url}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
