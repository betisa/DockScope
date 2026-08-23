import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.04 Volume Intelligence', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/VolumesPage.tsx', 'utf8')
  const workspace = readFileSync('src/renderer/src/components/VolumeIntelligenceWorkspace.tsx', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')

  it('exposes typed intelligence through Electron Main and preload', () => {
    expect(contracts).toContain('export type VolumeIntelligence')
    expect(contracts).toContain('export type VolumeRiskAssessment')
    expect(service).toContain('async volumeIntelligence(): Promise<VolumeIntelligence[]>')
    expect(ipc).toContain("ipcMain.handle('volumes:intelligence'")
    expect(preload).toContain("ipcRenderer.invoke('volumes:intelligence')")
  })

  it('correlates volumes with container mounts and Compose labels', () => {
    expect(service).toContain("container.Mounts")
    expect(service).toContain("String(mount.Type ?? '').toLowerCase() !== 'volume'")
    expect(service).toContain("'com.docker.compose.project'")
    expect(service).toContain("'com.docker.compose.service'")
    expect(service).toContain('destination: String(mount.Destination')
  })

  it('detects known persistent workloads and produces backup hints', () => {
    expect(service).toContain("kind:'postgresql'")
    expect(service).toContain("kind:'mysql-mariadb'")
    expect(service).toContain("kind:'sql-server'")
    expect(service).toContain("kind:'mongodb'")
    expect(service).toContain("kind:'redis'")
    expect(service).toContain("kind:'minio'")
    expect(service).toContain("kind:'elasticsearch'")
    expect(service).toContain('pg_dump/pg_dumpall')
  })

  it('never presents persistent volumes as safe-to-delete', () => {
    expect(contracts).toContain("'blocked' | 'high-risk' | 'review-required'")
    expect(page).toContain('No volume is labeled “safe to delete.”')
    expect(page).not.toContain('Safe to delete')
    expect(workspace).toContain('Metadata is not a backup.')
  })

  it('provides search, pagination, risk filters and ownership navigation', () => {
    expect(page).toContain('<ListControls')
    expect(page).toContain('pageSize: 10')
    expect(page).toContain('High / critical risk only')
    expect(page).toContain('No current references only')
    expect(workspace).toContain('onOpenContainer')
    expect(workspace).toContain('onOpenCompose')
  })

  it('documents the limitations in the in-app guide', () => {
    expect(guide).toContain("title: 'Volume Intelligence Guide'")
    expect(guide).toContain('No current container reference does not prove the volume is disposable.')
    expect(guide).toContain('relationship metadata, not proof of the last read/write')
  })
})
