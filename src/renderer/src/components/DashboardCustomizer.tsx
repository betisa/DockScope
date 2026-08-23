import { useEffect, useRef } from 'react'
import type { DashboardDensity, DashboardLayout, DashboardWidgetId } from '../dashboardCustomization'
import { DASHBOARD_WIDGETS } from '../dashboardCustomization'
import { Switch } from './ui'

export function DashboardCustomizer({
  open,
  layout,
  onChange,
  onReset,
  onClose
}: {
  open: boolean
  layout: DashboardLayout
  onChange: (layout: DashboardLayout) => void
  onReset: () => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.setTimeout(() => closeRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
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

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const setDensity = (density: DashboardDensity) => onChange({ ...layout, density })

  const setVisible = (id: DashboardWidgetId, visible: boolean) => {
    const hidden = visible
      ? layout.hidden.filter(item => item !== id)
      : Array.from(new Set([...layout.hidden, id]))
    onChange({ ...layout, hidden })
  }

  const move = (id: DashboardWidgetId, direction: -1 | 1) => {
    const index = layout.order.indexOf(id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= layout.order.length) return
    const order = [...layout.order]
    const [item] = order.splice(index, 1)
    order.splice(nextIndex, 0, item)
    onChange({ ...layout, order })
  }

  return (
    <div className="dashboard-customizer-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside ref={panelRef} className="dashboard-customizer" role="dialog" aria-modal="true" aria-labelledby="dashboard-customizer-title">
        <header className="dashboard-customizer-header">
          <div>
            <div className="eyebrow">Dashboard layout</div>
            <h2 id="dashboard-customizer-title">Customize dashboard</h2>
            <p className="muted">Choose visible widgets, density, and their order.</p>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close dashboard customization">×</button>
        </header>

        <section className="dashboard-customizer-density">
          <span>Density</span>
          <div className="segmented-control" role="group" aria-label="Dashboard density">
            <button className={layout.density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>Comfortable</button>
            <button className={layout.density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')}>Compact</button>
          </div>
        </section>

        <section className="dashboard-widget-list" aria-label="Dashboard widgets">
          {layout.order.map((id, index) => {
            const definition = DASHBOARD_WIDGETS.find(widget => widget.id === id)!
            const visible = !layout.hidden.includes(id)
            return (
              <article className="dashboard-widget-setting" key={id}>
                <div className="dashboard-widget-setting-copy">
                  <strong>{definition.label}</strong>
                  <span>{definition.description}</span>
                </div>
                <Switch
                  checked={visible}
                  onChange={checked => setVisible(id, checked)}
                  label={definition.essential ? 'Always visible' : 'Visible'}
                  compact
                  disabled={definition.essential}
                />
                <div className="dashboard-widget-order-actions" aria-label={`Reorder ${definition.label}`}>
                  <button
                    className="icon-button"
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                    aria-label={`Move ${definition.label} up`}
                    title="Move up"
                  >↑</button>
                  <button
                    className="icon-button"
                    disabled={index === layout.order.length - 1}
                    onClick={() => move(id, 1)}
                    aria-label={`Move ${definition.label} down`}
                    title="Move down"
                  >↓</button>
                </div>
              </article>
            )
          })}
        </section>

        <footer className="dashboard-customizer-footer">
          <button className="button secondary" onClick={onReset}>Reset default layout</button>
          <button className="button primary" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </div>
  )
}
