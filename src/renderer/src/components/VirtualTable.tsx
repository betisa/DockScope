import type { ReactNode } from 'react'
import { useVirtualTable } from '../hooks/useVirtualTable'

export function VirtualTable<T>({
  items,
  headers,
  renderRow,
  rowKey,
  minWidth = 760,
  ariaLabel
}: {
  items: readonly T[]
  headers: ReactNode[]
  renderRow: (item: T, absoluteIndex: number) => ReactNode
  rowKey: (item: T, absoluteIndex: number) => string
  minWidth?: number
  ariaLabel: string
}) {
  const virtual = useVirtualTable(items)

  return (
    <div
      ref={virtual.viewportRef}
      className={`table-viewport ${virtual.enabled ? 'virtualized' : ''}`}
      style={virtual.enabled ? { maxHeight: virtual.viewportHeight } : undefined}
      onScroll={virtual.onScroll}
      tabIndex={virtual.enabled ? 0 : undefined}
      aria-label={ariaLabel}
    >
      <table style={{ minWidth }}>
        <thead>
          <tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {virtual.topSpacer > 0 && (
            <tr aria-hidden="true" className="virtual-spacer">
              <td colSpan={headers.length} style={{ height: virtual.topSpacer }} />
            </tr>
          )}
          {virtual.visible.map((item, index) => (
            <RowShell key={rowKey(item, virtual.startIndex + index)}>
              {renderRow(item, virtual.startIndex + index)}
            </RowShell>
          ))}
          {virtual.bottomSpacer > 0 && (
            <tr aria-hidden="true" className="virtual-spacer">
              <td colSpan={headers.length} style={{ height: virtual.bottomSpacer }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Lets callers keep row markup local while preserving stable keys in the virtual window.
 * React Fragment cannot carry the table-row semantics we want here, so return children directly.
 */
function RowShell({ children }: { children: ReactNode }) {
  return <>{children}</>
}
