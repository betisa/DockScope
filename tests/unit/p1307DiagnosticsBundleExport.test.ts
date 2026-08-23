import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.07 Diagnostics Bundle Export', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/diagnosticsBundleService.ts', 'utf8')
  const zip = readFileSync('src/main/services/simpleZip.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const auditPage = readFileSync('src/renderer/src/pages/AuditPage.tsx', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')
  const packageJson = readFileSync('package.json', 'utf8')

  it('defines typed manifest, collector and export-result contracts', () => {
    expect(contracts).toContain('export type DiagnosticsBundleCollector')
    expect(contracts).toContain('export type DiagnosticsBundleManifest')
    expect(contracts).toContain('export type DiagnosticsBundleExportResult')
  })

  it('uses independent collectors so one failure does not abort the bundle', () => {
    expect(service).toContain("status: 'failed'")
    expect(service).toContain("status: 'skipped'")
    expect(service).toContain('collectors.push')
    expect(service).toContain('manifest.json')
  })

  it('collects the required Docker and application diagnostics', () => {
    for (const expected of [
      'docker/engine-status.json',
      'docker/disk-usage.json',
      'docker/containers.json',
      'docker/compose-projects.json',
      'docker/images.json',
      'docker/networks.json',
      'docker/ports.json',
      'docker/resource-graph.json',
      'docker/volumes.json',
      'docker/build-history.json',
      'monitoring/notifications.json',
      'operations/tasks.json',
      'operations/audit-history.json',
      'operations/recovery-snapshots.json'
    ]) {
      expect(service).toContain(expected)
    }
  })

  it('bounds per-container collection and log tails', () => {
    expect(service).toContain('const MAX_CONTAINERS = 25')
    expect(service).toContain('const LOG_TAIL_LINES = 300')
    expect(service).toContain('containers.slice(0, MAX_CONTAINERS)')
  })

  it('always redacts common secret patterns before ZIP insertion', () => {
    expect(service).toContain('function redactString')
    expect(service).toContain('function sensitiveKey')
    expect(service).toContain("return '***'")
    expect(service).toContain('authorization')
    expect(service).toContain('connectionstring')
    expect(service).toContain('%USERPROFILE%')
    expect(service).toContain('redactValue')
  })

  it('does not copy volume contents or container filesystems', () => {
    expect(service).not.toContain('fs.cp(')
    expect(service).not.toContain('docker cp')
    expect(service).not.toContain('container export')
  })

  it('uses an internal standards-compatible ZIP writer without adding a package dependency', () => {
    expect(zip).toContain('0x04034b50')
    expect(zip).toContain('0x02014b50')
    expect(zip).toContain('0x06054b50')
    expect(zip).toContain('crc32')
    expect(packageJson).not.toContain('"archiver"')
    expect(packageJson).not.toContain('"yazl"')
    expect(packageJson).not.toContain('"jszip"')
  })

  it('keeps destination selection in Electron Main', () => {
    expect(ipc).toContain("dialog.showSaveDialog")
    expect(ipc).toContain("ipcMain.handle('diagnostics:export-bundle'")
    expect(preload).toContain("ipcRenderer.invoke('diagnostics:export-bundle')")
    expect(preload).not.toContain('diagnostics:export-bundle\', path')
  })

  it('exposes export status from Audit & Recovery and documents sharing safety', () => {
    expect(auditPage).toContain('Export diagnostics bundle')
    expect(auditPage).toContain('Best-effort redaction')
    expect(auditPage).toContain('collector failures')
    expect(guide).toContain('Diagnostics Bundle Export')
    expect(guide).toContain('Review the ZIP before sending it outside a trusted support channel.')
  })
})
