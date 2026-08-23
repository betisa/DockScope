import { useDeferredValue, useEffect, useMemo, useState } from 'react'

export function usePaginatedSearch<T>(
  items: readonly T[],
  getSearchText: (item: T) => string,
  options: { pageSize?: number; initialQuery?: string } = {}
) {
  const pageSize = options.pageSize ?? 10
  const [query, setQuery] = useState(options.initialQuery ?? '')
  const deferredQuery = useDeferredValue(query)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()
    if (!normalized) return [...items]
    return items.filter(item => getSearchText(item).toLowerCase().includes(normalized))
  }, [items, deferredQuery, getSearchText])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [deferredQuery, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const start = (page - 1) * pageSize
  const pageItems = filtered.slice(start, start + pageSize)

  return {
    query,
    setQuery,
    page,
    setPage,
    pageSize,
    filtered,
    pageItems,
    totalItems: filtered.length,
    totalPages,
    startItem: filtered.length ? start + 1 : 0,
    endItem: Math.min(start + pageSize, filtered.length),
    canPrevious: page > 1,
    canNext: page < totalPages
  }
}
