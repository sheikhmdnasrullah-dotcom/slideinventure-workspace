"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AccountSwitcherProps {
  isCollapsed: boolean
  accounts: {
    label: string
    email: string
    icon: React.ReactNode
  }[]
  account: string | null
  setAccount: (account: string) => void
}

export function AccountSwitcher({
  isCollapsed,
  accounts,
  account,
  setAccount,
}: AccountSwitcherProps) {
  if (accounts.length === 0) return null

  return (
    <Select
      value={account ?? undefined}
      onValueChange={(value) => value && setAccount(value)}
    >
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
        )}
        aria-label="Select account"
      >
        <SelectValue placeholder="Select an account">
          {accounts.find((a) => a.email === account)?.icon}
          <span className={cn("ml-2", isCollapsed && "hidden")}>
            {accounts.find((a) => a.email === account)?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.email} value={a.email}>
            <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
              {a.icon}
              {a.email}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
