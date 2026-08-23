import { useMemo, useRef, useState, type UIEvent } from 'react'

export function useVirtualList<T>(
  items: readonly T[],
  {
    rowHeight = 112,
    viewportHeight = 620,
    overscan = 5,
    enabledAt = 100
  }: {
    rowHeight?: number
    viewportHeight?: number
    overscan?: number
    enabledAt?: number
  } = {}
) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const enabled = items.length >= enabledAt

  const range = useMemo(() => {
    if (!enabled) {
      return { start: 0, end: items.length }
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const count = Math.ceil(viewportHeight / rowHeight) + overscan * 2
    return { start, end: Math.min(items.length, start + count) }
  }, [enabled, items.length, overscan, rowHeight, scrollTop, viewportHeight])

  return {
    enabled,
    viewportRef,
    rowHeight,
    viewportHeight,
    startIndex: range.start,
    visible: items.slice(range.start, range.end),
    totalHeight: items.length * rowHeight,
    onScroll: enabled
      ? (event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop)
      : undefined
  }
}
