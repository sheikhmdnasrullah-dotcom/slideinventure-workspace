"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Edit3, Plus, Search, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { AddCommandDialog, type CommandFormValues } from "./add-command-dialog"

export type TerminalCommand = {
  id: string
  title: string
  command: string
  description?: string | null
  category?: string | null
  tags?: string[]
  notes?: string | null
  variables?: Record<string, unknown>
  favorite?: boolean
  cwd?: string | null
  exitCode?: number | null
  stdout?: string | null
  stderr?: string | null
  durationMs?: number | null
  triggeredBy?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt?: string
}

const CATEGORIES = [
  "network",
  "docker",
  "git",
  "kubernetes",
  "aws",
  "database",
  "system",
  "dev",
  "security",
  "other",
]

export function TerminalCommands() {
  const [commands, setCommands] = useState<TerminalCommand[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingCommand, setEditingCommand] = useState<TerminalCommand | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [favoriteFilter, setFavoriteFilter] = useState(false)

  const loadCommands = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      if (favoriteFilter) params.set("favorite", "true")

      const res = await fetch(`/api/terminal?${params.toString()}`, { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        setCommands(json.data ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, favoriteFilter])

  useEffect(() => {
    loadCommands()
  }, [loadCommands])

  const handleCopy = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      toast.success("Command copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }, [])

  const handleEdit = (command: TerminalCommand) => {
    setEditingCommand(command)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/terminal/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error?.message || "Delete failed")
        return
      }
      toast.success("Command deleted")
      await loadCommands()
    } catch {
      toast.error("Delete failed")
    }
  }

  const handleToggleFavorite = async (command: TerminalCommand) => {
    try {
      const res = await fetch(`/api/terminal/${command.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !command.favorite }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error?.message || "Update failed")
        return
      }
      await loadCommands()
    } catch {
      toast.error("Update failed")
    }
  }

  const handleSaved = () => {
    setEditingCommand(null)
    loadCommands()
  }

  const filteredCommands = useMemo(() => {
    let result = commands

    if (favoriteFilter) {
      result = result.filter((c) => c.favorite)
    }

    if (categoryFilter !== "all") {
      result = result.filter((c) => c.category === categoryFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.command.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }

    const favorites = result.filter((c) => c.favorite)
    const rest = result.filter((c) => !c.favorite)

    return { favorites, rest, total: result.length }
  }, [commands, search, categoryFilter, favoriteFilter])

  const categories = useMemo(() => {
    const cats = new Set(commands.map((c) => c.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [commands])

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredCommands.total}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={() => { setEditingCommand(null); setShowForm(true) }}>
            <Plus className="mr-2 size-4" />
            Add Command
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Category</Label>
          <Select value={categoryFilter} onValueChange={(val: any) => setCategoryFilter(val || "all")}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">Filter</Label>
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <Star className={cn("size-4", favoriteFilter ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
            <Switch checked={favoriteFilter} onCheckedChange={setFavoriteFilter} />
            <span className="text-xs text-muted-foreground">Favorites only</span>
          </div>
        </div>
      </div>

      {loading && commands.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm">Loading commands...</span>
          </CardContent>
        </Card>
      ) : filteredCommands.total === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Search className="size-6" />
              <span className="text-sm">No commands found.</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCommands.favorites.map((cmd) => (
            <CommandCard
              key={cmd.id}
              command={cmd}
              onCopy={handleCopy}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
          {filteredCommands.rest.map((cmd) => (
            <CommandCard
              key={cmd.id}
              command={cmd}
              onCopy={handleCopy}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCommand ? "Edit Command" : "Add Command"}</SheetTitle>
          </SheetHeader>
          <AddCommandDialog
            open={showForm}
            onOpenChange={setShowForm}
            onSaved={handleSaved}
            editingCommand={editingCommand as any}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CommandCard({
  command,
  onCopy,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  command: TerminalCommand
  onCopy: (cmd: string) => void
  onEdit: (cmd: TerminalCommand) => void
  onDelete: (id: string) => void
  onToggleFavorite: (cmd: TerminalCommand) => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <Card className="flex flex-col" data-favorite={command.favorite}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-medium">{command.title}</CardTitle>
          {command.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{command.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onToggleFavorite(command)}
          >
            <Star
              className={cn(
                "size-3.5",
                command.favorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"
              )}
            />
            <span className="sr-only">{command.favorite ? "Unfavorite" : "Favorite"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onCopy(command.command)}
          >
            <Copy className="size-3.5" />
            <span className="sr-only">Copy command</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setShowActions(!showActions)}
          >
            <Edit3 className="size-3.5" />
            <span className="sr-only">More actions</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <code className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
            {command.command}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {command.category && (
            <Badge variant="outline" className="text-xs">
              {command.category}
            </Badge>
          )}
          {(command.tags ?? []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        {command.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{command.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
