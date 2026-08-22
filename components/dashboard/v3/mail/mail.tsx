"use client"

import * as React from "react"
import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  Menu,
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
import { useIsMobile } from "@/hooks/use-mobile"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
import { AddAccountDialog } from "./add-account-dialog"
import { MailDisplay } from "./mail-display"
import { MailList } from "./mail-list"
import { Nav } from "./nav"
import { useMail } from "./use-mail"

interface MailProps {
  defaultLayout?: number[]
  navCollapsedSize?: number
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
  navCollapsedSize = 0,
}: MailProps) {
  const isMobile = useIsMobile()
  const {
    accounts, account, setAccount,
    selected, setSelected, folders, loading, search, setSearch,
    setFolder, folder, refresh, composeOpen, setComposeOpen, sendMessage,
    refreshAccounts, removeAccount,
  } = useMail()

  const [addAccountOpen, setAddAccountOpen] = React.useState(false)
  const [mobileView, setMobileView] = React.useState<"list" | "detail">("list")
  const [folderSheetOpen, setFolderSheetOpen] = React.useState(false)

  // Selecting a message switches the mobile view to the detail screen
  React.useEffect(() => {
    if (isMobile && selected) setMobileView("detail")
  }, [selected, isMobile])

  // Mapped accounts for the switcher (reusing the same icon for all)
  const switcherAccounts = React.useMemo(() => accounts.map(a => ({
    label: a.name,
    email: a.email,
    id: a.id,
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

  const folderLinks = [
    { title: "Inbox",   label: getUnread("Inbox"),   icon: Inbox,    variant: getVariant("Inbox"),   onClick: () => { setFolder("INBOX"); setFolderSheetOpen(false) } },
    { title: "Drafts",  label: getUnread("Drafts"),  icon: File,     variant: getVariant("Drafts"),  onClick: () => { setFolder("Drafts"); setFolderSheetOpen(false) } },
    { title: "Sent",    label: getUnread("Sent"),    icon: Send,     variant: getVariant("Sent"),    onClick: () => { setFolder("Sent"); setFolderSheetOpen(false) } },
    { title: "Junk",    label: getUnread("Junk"),    icon: ArchiveX, variant: getVariant("Junk"),    onClick: () => { setFolder("Junk"); setFolderSheetOpen(false) } },
    { title: "Trash",   label: getUnread("Trash"),   icon: Trash2,   variant: getVariant("Trash"),   onClick: () => { setFolder("Trash"); setFolderSheetOpen(false) } },
    { title: "Archive", label: getUnread("Archive"), icon: Archive,  variant: getVariant("Archive"), onClick: () => { setFolder("Archive"); setFolderSheetOpen(false) } },
  ]

  if (isMobile) {
    return (
      <TooltipProvider delay={0}>
        <div className="flex h-full flex-col">
          {mobileView === "list" ? (
            <>
              <div className="flex items-center gap-1 px-2 py-2">
                <Button variant="ghost" size="icon" className="p-1" onClick={() => setFolderSheetOpen(true)}>
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Folders</span>
                </Button>
                <h1 className="flex-1 truncate text-xl font-bold capitalize">
                  {Object.entries(FOLDER_MAP).find(([, v]) => v === folder)?.[0] ?? folder}
                </h1>
                <Button variant="ghost" size="icon" className="p-1" onClick={refresh} disabled={loading} title="Refresh">
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
                <Button variant="ghost" size="icon" className="p-1" onClick={() => setComposeOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Compose</span>
                </Button>
              </div>
              <Separator />
              <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <form onSubmit={(e) => e.preventDefault()}>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search"
                      className="pl-8 text-base md:text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </form>
              </div>
              <div className="flex-1 overflow-hidden">
                <MailList />
              </div>
            </>
          ) : (
            <MailDisplay onBack={() => { setSelected(null); setMobileView("list") }} />
          )}
        </div>

        <Sheet open={folderSheetOpen} onOpenChange={setFolderSheetOpen}>
          <SheetContent side="left" className="w-3/4 p-0">
            <SheetHeader>
              <SheetTitle>Mail</SheetTitle>
            </SheetHeader>
            <div className="flex h-[52px] items-center px-2">
              <AccountSwitcher
                isCollapsed={false}
                accounts={switcherAccounts}
                account={account}
                setAccount={setAccount}
                onAddAccount={() => { setFolderSheetOpen(false); setAddAccountOpen(true) }}
                onRemoveAccount={removeAccount}
              />
            </div>
            <Separator />
            <Nav isCollapsed={false} links={folderLinks} />
          </SheetContent>
        </Sheet>

        {/* ─── COMPOSE DIALOG ─── */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1">
                <Label htmlFor="compose-to-m" className="text-xs font-medium">To</Label>
                <Input
                  id="compose-to-m"
                  placeholder="recipient@example.com"
                  className="text-base md:text-sm"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="compose-subject-m" className="text-xs font-medium">Subject</Label>
                <Input
                  id="compose-subject-m"
                  placeholder="Subject"
                  className="text-base md:text-sm"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="compose-body-m" className="text-xs font-medium">Message</Label>
                <Textarea
                  id="compose-body-m"
                  placeholder="Write your message..."
                  className="min-h-[200px] text-base md:text-sm"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                />
              </div>
              <div className="flex justify-end pb-[env(safe-area-inset-bottom)]">
                <Button onClick={handleComposeSend} disabled={composeSending}>
                  {composeSending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── ADD ACCOUNT DIALOG ─── */}
        <AddAccountDialog
          open={addAccountOpen}
          onOpenChange={setAddAccountOpen}
          onCreated={() => { refreshAccounts() }}
        />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delay={0}>
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(layout) => {
          document.cookie = `mail-panel-layout=${JSON.stringify(
            [layout.nav, layout.list, layout.display]
          )}`
        }}
        className="h-full items-stretch rounded-lg border overflow-hidden"
      >
        {/* ─── LEFT NAV ─── */}
        <ResizablePanel
          id="nav"
          defaultSize={defaultLayout[0]}
          minSize={15}
          maxSize={20}
          className="items-stretch"
        >
          <div className="flex h-[52px] items-center px-2">
            <AccountSwitcher
              isCollapsed={false}
              accounts={switcherAccounts}
              account={account}
              setAccount={setAccount}
              onAddAccount={() => setAddAccountOpen(true)}
              onRemoveAccount={removeAccount}
            />
          </div>
          <Separator className="mx-0" />
          <div className="m-3">
            <Button
              className="w-full"
              onClick={() => setComposeOpen(true)}
            >
              "Compose"
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <Separator className="mx-0" />
          <Nav links={folderLinks} />
          <Separator className="mx-0" />
          <Nav
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

      {/* ─── ADD ACCOUNT DIALOG ─── */}
      <AddAccountDialog
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onCreated={() => { refreshAccounts() }}
      />
    </TooltipProvider>
  )
}
