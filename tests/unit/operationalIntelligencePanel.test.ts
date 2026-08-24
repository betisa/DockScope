import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Operational Intelligence dashboard panel', () => {
  const panel = readFileSync('src/renderer/src/components/OperationalIntelligencePanel.tsx', 'utf8')
  const drawer = readFileSync('src/renderer/src/components/OperationalIntelligenceDrawer.tsx', 'utf8')
  const dashboard = readFileSync('src/renderer/src/pages/DashboardPage.tsx', 'utf8')
  const navigation = readFileSync('src/renderer/src/navigation.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')

  it('uses Settings as the only UI source for monitoring policy', () => {
    expect(panel).toContain('window.dockerApi.settings.get()')
    expect(panel).not.toContain('monitoring.settings()')
    expect(panel).not.toContain('monitoring.saveSettings')
    expect(preload).not.toContain("ipcRenderer.invoke('monitoring:settings'")
    expect(contracts).not.toContain('settings(): Promise<MonitoringSettings>')
  })

  it('opens Operational Intelligence from a dashboard icon and side drawer', () => {
    expect(dashboard).toContain('setIntelligenceOpen(true)')
    expect(dashboard).toContain('<OperationalIntelligenceDrawer')
    expect(drawer).toContain('role="dialog"')
    expect(drawer).toContain('event.key === \'Escape\'')
    expect(navigation).toContain("hidden: true")
  })
})
