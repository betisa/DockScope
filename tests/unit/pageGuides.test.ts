import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('in-page contextual guides', () => {
  const guides = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')
  const pageTitle = readFileSync('src/renderer/src/components/PageTitle.tsx', 'utf8')
  const drawer = readFileSync('src/renderer/src/components/PageGuideDrawer.tsx', 'utf8')

  const pages = [
    'dashboard', 'notifications', 'activity', 'tasks', 'productivity', 'audit',
    'containers', 'compose', 'ports', 'resource-graph', 'images', 'buildkit',
    'volumes', 'networks', 'cleanup', 'storage', 'settings'
  ]

  it('defines a dedicated guide for every top-level page', () => {
    for (const page of pages) {
      const key = page.includes('-') ? `'${page}':` : `${page}:`
      expect(guides, page).toContain(key)
    }
  })

  it('exposes the guide directly from every shared PageTitle', () => {
    expect(pageTitle).toContain('page-guide-trigger')
    expect(pageTitle).toContain('<PageGuideDrawer page={page}')
    expect(pageTitle).toContain('aria-haspopup="dialog"')
  })

  it('implements accessible dialog, Escape close, and focus containment', () => {
    expect(drawer).toContain('role="dialog"')
    expect(drawer).toContain('aria-modal="true"')
    expect(drawer).toContain("event.key === 'Escape'")
    expect(drawer).toContain("event.key !== 'Tab'")
    expect(drawer).toContain('previous?.focus()')
  })

  it('includes safety guidance for destructive areas', () => {
    expect(guides).toContain("Recovery metadata is not a backup.")
    expect(guides).toContain("Persistent volumes are high risk")
    expect(guides).toContain("VHDX compaction is disruptive.")
    expect(guides).toContain("Safe Cleanup never includes volume prune.")
  })
})
