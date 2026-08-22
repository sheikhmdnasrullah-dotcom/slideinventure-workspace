"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ADD_ACCOUNT_VALUE = "__add_account__"
const REMOVE_ACCOUNT_VALUE = "__remove_account__"

interface AccountSwitcherProps {
  isCollapsed: boolean
  accounts: {
    label: string
    email: string
    icon: React.ReactNode
    id?: string
  }[]
  account: string | null
  setAccount: (account: string) => void
  onAddAccount: () => void
  onRemoveAccount: (id: string) => void
}

export function AccountSwitcher({
  isCollapsed,
  accounts,
  account,
  setAccount,
  onAddAccount,
  onRemoveAccount,
}: AccountSwitcherProps) {
  const current = accounts.find((a) => a.email === account)

  return (
    <Select
      value={account ?? undefined}
      onValueChange={(value) => {
        if (!value) return
        if (value === ADD_ACCOUNT_VALUE) { onAddAccount(); return }
        if (value === REMOVE_ACCOUNT_VALUE) { if (current?.id) onRemoveAccount(current.id); return }
        setAccount(value)
      }}
    >
      <SelectTrigger
        className={cn(
          "flex w-full items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
        )}
        aria-label="Select account"
      >
        <SelectValue placeholder="Select an account">
          {current?.icon}
          <span className={cn("ml-2", isCollapsed && "hidden")}>
            {current?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-full">
        {accounts.map((a) => (
          <SelectItem key={a.email} value={a.email}>
            <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
              {a.icon}
              {a.email}
            </div>
          </SelectItem>
        ))}
        <SelectItem value={ADD_ACCOUNT_VALUE}>
          <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
            <Plus />
            Add account
          </div>
        </SelectItem>
        {current?.id && (
          <SelectItem value={REMOVE_ACCOUNT_VALUE}>
            <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 text-destructive">
              <Trash2 />
              Remove account
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
