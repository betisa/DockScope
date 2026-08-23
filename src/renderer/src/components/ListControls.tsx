import { AppIcon } from './Icon'
import { Search01Icon } from '@hugeicons/core-free-icons'

export function ListControls({
  query,
  onQueryChange,
  page,
  totalPages,
  totalItems,
  startItem,
  endItem,
  onPrevious,
  onNext,
  placeholder = 'Search…'
}: {
  query: string
  onQueryChange: (value: string) => void
  page: number
  totalPages: number
  totalItems: number
  startItem: number
  endItem: number
  onPrevious: () => void
  onNext: () => void
  placeholder?: string
}) {
  return (
    <div className="list-controls">
      <label className="list-search">
        <AppIcon icon={Search01Icon} />
        <span className="sr-only">{placeholder}</span>
        <input
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>

      <div className="list-pagination" aria-label="Pagination">
        <span className="list-count">
          {totalItems ? `${startItem}–${endItem} of ${totalItems}` : '0 items'}
        </span>
        <button
          className="button secondary"
          disabled={page <= 1}
          onClick={onPrevious}
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="page-indicator">Page {page} / {totalPages}</span>
        <button
          className="button secondary"
          disabled={page >= totalPages}
          onClick={onNext}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  )
}
