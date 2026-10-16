"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  GripVertical,
  MoreHorizontal,
} from "lucide-react"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

export type ActivityItem = {
  id: string
  header: string
  type: string
  status: "Done" | "In Progress" | "Not Started" | "Failed"
  target: string
  limit: string
  reviewer: string
  source: string
  updatedAt: string
}

const columnHelper = createColumnHelper<typeof features, ActivityItem>()

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-ink-faint opacity-0 transition-opacity duration-[120ms] hover:bg-transparent hover:text-ink-strong hover:opacity-100 group-hover:opacity-40 focus-visible:opacity-100 cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
      <span className="sr-only">Drag to reorder</span>
   </Button>
  )
}

const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
     </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
     </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("header", {
    header: "Item",
    cell: ({ row }) => <SheetItemViewer item={row.original} />,
    enableHiding: false,
  }),
  columnHelper.accessor("type", {
    header: "Type",
    cell: ({ row }) => (
      <div className="w-32">
        <Badge variant="outline">
          {row.original.type}
       </Badge>
     </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          "border-transparent",
          row.original.status === "Done" && "bg-status-live-bg text-status-live",
          row.original.status === "In Progress" && "bg-flame-wash text-flame",
          row.original.status === "Failed" && "bg-status-danger-bg text-status-danger",
          row.original.status !== "Done" &&
            row.original.status !== "In Progress" &&
            row.original.status !== "Failed" &&
            "bg-status-neutral-bg text-status-neutral"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            row.original.status === "Done" && "bg-status-live",
            row.original.status === "In Progress" && "bg-flame-vivid",
            row.original.status === "Failed" && "bg-status-danger",
            row.original.status !== "Done" &&
              row.original.status !== "In Progress" &&
              row.original.status !== "Failed" &&
              "bg-status-neutral"
          )}
        />
        {row.original.status}
     </Badge>
    ),
  }),
  columnHelper.accessor("target", {
    header: () => <div className="w-full text-right">Target</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Target
       </Label>
        <Input
          className="h-8 w-16 rounded-sm border border-transparent bg-transparent px-2 text-right tabular-nums outline-none transition-[border-color,background-color] hover:bg-hover-tint focus-visible:border-rule-strong focus-visible:bg-surface"
          defaultValue={row.original.target}
          id={`${row.original.id}-target`}
        />
     </form>
    ),
  }),
  columnHelper.accessor("limit", {
    header: () => <div className="w-full text-right">Limit</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Limit
       </Label>
        <Input
          className="h-8 w-16 rounded-sm border border-transparent bg-transparent px-2 text-right tabular-nums outline-none transition-[border-color,background-color] hover:bg-hover-tint focus-visible:border-rule-strong focus-visible:bg-surface"
          defaultValue={row.original.limit}
          id={`${row.original.id}-limit`}
        />
     </form>
    ),
  }),
  columnHelper.accessor("reviewer", {
    header: "Reviewer",
    cell: ({ row }) =>       <span>{row.original.reviewer}</span>,
  }),
  columnHelper.display({
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 rounded-full text-ink-muted hover:bg-hover-tint hover:text-ink-strong data-[popup-open]:bg-hover-tint"
              size="icon"
            />
          }
        >
          <MoreHorizontal />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
    ),
  }),
])

function Input({
  className,
  type = "text",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded-sm border border-transparent bg-transparent px-2.5 py-1 text-sm text-ink-strong tabular-nums transition-[border-color,background-color] outline-none placeholder:text-ink-faint hover:bg-hover-tint focus-visible:border-rule-strong focus-visible:bg-surface disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
        className
      )}
      {...props}
    />
  )
}

function DraggableRow({ row }: { row: Row<typeof features, ActivityItem> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="group relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
       </TableCell>
      ))}
   </TableRow>
  )
}

export function DataTable({ data: initialData }: { data: ActivityItem[] }) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" />
            }
          >
            <Columns2 />
            <span className="hidden lg:inline">Customize columns</span>
            <span className="lg:hidden">Columns</span>
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" &&
                  column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                 </DropdownMenuCheckboxItem>
                )
              })}
         </DropdownMenuContent>
       </DropdownMenu>
     </div>
      <div className="relative flex flex-col gap-4">
        <div className="overflow-hidden rounded-lg border border-rule bg-surface shadow-raised">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <FlexRender header={header} />
                          )}
                       </TableHead>
                      )
                    })}
                 </TableRow>
                ))}
             </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                 </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                   </TableCell>
                 </TableRow>
                )}
             </TableBody>
           </Table>
         </DndContext>
       </div>
        <div className="flex items-center justify-between">
          <div className="hidden flex-1 text-[13px] text-ink-muted lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
         </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
             </Label>
              <select
                value={`${table.state.pagination.pageSize}`}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-9 rounded-pill border border-rule-strong bg-surface px-3 text-[13px] text-ink-strong outline-none"
                id="rows-per-page"
              >
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </option>
                ))}
              </select>
           </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium tabular-nums">
              Page {table.state.pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
           </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                size="icon-sm"
                className="hidden lg:flex rounded-full"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft />
             </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft />
             </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight />
             </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight />
             </Button>
           </div>
         </div>
       </div>
      </div>
    </div>
  )
}

function SheetItemViewer({ item }: { item: ActivityItem }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button className="w-fit px-0 text-left text-foreground hover:underline cursor-pointer" />
        }
      >
        {item.header}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{item.header}</SheetTitle>
          <SheetDescription>
            {item.type} · {item.status}
         </SheetDescription>
       </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="grid gap-2">
            <div className="flex gap-2 leading-none font-medium">
              {item.source}
           </div>
            <div className="text-muted-foreground">
              Last updated {new Date(item.updatedAt).toLocaleString()}
           </div>
         </div>
          <Separator />
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Target</Label>
                <span className="font-value text-sm">{item.target}</span>
             </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Limit</Label>
                <span className="font-value text-sm">{item.limit}</span>
             </div>
           </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Reviewer</Label>
              <span>{item.reviewer}</span>
           </div>
         </div>
       </div>
     </SheetContent>
   </Sheet>
  )
}
