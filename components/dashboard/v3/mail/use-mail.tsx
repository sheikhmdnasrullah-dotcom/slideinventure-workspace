"use client"

import * as React from "react"

type MailContextValue = {
  selected: string | null
  setSelected: (id: string | null) => void
}

const MailContext = React.createContext<MailContextValue | null>(null)

export function useMail() {
  const ctx = React.useContext(MailContext)
  if (!ctx) {
    throw new Error("useMail must be used inside <MailProvider>")
  }
  return ctx
}

export function MailProvider({
  children,
  initial,
}: {
  children: React.ReactNode
  initial?: string
}) {
  const [selected, setSelected] = React.useState<string | null>(
    initial ?? null
  )
  return (
    <MailContext.Provider value={{ selected, setSelected }}>
      {children}
    </MailContext.Provider>
  )
}
