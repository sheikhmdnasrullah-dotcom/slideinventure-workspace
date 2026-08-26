"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  MoreVertical,
  ArrowLeft,
  Loader2,
  FileText,
  LayoutGrid,
  ArrowUpDown,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { BoardWindow } from "@/components/dashboard/v3/whiteboard/BoardWindow"

type Board = {
  id: string
  title: string | null
  content: string
  created_at: string
  updated_at: string
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000))
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`
  return new Date(iso).toLocaleDateString()
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function BrainstormWorkspace({ boardId }: { boardId: string | null }) {
  const router = useRouter()

  const [boards, setBoards] = React.useState<Board[]>([])
  const [loadingBoards, setLoadingBoards] = React.useState(true)

  const [activeId, setActiveId] = React.useState<string | null>(boardId)
  const [notFound, setNotFound] = React.useState(false)

  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<"recent" | "alpha">("recent")

  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState("")

  const [deleteTarget, setDeleteTarget] = React.useState<Board | null>(null)
  const [mobileBoardsOpen, setMobileBoardsOpen] = React.useState(false)

  // ---- data loading ---------------------------------------------------------
  const loadBoards = React.useCallback(async () => {
    try {
      const res = await fetch("/api/boards")
      const data = await res.json()
      setBoards((data.boards ?? []) as Board[])
    } catch {
      toast.error("Failed to load boards")
    } finally {
      setLoadingBoards(false)
    }
  }, [])

  // Just an existence check (for the not-found view) — BoardWindow does its
  // own fetch of the board's actual content when it opens.
  const checkBoardExists = React.useCallback(async (id: string) => {
    setNotFound(false)
    try {
      const res = await fetch(`/api/boards/${id}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      setActiveId(id)
      try {
        localStorage.setItem("brainstorm:lastBoard", id)
      } catch {
        /* ignore */
      }
    } catch {
      toast.error("Failed to open board")
    }
  }, [])

  React.useEffect(() => {
    loadBoards()
  }, [loadBoards])

  React.useEffect(() => {
    if (boardId) {
      checkBoardExists(boardId)
    } else {
      setActiveId(null)
    }
    setRenamingId(null)
  }, [boardId, checkBoardExists])

  // ---- navigation -----------------------------------------------------------
  const openBoard = (id: string) => {
    router.push(`/brainstorm-sketch/${id}`)
    setMobileBoardsOpen(false)
  }

  const backToList = () => {
    router.push("/brainstorm-sketch")
  }

  // ---- board mutations ------------------------------------------------------
  const createBoard = async () => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Brainstorm" }),
      })
      const data = await res.json()
      const board = data.board as Board
      setBoards((prev) => [board, ...prev])
      toast.success("Board created")
      openBoard(board.id)
    } catch {
      toast.error("Failed to create board")
    }
  }

  const startRename = (board: Board) => {
    setRenamingId(board.id)
    setRenameValue(board.title ?? "")
  }

  const commitRename = async (id: string, name: string) => {
    const clean = name.trim() || "Untitled"
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, title: clean } : b)))
    setRenamingId(null)
    try {
      await fetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: clean }),
      })
    } catch {
      toast.error("Failed to rename board")
    }
  }

  const cancelRename = () => setRenamingId(null)

  const duplicateBoard = async (board: Board) => {
    try {
      const res = await fetch(`/api/boards/${board.id}`)
      const data = await res.json()
      const content = data.board?.content ?? "{}"
      const res2 = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${board.title || "Untitled"} (copy)`, content }),
      })
      const data2 = await res2.json()
      setBoards((prev) => [data2.board as Board, ...prev])
      toast.success("Board duplicated")
    } catch {
      toast.error("Failed to duplicate board")
    }
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target) return
    try {
      await fetch(`/api/boards/${target.id}`, { method: "DELETE" })
      setBoards((prev) => prev.filter((b) => b.id !== target.id))
      toast.success("Board deleted")
      if (activeId === target.id) {
        backToList()
      }
    } catch {
      toast.error("Failed to delete board")
    } finally {
      setDeleteTarget(null)
    }
  }

  // ---- derived --------------------------------------------------------------
  const visibleBoards = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q ? boards.filter((b) => (b.title ?? "Untitled").toLowerCase().includes(q)) : boards
    return [...filtered].sort((a, b) =>
      sort === "alpha"
        ? (a.title ?? "").localeCompare(b.title ?? "")
        : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [boards, search, sort])

  const lastBoardId = React.useMemo(() => {
    try {
      return localStorage.getItem("brainstorm:lastBoard")
    } catch {
      return null
    }
  }, [])
  const lastBoard = lastBoardId ? boards.find((b) => b.id === lastBoardId) : undefined
  const recent = boards.slice(0, 6)

  // ---- render ---------------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top-level header (mobile boards toggle + brand) */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileBoardsOpen(true)}
            aria-label="Open boards"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight md:text-2xl">Brainstorm Sketch</h1>
            <p className="hidden text-sm text-muted-foreground md:block">
              A calm space to think visually.
            </p>
          </div>
        </div>
        <Button onClick={createBoard} size="sm" className="gap-2">
          <Plus className="size-4" /> New Board
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
          <Sidebar
            boards={visibleBoards}
            loading={loadingBoards}
            activeId={activeId}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            renamingId={renamingId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onOpen={openBoard}
            onStartRename={startRename}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onDuplicate={duplicateBoard}
            onRequestDelete={setDeleteTarget}
            onCreate={createBoard}
          />
        </aside>

        {/* Mobile boards sheet */}
        <SheetWrap open={mobileBoardsOpen} onOpenChange={setMobileBoardsOpen}>
          <Sidebar
            boards={visibleBoards}
            loading={loadingBoards}
            activeId={activeId}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            renamingId={renamingId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onOpen={(id) => {
              openBoard(id)
            }}
            onStartRename={startRename}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onDuplicate={duplicateBoard}
            onRequestDelete={setDeleteTarget}
            onCreate={createBoard}
          />
        </SheetWrap>

        {/* Main area — always the list/landing view underneath; the open
            board itself is a popup window (BoardWindow) on top of it, not
            an inline section here. */}
        <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
          {boardId && notFound ? (
            <NotFountView onBack={backToList} />
          ) : (
            <LandingView
              greeting={greeting()}
              recent={recent}
              lastBoard={lastBoard}
              onCreate={createBoard}
              onOpen={openBoard}
            />
          )}
        </div>
      </div>

      <BoardWindow
        boardId={activeId}
        open={!!boardId && !notFound}
        onOpenChange={(o) => { if (!o) backToList() }}
        onChanged={(patch) => {
          if (!activeId) return
          setBoards((prev) => prev.map((b) => (b.id === activeId ? { ...b, ...patch } : b)))
        }}
        backLabel="Back to boards"
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this board?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title || "Untitled"}” will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="mr-2 size-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Sidebar(props: {
  boards: Board[]
  loading: boolean
  activeId: string | null
  search: string
  setSearch: (v: string) => void
  sort: "recent" | "alpha"
  setSort: (v: "recent" | "alpha") => void
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  onOpen: (id: string) => void
  onStartRename: (b: Board) => void
  onCommitRename: (id: string, name: string) => void
  onCancelRename: () => void
  onDuplicate: (b: Board) => void
  onRequestDelete: (b: Board) => void
  onCreate: () => void
}) {
  const {
    boards,
    loading,
    activeId,
    search,
    setSearch,
    setSort,
    renamingId,
    renameValue,
    setRenameValue,
    onOpen,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onDuplicate,
    onRequestDelete,
    onCreate,
  } = props

  // See the matching comment in BrainstormWorkspace: the dropdown menu
  // restores focus to its trigger as it closes, which races the rename
  // input's autoFocus and immediately blurs/commits it. Deferring two
  // frames lets that restoration finish before the input mounts.
  const deferStartRename = (b: Board) => {
    requestAnimationFrame(() => requestAnimationFrame(() => onStartRename(b)))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Boards
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Sort boards">
                <ArrowUpDown className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSort("recent")}>Recent first</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("alpha")}>Alphabetical</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search boards…"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : boards.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {search ? "No boards match your search." : "No boards yet."}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {boards.map((b) => (
              <div
                key={b.id}
                className={`group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  activeId === b.id ? "border-foreground/20 bg-accent" : "hover:bg-accent/50"
                }`}
              >
                {renamingId === b.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={(e) => onCommitRename(b.id, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onCommitRename(b.id, e.currentTarget.value)
                      if (e.key === "Escape") onCancelRename()
                    }}
                    className="h-9 flex-1 text-sm font-medium"
                  />
                ) : (
                  <button
                    onClick={() => onOpen(b.id)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <FileText className="mb-1 size-4 text-muted-foreground" />
                    <span className="w-full truncate text-sm font-medium">
                      {b.title || "Untitled"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(b.updated_at)}</span>
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Board actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => deferStartRename(b)}>
                      <Pencil className="mr-2 size-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(b)}>
                      <Copy className="mr-2 size-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onRequestDelete(b)}
                    >
                      <Trash2 className="mr-2 size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-2">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onCreate}>
          <Plus className="size-4" /> New Board
        </Button>
      </div>
    </div>
  )
}

function LandingView({
  greeting,
  recent,
  lastBoard,
  onCreate,
  onOpen,
}: {
  greeting: string
  recent: Board[]
  lastBoard?: Board
  onCreate: () => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 md:py-16">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{greeting}.</h2>
        <p className="mt-1 text-muted-foreground">
          This is your visual thinking workspace. Sketch ideas, map concepts, and pick up right where you left off.
        </p>

        {lastBoard && (
          <button
            onClick={() => onOpen(lastBoard.id)}
            className="mt-8 flex w-full items-center justify-between rounded-xl border bg-background p-5 text-left transition-colors hover:bg-accent/40"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Continue where you left off
              </div>
              <div className="mt-1 text-lg font-semibold">{lastBoard.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground">Edited {timeAgo(lastBoard.updated_at)}</div>
            </div>
            <ArrowLeft className="size-5 rotate-180 text-muted-foreground" />
          </button>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Recent boards</h3>
          <Button onClick={onCreate} size="sm" className="gap-2">
            <Plus className="size-4" /> New Board
          </Button>
        </div>

        {recent.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Start thinking visually. Create a board to map an idea, sketch a concept, or explore a problem.
            </p>
            <Button onClick={onCreate} className="mt-4 gap-2">
              <Plus className="size-4" /> New Board
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((b) => (
              <button
                key={b.id}
                onClick={() => onOpen(b.id)}
                className="flex flex-col items-start rounded-xl border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <span className="w-full truncate text-sm font-medium">{b.title || "Untitled"}</span>
                <span className="text-[11px] text-muted-foreground">Edited {timeAgo(b.updated_at)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NotFountView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileText className="size-6" />
      </div>
      <div>
        <h3 className="text-base font-medium">Board not found</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This board may have been deleted or is no longer available.
        </p>
      </div>
      <Button onClick={onBack}>
        <ArrowLeft className="mr-2 size-4" /> Back to Brainstorm Sketch
      </Button>
    </div>
  )
}

function SheetWrap({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Boards</SheetTitle>
          <SheetDescription>Select a brainstorm board</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
