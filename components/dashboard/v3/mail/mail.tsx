"use client"

import * as React from "react"
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  Pencil,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Users2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { toast } from "sonner"

import { AccountSwitcher } from "./account-switcher"
import { MailDisplay } from "./mail-display"
import { MailList } from "./mail-list"
import { Nav } from "./nav"
import { useMail } from "./use-mail"

interface MailProps {
  defaultLayout?: number[]
  defaultCollapsed?: boolean
  navCollapsedSize: number
}

// Map display names → IMAP folder paths (common Mailcow/Dovecot structure)
const FOLDER_MAP: Record<string, string> = {
  Inbox: "INBOX",
  Drafts: "Drafts",
  Sent: "Sent",
  Junk: "Junk",
  Trash: "Trash",
  Archive: "Archive",
}

export function Mail({
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: MailProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const {
    accounts, account, setAccount,
    selected, folders, loading, search, setSearch,
    setFolder, folder, refresh, composeOpen, setComposeOpen, sendMessage,
  } = useMail()

  // Mapped accounts for the switcher (reusing the same icon for all)
  const switcherAccounts = React.useMemo(() => accounts.map(a => ({
    label: a.name,
    email: a.email,
    icon: (
      <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <title>Mail</title>
        <path
          d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
          fill="currentColor"
        />
      </svg>
    ),
  })), [accounts])

  // Compose form state
  const [composeTo, setComposeTo] = React.useState("")
  const [composeSubject, setComposeSubject] = React.useState("")
  const [composeBody, setComposeBody] = React.useState("")
  const [composeSending, setComposeSending] = React.useState(false)

  // Build nav links with live unread counts from folders API
  function getUnread(name: string): string {
    const path = FOLDER_MAP[name] ?? name
    const f = folders.find((f) => f.path === path || f.name === name)
    return f && f.unread > 0 ? String(f.unread) : ""
  }

  function getVariant(name: string): "default" | "ghost" {
    const path = FOLDER_MAP[name] ?? name
    return folder === path ? "default" : "ghost"
  }

  async function handleComposeSend() {
    if (!composeTo || !composeSubject || !composeBody) {
      toast.error("Fill in To, Subject and Body")
      return
    }
    setComposeSending(true)
    try {
      await sendMessage(composeTo, composeSubject, composeBody)
      setComposeOpen(false)
      setComposeTo("")
      setComposeSubject("")
      setComposeBody("")
    } catch (e) {
      toast.error(String(e))
    } finally {
      setComposeSending(false)
    }
  }

  return (
    <TooltipProvider delay={0}>
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(layout) => {
          document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(
            [layout.nav, layout.list, layout.display]
          )}`
        }}
        className="h-full max-h-[800px] items-stretch"
      >
        {/* ─── LEFT NAV ─── */}
        <ResizablePanel
          id="nav"
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={15}
          maxSize={20}
          onResize={(panelSize) => {
            const nowCollapsed = panelSize.asPercentage <= navCollapsedSize
            setIsCollapsed(nowCollapsed)
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(nowCollapsed)}`
          }}
          className={cn(
            isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
        >
          <div className={cn(
            "flex h-[52px] items-center justify-center",
            isCollapsed ? "h-[52px]" : "px-2"
          )}>
            <AccountSwitcher 
              isCollapsed={isCollapsed} 
              accounts={switcherAccounts} 
              account={account}
              setAccount={setAccount}
            />
          </div>
          <Separator />
          {/* Compose button */}
          {!isCollapsed && (
            <div className="px-2 py-2">
              <Button
                className="w-full justify-start gap-2"
                size="sm"
                onClick={() => setComposeOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                Compose
              </Button>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setComposeOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Nav
            isCollapsed={isCollapsed}
            links={[
              { title: "Inbox",   label: getUnread("Inbox"),   icon: Inbox,    variant: getVariant("Inbox"),   onClick: () => setFolder("INBOX") },
              { title: "Drafts",  label: getUnread("Drafts"),  icon: File,     variant: getVariant("Drafts"),  onClick: () => setFolder("Drafts") },
              { title: "Sent",    label: getUnread("Sent"),    icon: Send,     variant: getVariant("Sent"),    onClick: () => setFolder("Sent") },
              { title: "Junk",    label: getUnread("Junk"),    icon: ArchiveX, variant: getVariant("Junk"),    onClick: () => setFolder("Junk") },
              { title: "Trash",   label: getUnread("Trash"),   icon: Trash2,   variant: getVariant("Trash"),   onClick: () => setFolder("Trash") },
              { title: "Archive", label: getUnread("Archive"), icon: Archive,  variant: getVariant("Archive"), onClick: () => setFolder("Archive") },
            ]}
          />
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              { title: "Social",     label: "", icon: Users2,        variant: "ghost" },
              { title: "Updates",    label: "", icon: AlertCircle,   variant: "ghost" },
              { title: "Forums",     label: "", icon: MessagesSquare,variant: "ghost" },
              { title: "Shopping",   label: "", icon: ShoppingCart,  variant: "ghost" },
              { title: "Promotions", label: "", icon: Archive,       variant: "ghost" },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── MESSAGE LIST ─── */}
        <ResizablePanel id="list" defaultSize={defaultLayout[1]} minSize={30}>
          <Tabs defaultValue="all">
            <div className="flex items-center px-4 py-2">
              <h1 className="text-xl font-bold capitalize">
                {Object.entries(FOLDER_MAP).find(([, v]) => v === folder)?.[0] ?? folder}
              </h1>
              <TabsList className="ml-auto">
                <TabsTrigger value="all" className="text-zinc-600 dark:text-zinc-200">
                  All mail
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-zinc-600 dark:text-zinc-200">
                  Unread
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={refresh}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
            <Separator />
            <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <TabsContent value="all" className="m-0">
              <MailList />
            </TabsContent>
            <TabsContent value="unread" className="m-0">
              <MailList unreadOnly />
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── MESSAGE DISPLAY ─── */}
        <ResizablePanel id="display" defaultSize={defaultLayout[2]} minSize={30}>
          <MailDisplay />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ─── COMPOSE DIALOG ─── */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label htmlFor="compose-to" className="text-xs font-medium">To</Label>
              <Input
                id="compose-to"
                placeholder="recipient@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="compose-subject" className="text-xs font-medium">Subject</Label>
              <Input
                id="compose-subject"
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="compose-body" className="text-xs font-medium">Message</Label>
              <Textarea
                id="compose-body"
                placeholder="Write your message..."
                className="min-h-[200px]"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleComposeSend} disabled={composeSending}>
                {composeSending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
