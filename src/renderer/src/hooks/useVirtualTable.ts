import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'

export function useVirtualTable<T>(
  items: readonly T[],
  options: { rowHeight?: number; viewportHeight?: number; overscan?: number; enabledAt?: number } = {}
) {
  const rowHeight = options.rowHeight ?? 48
  const viewportHeight = options.viewportHeight ?? 560
  const overscan = options.overscan ?? 8
  const enabledAt = options.enabledAt ?? 100
  const enabled = items.length >= enabledAt
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    setScrollTop(0)
    if (viewportRef.current) viewportRef.current.scrollTop = 0
  }, [items])

  const range = useMemo(() => {
    if (!enabled) {
      return { start: 0, end: items.length, top: 0, bottom: 0 }
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2
    const end = Math.min(items.length, start + visibleCount)

    return {
      start,
      end,
      top: start * rowHeight,
      bottom: Math.max(0, (items.length - end) * rowHeight)
    }
  }, [enabled, items.length, overscan, rowHeight, scrollTop, viewportHeight])

  return {
    viewportRef,
    enabled,
    visible: items.slice(range.start, range.end),
    startIndex: range.start,
    topSpacer: range.top,
    bottomSpacer: range.bottom,
    viewportHeight,
    onScroll: enabled
      ? (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop)
      : undefined
  }
}
