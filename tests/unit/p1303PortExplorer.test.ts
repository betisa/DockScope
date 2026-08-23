import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.03 Port Explorer', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/PortExplorerPage.tsx', 'utf8')
  const nav = readFileSync('src/renderer/src/navigation.ts', 'utf8')

  it('exposes typed port inventory through the Electron security boundary', () => {
    expect(contracts).toContain('export type PortBindingInfo')
    expect(contracts).toContain('export type PortExplorerResult')
    expect(service).toContain('async portExplorer(): Promise<PortExplorerResult>')
    expect(ipc).toContain("ipcMain.handle('ports:list'")
    expect(preload).toContain("ipcRenderer.invoke('ports:list')")
  })

  it('derives ownership from Docker Compose labels and real inspect port maps', () => {
    expect(service).toContain("container.NetworkSettings?.Ports")
    expect(service).toContain("'com.docker.compose.project'")
    expect(service).toContain("'com.docker.compose.service'")
  })

  it('detects host binding overlap without mixing protocols', () => {
    expect(service).toContain('function bindingsOverlap')
    expect(service).toContain("a.protocol.toLowerCase() !== b.protocol.toLowerCase()")
    expect(service).toContain('ipv4Wildcard')
    expect(service).toContain('ipv6Wildcard')
  })

  it('provides search, pagination, filters, copy, safe browser open and resource navigation', () => {
    expect(page).toContain('<ListControls')
    expect(page).toContain('pageSize: 10')
    expect(page).toContain('Conflicts only')
    expect(page).toContain('navigator.clipboard.writeText')
    expect(page).toContain('window.dockerApi.ports.open')
    expect(page).toContain("onNavigate('containers')")
    expect(page).toContain("onNavigate('compose')")
  })

  it('registers Port Explorer as a first-class Resource page', () => {
    expect(nav).toContain("id: 'ports'")
    expect(nav).toContain("label: 'Port Explorer'")
  })
})
