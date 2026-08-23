import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ProductivityItem } from '../productivity/model'
import { fuzzyScore } from '../productivity/model'
import { productivityStorage } from '../productivity/storage'
import { Badge } from './ui'
import { AppIcon } from './Icon'
import { Search01Icon } from '@hugeicons/core-free-icons'

export function CommandPalette({
  open,
  items,
  onClose,
  onExecute
}: {
  open: boolean
  items: ProductivityItem[]
  onClose: () => void
  onExecute: (item: ProductivityItem) => Promise<void> | void
}) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selected, setSelected] = useState(0)
  const [favorites, setFavorites] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setSelected(0)
    void productivityStorage.favorites().then(setFavorites)
    window.setTimeout(() => input.current?.focus(), 0)

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog.current) return
      const focusable = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )

      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', trapFocus)
    return () => {
      window.removeEventListener('keydown', trapFocus)
      previouslyFocused.current?.focus()
    }
  }, [open])

  const visible = useMemo(() => items
    .map(item => ({ item, score: fuzzyScore(deferredQuery, item) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => {
      const favoriteDelta =
        Number(favorites.includes(b.item.id)) - Number(favorites.includes(a.item.id))
      return favoriteDelta || b.score - a.score || a.item.title.localeCompare(b.item.title)
    })
    .slice(0, 40)
    .map(item => item.item), [items, deferredQuery, favorites])

  useEffect(() => setSelected(0), [deferredQuery])

  if (!open) return null

  const execute = async (item: ProductivityItem) => {
    await onExecute(item)
    onClose()
  }

  return (
    <div
      className="palette-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        ref={dialog}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
      >
        <h2 id="command-palette-title" className="sr-only">Command palette</h2>
        <div className="palette-search">
          <AppIcon icon={Search01Icon} />
          <input
            ref={input}
            value={query}
            aria-controls="command-palette-results"
            aria-activedescendant={visible[selected] ? `palette-item-${visible[selected].id}` : undefined}
            autoComplete="off"
            onChange={event => setQuery(event.target.value)}
            placeholder="Search resources or type an action…"
            onKeyDown={async event => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelected(value => Math.min(value + 1, visible.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected(value => Math.max(value - 1, 0))
              }
              if (event.key === 'Enter' && visible[selected]) {
                event.preventDefault()
                await execute(visible[selected])
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="palette-hint">
          Pages, containers, Compose projects, images and safe quick actions
        </div>

        <div className="palette-results" id="command-palette-results" role="listbox">
          {!visible.length ? (
            <div className="empty" role="status">
              <strong>No command found</strong>
              <div className="muted">Try a resource name, “restart api”, “logs”, “cleanup” or “build cache”.</div>
            </div>
          ) : visible.map((item, index) => (
            <div
              className={`palette-row ${index === selected ? 'selected' : ''}`}
              key={item.id}
              id={`palette-item-${item.id}`}
              role="option"
              aria-selected={index === selected}
              onMouseEnter={() => setSelected(index)}
              onDoubleClick={() => void execute(item)}
            >
              <button
                className="favorite-button"
                aria-label={favorites.includes(item.id) ? `Unpin ${item.title}` : `Pin ${item.title}`}
                onClick={event => {
                  event.stopPropagation()
                  void productivityStorage.toggleFavorite(item.id).then(setFavorites)
                }}
              >
                {favorites.includes(item.id) ? 'Pinned' : 'Pin'}
              </button>

              <button className="palette-main" onClick={() => void execute(item)}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
                <Badge tone={item.kind === 'action' ? 'info' : 'neutral'}>{item.kind}</Badge>
              </button>
            </div>
          ))}
        </div>

        <footer className="palette-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Pin</kbd> favorite</span>
        </footer>
      </section>
    </div>
  )
}
