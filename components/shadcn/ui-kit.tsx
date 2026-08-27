"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const COMPONENTS = [
  { name: "Button", desc: "Clickable trigger (cva variants)" },
  { name: "Badge", desc: "Compact status pill" },
  { name: "Input", desc: "Text field" },
  { name: "Tabs", desc: "Sectioned view" },
  { name: "Dialog", desc: "Modal surface" },
  { name: "Table", desc: "Tabular data" },
  { name: "Command", desc: "cmdk-powered palette" },
];

export function UiKit() {
  const [cmdOpen, setCmdOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="components">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="table">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Error</Badge>
          </div>

          <div className="max-w-sm">
            <Input placeholder="Standard input" />
          </div>

          <Dialog>
            <DialogTrigger
              render={<Button variant="outline">Open Dialog</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>shadcn Dialog</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Accessible modal rendered with Radix under the shadcn API.
              </p>
            </DialogContent>
          </Dialog>

          <div>
            <Button variant="secondary" onClick={() => setCmdOpen(true)}>
              Open Command Palette (⌘K)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="table">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPONENTS.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.desc}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search components" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="shadcn/ui">
            {COMPONENTS.map((c) => (
              <CommandItem
                key={c.name}
                onSelect={() => setCmdOpen(false)}
              >
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
