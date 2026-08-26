import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.02 Container Diagnostics Advisor', () => {
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const workspace = readFileSync('src/renderer/src/components/ContainerWorkspace.tsx', 'utf8')
  const panel = readFileSync('src/renderer/src/components/ContainerAdvisorPanel.tsx', 'utf8')
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')

  it('collects inspect, recent logs and point-in-time stats evidence', () => {
    expect(service).toContain("'container', 'logs', '--timestamps', '--tail', '400'")
    expect(service).toContain("'stats', '--no-stream', '--format', 'json'")
    expect(service).toContain('diagnostics.oomKilled')
    expect(service).toContain('diagnostics.restartCount >= 3')
    expect(service).toContain('redactDiagnosticEvidence')
  })

  it('keeps exit 137 separate from confirmed OOM', () => {
    expect(service).toContain("id: 'oom-killed'")
    expect(service).toContain("id: 'exit-137'")
    expect(service).toContain("OOMKilled=false")
  })

  it('selects Stats for healthy containers and Advisor for runtime failures', () => {
    expect(workspace).toContain("const tabs: Tab[] = ['advisor','stats'")
    expect(workspace).toContain('requestedTab ?? preferredWorkspaceTab(container)')
    expect(workspace).toContain("return problem ? 'advisor' : 'stats'")
    expect(workspace).toContain('function OverviewStats')
    expect(workspace).toContain('<LiveStatsPanel')
    expect(workspace).toContain('<ContainerAdvisorPanel')
  })

  it('renders symptoms, likely causes, evidence and recommended actions', () => {
    expect(panel).toContain('Symptoms')
    expect(panel).toContain('Likely cause')
    expect(panel).toContain('Evidence')
    expect(panel).toContain('Recommended actions')
  })

  it('keeps privileged Docker execution behind typed IPC', () => {
    expect(contracts).toContain('advisor(id: string): Promise<ContainerAdvisorResult>')
    expect(preload).toContain("containers:advisor")
    expect(ipc).toContain("ipcMain.handle('containers:advisor'")
  })
})
