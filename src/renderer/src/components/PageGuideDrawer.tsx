import { useEffect, useRef } from 'react'
import { File02Icon } from '@hugeicons/core-free-icons'
import type { PageId } from '../navigation'
import { pageMeta } from '../navigation'
import { PAGE_GUIDES } from '../pageGuides'
import { AppIcon } from './Icon'

export function PageGuideDrawer({
  page,
  open,
  onClose
}: {
  page: PageId
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const guide = PAGE_GUIDES[page]
  const meta = pageMeta(page)

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.setTimeout(() => closeRef.current?.focus(), 0)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="page-guide-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        ref={panelRef}
        className="page-guide-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`page-guide-title-${page}`}
      >
        <header className="page-guide-header">
          <div className="page-guide-heading">
            <div className="page-guide-page-icon" aria-hidden="true">
              <AppIcon icon={meta.icon} size={22} />
            </div>
            <div>
              <div className="eyebrow">In-page guide</div>
              <h2 id={`page-guide-title-${page}`}>{guide.title}</h2>
            </div>
          </div>
          <button
            ref={closeRef}
            className="icon-button page-guide-close"
            onClick={onClose}
            aria-label="Close page guide"
          >
            ×
          </button>
        </header>

        <div className="page-guide-content">
          <div className="page-guide-summary">
            <AppIcon icon={File02Icon} size={18} />
            <p>{guide.summary}</p>
          </div>

          {guide.sections.map((section, index) => (
            <section
              key={`${section.title}-${index}`}
              className={`page-guide-section page-guide-${section.tone ?? 'default'}`}
            >
              <h3>{section.title}</h3>
              <ol>
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ol>
            </section>
          ))}

          {guide.shortcuts?.length ? (
            <section className="page-guide-section">
              <h3>Keyboard shortcuts</h3>
              <div className="page-guide-shortcuts">
                {guide.shortcuts.map(shortcut => (
                  <div className="page-guide-shortcut" key={`${shortcut.keys}-${shortcut.action}`}>
                    <kbd>{shortcut.keys}</kbd>
                    <span>{shortcut.action}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="page-guide-footer">
          <span>Press <kbd>Esc</kbd> to close this guide.</span>
          <button className="button primary" onClick={onClose}>Got it</button>
        </footer>
      </aside>
    </div>
  )
}
