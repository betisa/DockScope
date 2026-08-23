import type { ReactNode } from 'react'
import { useVirtualList } from '../hooks/useVirtualList'

export function VirtualList<T>({
  items,
  itemKey,
  renderItem,
  ariaLabel,
  rowHeight = 112
}: {
  items: readonly T[]
  itemKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  ariaLabel: string
  rowHeight?: number
}) {
  const virtual = useVirtualList(items, { rowHeight })

  if (!virtual.enabled) {
    return <div className="virtual-list-static" aria-label={ariaLabel}>{items.map(renderItem)}</div>
  }

  return (
    <div
      ref={virtual.viewportRef}
      className="virtual-list-viewport"
      style={{ height: virtual.viewportHeight }}
      onScroll={virtual.onScroll}
      tabIndex={0}
      aria-label={ariaLabel}
    >
      <div className="virtual-list-spacer" style={{ height: virtual.totalHeight }}>
        {virtual.visible.map((item, index) => {
          const absoluteIndex = virtual.startIndex + index
          return (
            <div
              className="virtual-list-item"
              key={itemKey(item, absoluteIndex)}
              style={{
                height: virtual.rowHeight,
                transform: `translateY(${absoluteIndex * virtual.rowHeight}px)`
              }}
            >
              {renderItem(item, absoluteIndex)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
