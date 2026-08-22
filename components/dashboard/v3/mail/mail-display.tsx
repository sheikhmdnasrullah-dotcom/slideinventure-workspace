"use client"

import * as React from "react"
import { addDays, addHours, format, nextSaturday } from "date-fns"
import {
  Archive,
  ArchiveX,
  ChevronLeft,
  Clock,
  Forward,
  MoreVertical,
  Paperclip,
  Reply,
  ReplyAll,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { useMail } from "./use-mail"

type ReplyMode = "reply" | "replyAll" | "forward" | null

interface MailDisplayProps {
  onBack?: () => void
}

export function MailDisplay({ onBack }: MailDisplayProps = {}) {
  const today = new Date()
  const { selectedMessage: mail, deleteMessage, archiveMessage, markRead, sendMessage } = useMail()

  const [replyMode, setReplyMode] = React.useState<ReplyMode>(null)
  const [replyBody, setReplyBody] = React.useState("")
  const [replySending, setReplySending] = React.useState(false)
  const [muted, setMuted] = React.useState(false)

  // Reset reply form when message changes
  React.useEffect(() => {
    setReplyMode(null)
    setReplyBody("")
  }, [mail?.id])

  async function handleSendReply() {
    if (!mail || !replyBody.trim()) return
    setReplySending(true)
    try {
      const toAddr = replyMode === "forward"
        ? "" // user must fill in; shown below
        : replyMode === "replyAll"
          ? [mail.from, ...(mail.cc ?? [])].join(", ")
          : mail.from

      const subject = replyMode === "forward"
        ? `Fwd: ${mail.subject}`
        : mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`

      await sendMessage(
        toAddr,
        subject,
        replyBody,
        mail.messageId,
        mail.messageId
      )
      setReplyMode(null)
      setReplyBody("")
    } catch (e) {
      toast.error(String(e))
    } finally {
      setReplySending(false)
    }
  }

  // Forward reply-to field
  const [forwardTo, setForwardTo] = React.useState("")

  async function handleSendForward() {
    if (!mail || !replyBody.trim() || !forwardTo.trim()) return
    setReplySending(true)
    try {
      await sendMessage(
        forwardTo,
        `Fwd: ${mail.subject}`,
        `---------- Forwarded message ----------\nFrom: ${mail.from}\nSubject: ${mail.subject}\n\n${mail.text}\n\n${replyBody}`,
      )
      setReplyMode(null)
      setReplyBody("")
      setForwardTo("")
    } catch (e) {
      toast.error(String(e))
    } finally {
      setReplySending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ─── TOOLBAR ─── */}
      <div className="flex items-center p-2">
        {onBack && (
          <Button variant="ghost" size="icon" className="mr-1 p-1" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!mail}
                  onClick={() => mail && archiveMessage(mail.id)}
                >
                  <Archive className="h-4 w-4" />
                  <span className="sr-only">Archive</span>
                </Button>
              }
            />
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!mail}
                  onClick={() => mail && deleteMessage(mail.id)}
                >
                  <ArchiveX className="h-4 w-4" />
                  <span className="sr-only">Move to junk</span>
                </Button>
              }
            />
            <TooltipContent>Move to junk</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!mail}
                  onClick={() => mail && deleteMessage(mail.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Move to trash</span>
                </Button>
              }
            />
            <TooltipContent>Move to trash</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Tooltip>
            <Popover>
              <PopoverTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon" disabled={!mail}>
                        <Clock className="h-4 w-4" />
                        <span className="sr-only">Snooze</span>
                      </Button>
                    }
                  />
                }
              />
              <PopoverContent className="w-[260px] p-0">
                <div className="flex flex-col gap-2 px-2 py-4">
                  <div className="px-4 text-sm font-medium">Snooze until</div>
                  <div className="grid gap-1">
                    <Button variant="ghost" className="justify-start font-normal">
                      Later today{" "}
                      <span className="ml-auto text-muted-foreground">
                        {format(addHours(today, 4), "E, h:m b")}
                      </span>
                    </Button>
                    <Button variant="ghost" className="justify-start font-normal">
                      Tomorrow
                      <span className="ml-auto text-muted-foreground">
                        {format(addDays(today, 1), "E, h:m b")}
                      </span>
                    </Button>
                    <Button variant="ghost" className="justify-start font-normal">
                      This weekend
                      <span className="ml-auto text-muted-foreground">
                        {format(nextSaturday(today), "E, h:m b")}
                      </span>
                    </Button>
                    <Button variant="ghost" className="justify-start font-normal">
                      Next week
                      <span className="ml-auto text-muted-foreground">
                        {format(addDays(today, 7), "E, h:m b")}
                      </span>
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <TooltipContent>Snooze</TooltipContent>
          </Tooltip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!mail}
                  onClick={() => setReplyMode(replyMode === "reply" ? null : "reply")}
                >
                  <Reply className="h-4 w-4" />
                  <span className="sr-only">Reply</span>
                </Button>
              }
            />
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!mail}
                  onClick={() => setReplyMode(replyMode === "replyAll" ? null : "replyAll")}
                >
                  <ReplyAll className="h-4 w-4" />
                  <span className="sr-only">Reply all</span>
                </Button>
              }
            />
            <TooltipContent>Reply all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!mail}
                  onClick={() => setReplyMode(replyMode === "forward" ? null : "forward")}
                >
                  <Forward className="h-4 w-4" />
                  <span className="sr-only">Forward</span>
                </Button>
              }
            />
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" disabled={!mail}>
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => mail && markRead(mail.id, !mail.read)}>
              {mail?.read ? "Mark as unread" : "Mark as read"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => mail && archiveMessage(mail.id)}>
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => mail && deleteMessage(mail.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* ─── MESSAGE BODY ─── */}
      {mail ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm">
              <Avatar>
                <AvatarImage alt={mail.fromName} />
                <AvatarFallback>
                  {(mail.fromName || mail.from)
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <div className="font-semibold">{mail.fromName || mail.from}</div>
                <div className="line-clamp-1 text-xs">{mail.subject}</div>
                <div className="line-clamp-1 text-xs">
                  <span className="font-medium">From:</span> {mail.from}
                </div>
                {mail.to.length > 0 && (
                  <div className="line-clamp-1 text-xs">
                    <span className="font-medium">To:</span> {mail.to.join(", ")}
                  </div>
                )}
              </div>
            </div>
            {mail.date && (
              <div className="ml-auto text-xs text-muted-foreground">
                {format(new Date(mail.date), "PPpp")}
              </div>
            )}
          </div>

          <Separator />

          {/* Attachments */}
          {mail.hasAttachments && mail.attachments && mail.attachments.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 p-4 pb-2">
                {mail.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={`/api/mail/attachments?folder=${encodeURIComponent(mail.folder)}&uid=${mail.uid}&part=${att.part}`}
                    className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                    download={att.filename}
                  >
                    <Paperclip className="h-3 w-3" />
                    {att.filename}
                  </a>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* Body */}
          <div className="flex-1 overflow-auto">
            {mail.html ? (
              <iframe
                srcDoc={mail.html}
                className="h-full w-full border-0"
                sandbox="allow-same-origin"
                title="Message body"
              />
            ) : (
              <div className="whitespace-pre-wrap p-4 text-sm">{mail.text}</div>
            )}
          </div>

          <Separator className="mt-auto" />

          {/* ─── REPLY / FORWARD PANEL ─── */}
          <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {replyMode ? (
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="grid gap-4">
                  {replyMode === "forward" && (
                    <input
                      type="email"
                      placeholder="Forward to..."
                      className="rounded border px-3 py-2 text-base focus:outline-none md:text-sm"
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value)}
                    />
                  )}
                  <Textarea
                    className="p-4 text-base md:text-sm"
                    placeholder={
                      replyMode === "forward"
                        ? "Add a note..."
                        : `Reply to ${mail.fromName || mail.from}...`
                    }
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                  />
                  <div className="flex items-center">
                    <Label
                      htmlFor="mute"
                      className="flex items-center gap-2 text-xs font-normal"
                    >
                      <Switch
                        id="mute"
                        checked={muted}
                        onCheckedChange={setMuted}
                        aria-label="Mute thread"
                      />
                      Mute this thread
                    </Label>
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setReplyMode(null); setReplyBody("") }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={replySending}
                        onClick={replyMode === "forward" ? handleSendForward : handleSendReply}
                      >
                        {replySending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setReplyMode("reply")}
              >
                <Reply className="mr-2 h-4 w-4" />
                Reply to {mail.fromName || mail.from}...
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">
          No message selected
        </div>
      )}
    </div>
  )
}
