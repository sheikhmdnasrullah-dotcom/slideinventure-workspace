export function formatToTodoistDueDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())

  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMinutes)
  const off = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${off}`
}

export function parseTodoistDueDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}
