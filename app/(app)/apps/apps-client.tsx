"use client";

import { useState, useEffect } from "react";
import { App } from "@/lib/api/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MoreVertical, LayoutGrid, Search, Trash, Edit, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function AppsClient() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [formData, setFormData] = useState({ name: "", url: "", description: "", category: "", slug: "" });

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apps?pageSize=100");
      if (res.ok) {
        const json = await res.json();
        setApps(json.data || []);
      }
    } catch (e) {
      toast.error("Failed to fetch apps");
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(search.toLowerCase()) || 
    app.description?.toLowerCase().includes(search.toLowerCase()) ||
    app.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (app?: App) => {
    if (app) {
      setEditingApp(app);
      setFormData({
        name: app.name,
        url: app.url || "",
        description: app.description || "",
        category: app.category || "",
        slug: app.slug
      });
    } else {
      setEditingApp(null);
      setFormData({ name: "", url: "", description: "", category: "", slug: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        url: formData.url,
        description: formData.description,
        category: formData.category
      };

      const url = editingApp ? `/api/apps/${editingApp.id}` : "/api/apps";
      const method = editingApp ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((typeof data?.error === "string" ? data.error : data?.error?.message) || "Failed to save");
      }

      toast.success(editingApp ? "App updated" : "App added");
      setIsDialogOpen(false);
      fetchApps();
    } catch (e: any) {
      toast.error(e.message || "Failed to save app");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this app?")) return;
    
    try {
      const res = await fetch(`/api/apps/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Failed to delete");
      }
      toast.success("App deleted");
      fetchApps();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete app");
    }
  };

  // Group apps by category
  const categories = Array.from(new Set(filteredApps.map(app => app.category || "Other"))).sort();

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search apps..." 
            className="pl-9 bg-background" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" /> Add App
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse bg-muted/20 h-32" />
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-muted-foreground">
          <LayoutGrid className="h-12 w-12 mb-4 text-muted-foreground/30" />
          <p>No apps found.</p>
          {search && <p className="text-sm">Try adjusting your search query.</p>}
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(category => {
            const categoryApps = filteredApps.filter(app => (app.category || "Other") === category);
            if (categoryApps.length === 0) return null;
            
            return (
              <div key={category} className="space-y-4">
                <h3 className="text-sm font-medium text-foreground/60 uppercase tracking-wider">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categoryApps.map(app => (
                    <Card key={app.id} className="group relative overflow-hidden transition-all hover:shadow-md border-border/50 bg-background/50 backdrop-blur-sm flex flex-col h-full">
                      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary overflow-hidden">
                            {app.icon === "lucide:Mail" ? (
                              <Mail className="h-6 w-6" />
                            ) : app.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={app.icon} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <LayoutGrid className="h-6 w-6" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-base line-clamp-1">{app.name}</CardTitle>
                            {app.url && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                {new URL(app.url).hostname.replace('www.', '')} <ExternalLink className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground z-10 relative">
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(app)} className="gap-2">
                              <Edit className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(app.id)} className="text-destructive gap-2">
                              <Trash className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      <CardContent className="pt-2 pb-4 flex-1">
                        <CardDescription className="line-clamp-2 text-sm text-foreground/70">
                          {app.description || "No description provided."}
                        </CardDescription>
                      </CardContent>
                      {app.url && (
                        <a href={app.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0">
                          <span className="sr-only">Launch {app.name}</span>
                        </a>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingApp ? "Edit App" : "Add App"}</DialogTitle>
            <DialogDescription>
              {editingApp ? "Update application details." : "Add a new application launcher."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">App Name (optional: inferred from the URL if left blank)</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="Notion"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">Launch URL</Label>
              <Input 
                id="url" 
                type="url"
                value={formData.url} 
                onChange={e => setFormData({ ...formData, url: e.target.value })} 
                placeholder="https://notion.so"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input 
                id="category" 
                value={formData.category} 
                onChange={e => setFormData({ ...formData, category: e.target.value })} 
                placeholder="Productivity"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                placeholder="Knowledge base and workspace"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name && !formData.url}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
