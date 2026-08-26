"use client"

/* eslint-disable react-hooks/set-state-in-effect */
// The Todoist data loaders fetch from the API and update state after async
// I/O. Calling them from effects is intentional; there is no synchronous
// cascading render because all state updates happen after `await`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Trash2, Check, RefreshCw, Filter, Search } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeadlinePicker } from "./deadline-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface TodoistTask {
  id: string
  external_id?: string
  project_id?: string
  content: string
  description?: string
  priority: number
  due_date?: string
  completed: boolean
  assignee?: string
  labels?: string[]
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TodoistProject {
  id: string
  name: string
  color?: string
  is_favorite?: boolean
}

export interface TodoistLabel {
  id: string
  name: string
  color?: string
}

const PRIORITY_COLORS = {
  1: "bg-gray-100 text-gray-700 border-gray-200",
  2: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-orange-50 text-orange-700 border-orange-200",
  4: "bg-red-50 text-red-700 border-red-200",
}

const PRIORITY_LABELS = {
  1: "Normal",
  2: "Medium",
  3: "High",
  4: "Urgent",
}

export function TodoistContent() {
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [projects, setProjects] = useState<TodoistProject[]>([])
  const [labels, setLabels] = useState<TodoistLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [search, setSearch] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [labelFilter, setLabelFilter] = useState<string>("all")
  const [completedFilter, setCompletedFilter] = useState<boolean | undefined>(undefined)

  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<TodoistTask | null>(null)
  const [saving, setSaving] = useState(false)
  const submittingRef = useRef(false)

  const [form, setForm] = useState({
    content: "",
    description: "",
    projectId: "",
    labels: [] as string[],
    priority: 1,
    dueDate: "",
    reminder: true,
  })

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/todoist/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data.data ?? [])
      }
    } catch {
      // silent
    }
  }, [])

  const loadLabels = useCallback(async () => {
    try {
      const res = await fetch("/api/todoist/labels")
      if (res.ok) {
        const data = await res.json()
        setLabels(data.data ?? [])
      }
    } catch {
      // silent
    }
  }, [])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (projectFilter !== "all") params.set("project_id", projectFilter)
      if (labelFilter !== "all") params.set("label", labelFilter)
      if (completedFilter !== undefined) params.set("completed", String(completedFilter))

      const res = await fetch(`/api/todoist?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.data ?? [])
        setLastSynced(new Date())
      }
    } catch {
      toast.error("Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }, [projectFilter, labelFilter, completedFilter])

  const syncedLabel = useMemo(() => {
    if (!lastSynced) return null
    const seconds = Math.round((Date.now() - lastSynced.getTime()) / 1000)
    if (seconds < 10) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    return `${hours}h ago`
  }, [lastSynced])

  useEffect(() => {
    void loadProjects()
    void loadLabels()
  }, [loadProjects, loadLabels])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  const filteredTasks = useMemo(() => {
    let result = tasks

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.content.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assignee?.toLowerCase().includes(q)
      )
    }

    if (completedFilter !== undefined) {
      result = result.filter((t) => t.completed === completedFilter)
    }

    result = [...result].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      const priorityDiff = (b.priority ?? 1) - (a.priority ?? 1)
      if (priorityDiff !== 0) return priorityDiff
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    return result
  }, [tasks, search, completedFilter])

  const handleAdd = () => {
    setEditingTask(null)
    setForm({ content: "", description: "", projectId: "", labels: [], priority: 1, dueDate: "", reminder: true })
    setShowForm(true)
  }

  const handleEdit = (task: TodoistTask) => {
    setEditingTask(task)
    setForm({
      content: task.content,
      description: task.description ?? "",
      projectId: task.project_id ?? "",
      labels: task.labels ?? (task.metadata?.labels as string[]) ?? [],
      priority: task.priority ?? 1,
      dueDate: task.due_date ?? "",
      reminder: true,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (submittingRef.current) return
    if (!form.content.trim()) {
      toast.error("Task content is required")
      return
    }

    submittingRef.current = true
    setSaving(true)
    try {
      const payload = {
        content: form.content,
        description: form.description || null,
        projectId: form.projectId || null,
        labels: form.labels,
        priority: form.priority,
        dueDate: form.dueDate || null,
      }

      const url = editingTask ? `/api/todoist/${editingTask.id}` : "/api/todoist"
      const method = editingTask ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let message = editingTask ? "Failed to update task" : "Failed to create task"
        try {
          const body = await res.json()
          if (body?.error) message = body.error
        } catch {
          // keep generic message
        }
        toast.error(message)
        return
      }

      toast.success(editingTask ? "Task updated" : "Task created")
      setShowForm(false)
    setForm({ content: "", description: "", projectId: "", labels: [], priority: 1, dueDate: "", reminder: true })
      setEditingTask(null)
      await loadTasks()
    } catch {
      toast.error(editingTask ? "Failed to update task" : "Failed to create task")
    } finally {
      setSaving(false)
      submittingRef.current = false
    }
  }

  const busyIds = useRef<Set<string>>(new Set())

  const handleComplete = async (task: TodoistTask) => {
    if (busyIds.current.has(task.id)) return
    busyIds.current.add(task.id)
    try {
      const res = await fetch(`/api/todoist/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      })
      if (res.ok) {
        toast.success("Task completed")
        await loadTasks()
      } else {
        toast.error("Failed to complete task")
      }
    } catch {
      toast.error("Failed to complete task")
    } finally {
      busyIds.current.delete(task.id)
    }
  }

  const handleDelete = async (task: TodoistTask) => {
    if (busyIds.current.has(task.id)) return
    busyIds.current.add(task.id)
    try {
      const res = await fetch(`/api/todoist/${task.id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Task deleted")
        await loadTasks()
      } else {
        toast.error("Failed to delete task")
      }
    } catch {
      toast.error("Failed to delete task")
    } finally {
      busyIds.current.delete(task.id)
    }
  }

  const toggleLabel = (label: string) => {
    setForm((prev) => ({
      ...prev,
      labels: prev.labels.includes(label) ? prev.labels.filter((l) => l !== label) : [...prev.labels, label],
    }))
  }

  const activeProject = projects.find((p) => p.id === projectFilter)
  const completedCount = tasks.filter((t) => t.completed).length
  const overdueCount = tasks.filter((t) => !t.completed && t.due_date && new Date(t.due_date) < new Date()).length

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Todoist</h1>
        <p className="text-xs text-foreground/40">
          {tasks.length} tasks · {completedCount} completed · {overdueCount} overdue
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={projectFilter} onValueChange={(val) => val && setProjectFilter(val)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={labelFilter} onValueChange={(val) => val && setLabelFilter(val)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="All labels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              {labels.map((l) => (
                <SelectItem key={l.id} value={l.name}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              variant={completedFilter === undefined ? "secondary" : "outline"}
              size="sm"
              onClick={() => setCompletedFilter(undefined)}
            >
              All
            </Button>
            <Button
              variant={completedFilter === false ? "secondary" : "outline"}
              size="sm"
              onClick={() => setCompletedFilter(false)}
            >
              Active
            </Button>
            <Button
              variant={completedFilter === true ? "secondary" : "outline"}
              size="sm"
              onClick={() => setCompletedFilter(true)}
            >
              Done
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadTasks}
                    disabled={loading}
                    aria-label="Refresh tasks"
                  />
                }
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              </TooltipTrigger>
              <TooltipContent>Refresh tasks</TooltipContent>
            </Tooltip>
            {syncedLabel ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Synced {syncedLabel}
              </span>
            ) : null}
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 size-4" />
            Add Task
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm">Loading tasks...</span>
          </CardContent>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Filter className="size-6" />
              <span className="text-sm">No tasks found.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className={cn("flex flex-col", task.completed && "opacity-60")}>
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", task.completed && "line-through")}>
                        {task.content}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] uppercase", PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[1])}>
                        {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] || "Normal"}
                      </Badge>
                      {task.due_date && (
                        <Badge variant={new Date(task.due_date) < new Date() && !task.completed ? "destructive" : "secondary"} className="text-[10px]">
                          {format(new Date(task.due_date), "MMM d, h:mm a")}
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {activeProject && (
                        <Badge variant="outline" className="text-[10px]">{activeProject.name}</Badge>
                      )}
                      {(task.labels ?? (task.metadata?.labels as string[] | undefined))?.map((label) => (
                        <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>
                      ))}
                      {task.assignee && (
                        <span className="text-[10px] text-muted-foreground">Assignee: {task.assignee}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!task.completed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleComplete(task)}
                        title="Complete"
                      >
                        <Check className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleEdit(task)}
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleDelete(task)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTask ? "Edit Task" : "New Task"}</SheetTitle>
            <SheetDescription>
              {editingTask ? "Update your task details." : "Create a new task in Todoist."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Content</Label>
              <Input
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="What needs to be done?"
                required
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Add details..."
                className="text-xs"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Project</Label>
                <Select value={form.projectId ?? ""} onValueChange={(val) => setForm({ ...form, projectId: val ?? "" })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={String(form.priority)} onValueChange={(val) => setForm({ ...form, priority: Number(val) })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Normal</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                    <SelectItem value="4">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Due Date</Label>
              <DeadlinePicker
                value={form.dueDate}
                onChange={(v) => setForm({ ...form, dueDate: v })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Labels</Label>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <Badge
                    key={label.id}
                    variant={form.labels.includes(label.name) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleLabel(label.name)}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="reminder"
                checked={form.reminder}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, reminder: v }))}
              />
              <Label htmlFor="reminder" className="text-xs">
                Email reminder {form.reminder ? "enabled" : "disabled"} (1 hour before deadline)
              </Label>
            </div>
          </div>
          <SheetFooter className="px-4">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
