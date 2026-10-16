"use client";
import { GlossTile } from "@/components/system/gloss-tile";
/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import Link from "next/link";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectApi, type Project } from "./use-project";
import { SectionErrorBoundary } from "@/components/system/error-boundary";

function ProjectsListInner() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const { projects } = await projectApi.list();
      setProjects(projects);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { project } = await projectApi.create(name.trim(), description.trim() || undefined);
      setProjects((p) => [project, ...p]);
      setDialogOpen(false);
      setName("");
      setDescription("");
      toast.success(`Project "${project.name}" created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create project");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string, projectName: string) {
    if (!window.confirm(`Delete "${projectName}" and all its files? This can't be undone.`)) return;
    setDeleting(id);
    try {
      await projectApi.remove(id);
      setProjects((p) => p.filter((x) => x.id !== id));
      toast.success("Project deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete project");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading projects…</p>;
  }
  if (error) {
    return (
      <div className="p-8 text-sm">
        <p className="font-medium">Could not load projects</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project keeps its working files — briefs, research, plans — in one place, with an
            assistant that reads and edits them alongside you.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-lg border border-rule bg-surface p-12 text-center shadow-raised">
          <GlossTile size={88} className="-rotate-6">
            <FolderOpen className="size-9" strokeWidth={1.5} />
          </GlossTile>
          <p className="mt-6 text-base font-semibold text-ink-strong">No projects yet</p>
          <p className="mt-2 max-w-[360px] text-sm text-ink-muted">
            Create a project, add your documents and notes, then ask the assistant to analyze,
            compare, or revise them — every change is proposed for your review first.
          </p>
          <Button onClick={() => setDialogOpen(true)} className="mt-6">
            <Plus className="mr-1.5 h-4 w-4" /> Create your first project
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="transition-[border-color] duration-[150ms] hover:border-rule-strong">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link href={`/projects/${p.id}`} className="truncate hover:underline">
                    {p.name}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {p.description || "No description"}
                </CardDescription>
              </CardHeader>
              <div className="flex items-center gap-2 px-6 pb-4">
                <p className="text-xs text-muted-foreground">
                  {p.fileCount} file{p.fileCount === 1 ? "" : "s"} · Updated{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 text-ink-muted hover:text-status-danger"
                  onClick={() => remove(p.id, p.name)}
                  disabled={deleting === p.id}
                  title={`Delete ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" render={<Link href={`/projects/${p.id}`} />}>
                  Open
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q4 launch plan"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-desc">Description (optional)</Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProjectsList() {
  return (
    <SectionErrorBoundary label="Projects">
      <ProjectsListInner />
    </SectionErrorBoundary>
  );
}
