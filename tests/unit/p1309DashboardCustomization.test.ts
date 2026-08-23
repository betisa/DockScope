import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.09 Dashboard Customization', () => {
  const model = readFileSync('src/renderer/src/dashboardCustomization.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/DashboardPage.tsx', 'utf8')
  const customizer = readFileSync('src/renderer/src/components/DashboardCustomizer.tsx', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')

  it('defines versioned dashboard widgets and default layout', () => {
    expect(model).toContain("schemaVersion: 1")
    expect(model).toContain("export type DashboardWidgetId")
    expect(model).toContain("'unhealthy'")
    expect(model).toContain("'recent-builds'")
    expect(model).toContain("'top-volumes'")
    expect(model).toContain("'recent-alerts'")
    expect(model).toContain("dsm.dashboard.layout.v1")
  })

  it('normalizes old layouts by appending missing widgets and rejects unknown ids', () => {
    expect(model).toContain('filter(isWidgetId)')
    expect(model).toContain('const missing = DEFAULT_DASHBOARD_LAYOUT.order.filter')
    expect(model).toContain('[...uniqueOrder, ...missing]')
  })

  it('never allows Runtime Summary to be hidden', () => {
    expect(model).toContain(".filter(id => id !== 'runtime')")
    expect(customizer).toContain('essential')
    expect(customizer).toContain('disabled={definition.essential}')
  })

  it('persists visibility, order and density locally and can reset', () => {
    expect(model).toContain("window.dockerApi.preferences.set(DB_KEY")
    expect(model).toContain("window.dockerApi.preferences.remove(DB_KEY)")
    expect(model).toContain("density: source.density === 'compact' ? 'compact' : 'comfortable'")
    expect(page).toContain('saveDashboardLayout(next)')
    expect(page).toContain('resetDashboardLayout()')
  })

  it('supports drag reorder plus keyboard-accessible Move Up / Move Down controls', () => {
    expect(page).toContain('draggable={draggable}')
    expect(page).toContain('onDragStart')
    expect(page).toContain('onDrop')
    expect(customizer).toContain('Move ${definition.label} up')
    expect(customizer).toContain('Move ${definition.label} down')
  })

  it('provides an accessible modal customizer with Escape, focus trapping and restoration', () => {
    expect(customizer).toContain('role="dialog"')
    expect(customizer).toContain('aria-modal="true"')
    expect(customizer).toContain("event.key === 'Escape'")
    expect(customizer).toContain("event.key !== 'Tab'")
    expect(customizer).toContain('previous?.focus()')
  })

  it('loads optional operational intelligence independently from core dashboard data', () => {
    expect(page).toContain('window.dockerApi.buildkit.history().catch(() => [])')
    expect(page).toContain('window.dockerApi.volumes.intelligence().catch(() => [])')
    expect(page).toContain('window.dockerApi.monitoring.notifications().catch(() => [])')
  })

  it('adds unhealthy containers, recent builds, top volumes and recent alerts widgets', () => {
    expect(page).toContain("unhealthy: (")
    expect(page).toContain("'recent-builds': (")
    expect(page).toContain("'top-volumes': (")
    expect(page).toContain("'recent-alerts': (")
    expect(page).toContain("tab:'advisor'")
    expect(page).toContain("page:'volumes'")
  })

  it('documents Dashboard customization in the contextual Guide', () => {
    expect(guide).toContain("title: 'Customize the dashboard'")
    expect(guide).toContain('Runtime Summary is essential and cannot be hidden.')
    expect(guide).toContain('Switch between Comfortable and Compact density.')
  })
})
