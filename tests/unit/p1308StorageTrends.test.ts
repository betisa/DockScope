import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.08 Storage Trends', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/storageTrendService.ts', 'utf8')
  const main = readFileSync('src/main/index.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/StoragePage.tsx', 'utf8')
  const charts = readFileSync('src/renderer/src/components/StorageTrendCharts.tsx', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')
  const bundle = readFileSync('src/main/services/diagnosticsBundleService.ts', 'utf8')

  it('defines typed samples and 24h/7d/30d trend ranges', () => {
    expect(contracts).toContain("export type StorageTrendRange = '24h' | '7d' | '30d'")
    expect(contracts).toContain('export type StorageTrendSample')
    expect(contracts).toContain('export type StorageTrendSeries')
  })

  it('samples in Electron Main with bounded cadence and retention', () => {
    expect(service).toContain('const SAMPLE_INTERVAL_MS = 15 * 60_000')
    expect(service).toContain('const MIN_SCHEDULED_GAP_MS = 10 * 60_000')
    expect(service).toContain('const RETENTION_MS = 31 * 24 * 60 * 60_000')
    expect(service).toContain('const MAX_SAMPLES = 3_100')
    expect(service).toContain("databaseService.db('storage_trends')")
    expect(main).toContain('storageTrendService.initialize()')
    expect(main).toContain('storageTrendService.dispose()')
  })

  it('persists atomically and does not create a sample before Docker usage succeeds', () => {
    const diskUsageIndex = service.indexOf('const usage = await dockerService.diskUsage()')
    const samplePushIndex = service.indexOf('this.samples.push(sample)')
    expect(diskUsageIndex).toBeGreaterThan(-1)
    expect(samplePushIndex).toBeGreaterThan(diskUsageIndex)
    expect(service).toContain("trx('storage_trends').delete()")
    expect(service).toContain("trx('storage_trends').insert")
  })

  it('captures all requested storage dimensions', () => {
    for (const field of [
      'imagesBytes',
      'containersBytes',
      'volumesBytes',
      'buildCacheBytes',
      'dockerAllocatedBytes',
      'dockerReclaimableBytes',
      'vhdxBytes',
      'hostDriveFreeBytes',
      'imageCount',
      'containerCount',
      'volumeCount',
      'buildCacheRecords'
    ]) {
      expect(service).toContain(field)
    }
  })

  it('exposes trend query and manual sample IPC without arbitrary data mutation', () => {
    expect(ipc).toContain("ipcMain.handle('storage:trends'")
    expect(ipc).toContain("ipcMain.handle('storage:sample-now'")
    expect(preload).toContain("ipcRenderer.invoke('storage:trends'")
    expect(preload).toContain("ipcRenderer.invoke('storage:sample-now')")
    expect(page).toContain('Record sample now')
  })

  it('provides 24h, 7d and 30d UI with growth/peak analysis', () => {
    expect(page).toContain("(['24h', '7d', '30d'] as StorageTrendRange[])")
    expect(page).toContain('Docker allocation change')
    expect(page).toContain('VHDX physical change')
    expect(page).toContain('Peak Docker allocation')
    expect(page).toContain('Peak VHDX')
  })

  it('bounds SVG render points for long histories', () => {
    expect(charts).toContain('downsample(series.samples, 240)')
    expect(charts).toContain('Docker allocation vs VHDX')
    expect(charts).toContain('Docker storage composition')
    expect(charts).toContain("'imagesBytes'")
    expect(charts).toContain("'volumesBytes'")
    expect(charts).toContain("'buildCacheBytes'")
  })

  it('documents local-only sampling and Docker allocation vs VHDX semantics', () => {
    expect(guide).toContain("title: 'Storage Trends & VHDX Guide'")
    expect(guide).toContain('Historical points are local snapshots, not external telemetry.')
    expect(guide).toContain('Docker cleanup can reduce logical allocation without immediately shrinking the VHDX file.')
  })

  it('includes 30-day Storage Trends in Diagnostics Bundle Export', () => {
    expect(bundle).toContain("storage/storage-trends-30d.json")
    expect(bundle).toContain("storageTrendService.trends('30d')")
  })
})
