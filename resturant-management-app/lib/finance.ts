/**
 * Shared finance date-range/aggregation math, extracted from `finance.tsx` so the More/Profile
 * "Today's net" shortcut can reuse the exact same calculation instead of re-deriving it.
 * Pure functions only — no data fetching, no React.
 */
import type { FinanceEntry, FinanceKind } from "@/lib/hooks/useFinanceEntries"

export type DateRange = { start: string; end: string }
export type PeriodFilter = "all" | "month" | "week"

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfWeekSunday(d: Date) {
  const res = new Date(d)
  res.setDate(d.getDate() - d.getDay())
  res.setHours(0, 0, 0, 0)
  return res
}

export function getCurrentRange(period: PeriodFilter): DateRange | null {
  const today = new Date()
  const end = toYMD(today)
  if (period === "all") return null
  if (period === "month") {
    return { start: toYMD(startOfMonth(today)), end }
  }
  return { start: toYMD(startOfWeekSunday(today)), end }
}

export function getPreviousRange(period: Exclude<PeriodFilter, "all">): DateRange {
  const today = new Date()
  if (period === "month") {
    const firstThis = startOfMonth(today)
    const lastPrev = new Date(firstThis)
    lastPrev.setDate(0)
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1)
    return { start: toYMD(firstPrev), end: toYMD(lastPrev) }
  }
  const thisWeekStart = startOfWeekSunday(today)
  const prevWeekEnd = new Date(thisWeekStart)
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
  const prevWeekStart = new Date(prevWeekEnd)
  prevWeekStart.setDate(prevWeekStart.getDate() - 6)
  return { start: toYMD(prevWeekStart), end: toYMD(prevWeekEnd) }
}

export function inRange(isoDate: string, start: string, end: string) {
  return isoDate >= start && isoDate <= end
}

export function sumByKind(entries: FinanceEntry[], kind: FinanceKind, range: DateRange | null) {
  return entries.reduce((acc, e) => {
    if (e.kind !== kind) return acc
    if (range && !inRange(e.occurred_on, range.start, range.end)) return acc
    return acc + e.amount
  }, 0)
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}
