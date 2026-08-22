"use client"

import { useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type LeadColumnConfig = {
  id: string
  key: string
  label: string
  visible: boolean
  sortable: boolean
  filterable: boolean
  type: "text" | "composite" | "status" | "select" | "actions" | "custom"
  width?: number
}

const BUILT_IN_KEYS = [
  "first_name",
  "last_name",
  "email",
  "company",
  "job_title",
  "phone",
  "source",
  "status",
  "notes",
  "tags",
]

const DEFAULT_COLUMNS: LeadColumnConfig[] = [
  { id: "select", key: "_select", label: "", visible: true, sortable: false, filterable: false, type: "select", width: 50 },
  { id: "contact", key: "first_name", label: "Contact", visible: true, sortable: true, filterable: true, type: "composite", width: 300 },
  { id: "company", key: "company", label: "Company", visible: true, sortable: true, filterable: false, type: "composite", width: 250 },
  { id: "phone", key: "phone", label: "Phone", visible: true, sortable: true, filterable: false, type: "text", width: 150 },
  { id: "source", key: "source", label: "Source", visible: true, sortable: true, filterable: true, type: "select", width: 120 },
  { id: "status", key: "status", label: "Status", visible: true, sortable: true, filterable: true, type: "status", width: 120 },
  { id: "actions", key: "_actions", label: "", visible: true, sortable: false, filterable: false, type: "actions", width: 100 },
]

interface ColumnConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: LeadColumnConfig[]
  onSave: (columns: LeadColumnConfig[]) => void
  customFieldKeys: string[]
  onAddCustomField?: (key: string, label: string) => void
}

function SortableColumnItem({
  column,
  onUpdate,
  onRemove,
  canRemove,
  customFieldKeys,
}: {
  column: LeadColumnConfig
  onUpdate: (column: LeadColumnConfig) => void
  onRemove: () => void
  canRemove: boolean
  customFieldKeys: string[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background p-3",
        isDragging && "opacity-80"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </Button>

      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={column.label}
          onChange={(e) => onUpdate({ ...column, label: e.target.value })}
          placeholder="Column label"
          className="h-8 sm:w-40"
          disabled={column.type === "select" || column.type === "actions"}
        />
        {column.type === "custom" && (
          <Input
            value={column.key}
            onChange={(e) => onUpdate({ ...column, key: e.target.value })}
            placeholder="Field key"
            className="h-8 sm:w-40"
            list="custom-field-keys"
          />
        )}
        <datalist id="custom-field-keys">
          {customFieldKeys.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={column.visible}
              onCheckedChange={(checked) => onUpdate({ ...column, visible: checked })}
              disabled={column.type === "select" || column.type === "actions"}
            />
            <Label className="text-xs">Visible</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={column.sortable}
              onCheckedChange={(checked) => onUpdate({ ...column, sortable: checked })}
              disabled={column.type === "select" || column.type === "actions"}
            />
            <Label className="text-xs">Sort</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={column.filterable}
              onCheckedChange={(checked) => onUpdate({ ...column, filterable: checked })}
              disabled={column.type === "select" || column.type === "actions"}
            />
            <Label className="text-xs">Filter</Label>
          </div>
        </div>
      </div>

      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

export function ColumnConfigDialog({
  open,
  onOpenChange,
  columns,
  onSave,
  customFieldKeys,
}: ColumnConfigDialogProps) {
  const [localColumns, setLocalColumns] = useState<LeadColumnConfig[]>(columns)
  const [newCustomLabel, setNewCustomLabel] = useState("")
  const [newCustomKey, setNewCustomKey] = useState("")

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setLocalColumns((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id)
        const newIndex = prev.findIndex((c) => c.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function handleUpdate(id: string, patch: Partial<LeadColumnConfig>) {
    setLocalColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    )
  }

  function handleRemove(id: string) {
    setLocalColumns((prev) => prev.filter((c) => c.id !== id))
  }

  function handleAddCustomField() {
    const label = newCustomLabel.trim() || newCustomKey.trim()
    const key = newCustomKey.trim() || newCustomLabel.trim().toLowerCase().replace(/\s+/g, "_")
    if (!label || !key) {
      toast.error("Enter a label or key for the custom field")
      return
    }

    const exists = localColumns.some((c) => c.key === key)
    if (exists) {
      toast.error("A column with this key already exists")
      return
    }

    const newColumn: LeadColumnConfig = {
      id: `custom_${key}`,
      key,
      label,
      visible: true,
      sortable: true,
      filterable: false,
      type: "custom",
      width: 180,
    }

    setLocalColumns((prev) => [...prev, newColumn])
    setNewCustomLabel("")
    setNewCustomKey("")
  }

  function handleSave() {
    onSave(localColumns)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
          <DialogDescription>
            Rename, reorder, show, or hide columns. Add custom fields below.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={localColumns.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-1">
              {localColumns.map((column) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onUpdate={(patch) => handleUpdate(column.id, patch)}
                  onRemove={() => handleRemove(column.id)}
                  canRemove={column.type !== "select" && column.type !== "actions"}
                  customFieldKeys={customFieldKeys}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex items-end gap-2 rounded-lg border p-3">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={newCustomLabel}
                onChange={(e) => setNewCustomLabel(e.target.value)}
                placeholder="Custom field label"
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Key</Label>
              <Input
                value={newCustomKey}
                onChange={(e) => setNewCustomKey(e.target.value)}
                placeholder="field_key"
                className="h-8"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddCustomField}>
            <Plus className="mr-2 size-4" />
            Add Field
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 size-4" />
            Save Columns
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
