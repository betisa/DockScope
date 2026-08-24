import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('BuildKit Build History Diagnostics modal', () => {
  const page = readFileSync('src/renderer/src/pages/BuildKitPage.tsx','utf8')
  const modal = readFileSync('src/renderer/src/components/BuildDiagnosticsModal.tsx','utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts','utf8')
  const styles = readFileSync('src/renderer/src/styles.css','utf8')

  it('removes the old inline diagnostics workspace component', () => {
    expect(existsSync('src/renderer/src/components/BuildDiagnosticsWorkspace.tsx')).toBe(false)
    expect(page).not.toContain('<BuildDiagnosticsWorkspace')
    expect(page).toContain('<BuildDiagnosticsModal')
  })

  it('opens Diagnostics from each Build History row', () => {
    expect(page).toContain('onClick={() => void openDiagnostics(build)}')
    expect(page).toContain('>Diagnostics</button>')
    expect(page).toContain('setSelectedBuild(build)')
  })

  it('renders diagnostics as an accessible modal', () => {
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain('aria-labelledby="build-diagnostics-modal-title"')
    expect(modal).toContain("event.key === 'Escape'")
    expect(modal).toContain("event.key !== 'Tab'")
    expect(modal).toContain('previous?.focus()')
  })

  it('renders build steps as a status timeline with semantic icons', () => {
    expect(modal).toContain('build-step-timeline')
    expect(modal).toContain('CheckmarkCircle02Icon')
    expect(modal).toContain('Archive02Icon')
    expect(modal).toContain('Loading03Icon')
    expect(modal).toContain('Alert02Icon')
    expect(modal).toContain('build-step-detail')
    expect(styles).toContain('.build-step-timeline')
    expect(styles).toContain('.build-step-timeline-marker')
    expect(styles).toContain('border:0; border-radius:0; background:transparent')
    expect(styles).toContain('.build-step-detail')
  })

  it('retains all diagnostic tabs', () => {
    for (const tab of ['Overview','Logs','Steps','Cache','Timing','Error Analysis']) {
      expect(modal).toContain(`label: '${tab}'`)
    }
  })

  it('resets modal tab/search when a different build is opened', () => {
    expect(modal).toContain("setTab('overview')")
    expect(modal).toContain("setQuery('')")
    expect(modal).toContain('[build.id, build.ref]')
  })

  it('keeps existing read-only operations in the modal header', () => {
    expect(modal).toContain('Copy ref')
    expect(modal).toContain('Open in Docker Desktop')
    expect(modal).toContain('Reload')
    expect(modal).toContain('Diagnostics are read-only.')
  })

  it('renders colored build logs with shared copy and export actions', () => {
    expect(modal).toContain("import { ColoredLogConsole }")
    expect(modal).toContain("import { LogActions }")
    expect(modal).toContain('ariaLabel="Build diagnostics logs output"')
    expect(modal).toContain('build-${ref}-logs.log')
  })

  it('documents the modal workflow in the BuildKit Guide', () => {
    expect(guide).toContain('Select Diagnostics on a build record to open the modal')
    expect(guide).toContain('Escape closes the Build Diagnostics modal')
  })
})
