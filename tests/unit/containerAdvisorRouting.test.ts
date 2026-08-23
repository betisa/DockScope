import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Container Advisor routing regression', () => {
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const panel = readFileSync('src/renderer/src/components/ContainerAdvisorPanel.tsx', 'utf8')

  it('uses distinct service methods for Container Advisor and Cleanup Advisor', () => {
    expect(service).toContain('async containerAdvisor(id: string): Promise<ContainerAdvisorResult>')
    expect(service).toContain('async cleanupAdvisor(): Promise<CleanupAdvisorItem[]>')
    expect(service).not.toContain('async advisor(id: string): Promise<ContainerAdvisorResult>')
    expect(service).not.toContain('async advisor(): Promise<CleanupAdvisorItem[]>')
  })

  it('routes each IPC endpoint to the correct service method', () => {
    expect(ipc).toContain("ipcMain.handle('containers:advisor', (_, id) => dockerService.containerAdvisor")
    expect(ipc).toContain("ipcMain.handle('cleanup:advisor', () => dockerService.cleanupAdvisor())")
  })

  it('does not call filter on an undefined findings collection', () => {
    expect(panel).toContain('Array.isArray(result?.findings) ? result.findings : []')
    expect(panel).toContain('Unexpected Container Advisor response')
    expect(panel).not.toContain('result?.findings.filter')
  })
})
