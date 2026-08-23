import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Dashboard compact links and Container Diagnostics regression', () => {
  const dashboard = readFileSync('src/renderer/src/pages/DashboardPage.tsx','utf8')
  const containers = readFileSync('src/renderer/src/pages/ContainersPage.tsx','utf8')
  const styles = readFileSync('src/renderer/src/styles.css','utf8')

  it('uses compact icon actions instead of long textual widget links', () => {
    expect(dashboard).toContain('function DashboardIconLink')
    expect(dashboard).toContain('aria-label={label}')
    expect(dashboard).toContain('title={label}')
    expect(dashboard).not.toContain('Open advisor →')
    expect(dashboard).not.toContain('Open containers →')
    expect(dashboard).not.toContain('Open BuildKit →')
    expect(dashboard).not.toContain('Open Volume Intelligence →')
    expect(dashboard).not.toContain('Open notifications →')
    expect(styles).toContain('.dashboard-icon-link')
  })

  it('shortens quick navigation and gives each quick item an icon', () => {
    expect(dashboard).toContain('title="Containers" text="Runtime & diagnostics"')
    expect(dashboard).toContain('title="Compose" text="Projects & services"')
    expect(dashboard).toContain('title="Cleanup" text="Safe reclaim planning"')
    expect(dashboard).toContain('title="Storage" text="Trends & VHDX"')
    expect(dashboard).toContain('dashboard-quick-icon')
  })

  it('detects actual problem-container status categories instead of only unhealthy text', () => {
    expect(dashboard).toContain('function classifyContainerIssue')
    expect(dashboard).toContain("label:'Unhealthy'")
    expect(dashboard).toContain("label:'Dead'")
    expect(dashboard).toContain("label:'Restarting'")
    expect(dashboard).toContain("label:'Exited'")
    expect(dashboard).toContain('Number(exited[1]) !== 0')
    expect(dashboard).toContain('title="Problem containers"')
  })

  it('creates an explicit Advisor deep-link for the selected container', () => {
    expect(dashboard).toContain("tab:'advisor'")
    expect(dashboard).toContain("source:'dashboard-container-diagnostics'")
    expect(dashboard).toContain('openContainerDiagnostics(container)')
  })

  it('consumes the dashboard container intent exactly once and preserves the requested tab', () => {
    expect(containers).toContain('setWorkspaceInitialTab')
    expect(containers).toContain("typeof intent.tab === 'string' ? intent.tab : 'advisor'")
    expect(containers).toContain("sessionStorage.removeItem('dsm.m08.intent')")
    expect(containers).toContain('initialTab={workspaceInitialTab}')
    expect(containers).not.toContain('initialTab={readIntentTab()}')
  })

  it('supports container-name fallback if an ID changes between dashboard and containers refresh', () => {
    expect(containers).toContain('(intent.resourceName && x.name === intent.resourceName)')
  })
})
