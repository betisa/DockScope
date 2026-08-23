import { randomUUID } from 'node:crypto'
import type { DiskUsage, StorageTrendRange, StorageTrendSample, StorageTrendSeries } from '../../shared/contracts'
import { dockerService } from './dockerService'
import { windowsStorageService } from './windowsStorageService'
import { databaseService } from '../database/database'
import { importLegacyJson } from '../database/legacyImport'

const SAMPLE_INTERVAL_MS = 15 * 60_000
const MIN_SCHEDULED_GAP_MS = 10 * 60_000
const RETENTION_MS = 31 * 24 * 60 * 60_000
const MAX_SAMPLES = 3_100

function parseHumanBytes(value: string) {
  const normalized = String(value ?? '').trim().replaceAll(',', '')
  const match = normalized.match(/([\d.]+)\s*([kmgtp]?i?b)/i)
  if (!match) return 0
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const units: Record<string, number> = {
    b: 1,
    kb: 1_000,
    mb: 1_000_000,
    gb: 1_000_000_000,
    tb: 1_000_000_000_000,
    pb: 1_000_000_000_000_000,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    pib: 1024 ** 5
  }
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * (units[unit] ?? 1))) : 0
}

function row(usage: DiskUsage[], pattern: RegExp) {
  return usage.find(item => pattern.test(item.type))
}

function rangeMs(range: StorageTrendRange) {
  if (range === '24h') return 24 * 60 * 60_000
  if (range === '7d') return 7 * 24 * 60 * 60_000
  return 30 * 24 * 60 * 60_000
}

function summarize(range: StorageTrendRange, samples: StorageTrendSample[]): StorageTrendSeries {
  const sorted = [...samples].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
  const first = sorted[0]
  const last = sorted.at(-1)
  const peak = (key: keyof StorageTrendSample) => sorted.reduce((max, sample) => {
    const value = Number(sample[key] ?? 0)
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)

  return {
    range,
    samples: sorted,
    summary: {
      sampleCount: sorted.length,
      firstCapturedAt: first?.capturedAt ?? '',
      lastCapturedAt: last?.capturedAt ?? '',
      dockerAllocatedDeltaBytes: first && last ? last.dockerAllocatedBytes - first.dockerAllocatedBytes : 0,
      vhdxDeltaBytes: first && last ? last.vhdxBytes - first.vhdxBytes : 0,
      peakDockerAllocatedBytes: peak('dockerAllocatedBytes'),
      peakVhdxBytes: peak('vhdxBytes'),
      latestDockerAllocatedBytes: last?.dockerAllocatedBytes ?? 0,
      latestDockerReclaimableBytes: last?.dockerReclaimableBytes ?? 0,
      latestVhdxBytes: last?.vhdxBytes ?? 0,
      latestHostDriveFreeBytes: last?.hostDriveFreeBytes ?? 0
    }
  }
}

class StorageTrendService {
  private samples: StorageTrendSample[] = []
  private loaded = false
  private timer: NodeJS.Timeout | null = null
  private sampling: Promise<StorageTrendSample> | null = null

  async initialize() {
    await this.ensureLoaded()
    await this.sample(false).catch(() => undefined)
    if (process.env.NODE_ENV !== 'test' && !this.timer) {
      this.timer = setInterval(() => void this.sample(false).catch(() => undefined), SAMPLE_INTERVAL_MS)
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async ensureLoaded() {
    if (this.loaded) return
    await databaseService.initialize()

    await importLegacyJson<StorageTrendSample[]>('storage-trends.json', async legacy => {
      const rows = Array.isArray(legacy) ? legacy.filter(this.isSample) : []
      if (rows.length) {
        await databaseService.db.transaction(async trx => {
          for (const sample of rows) {
            await trx('storage_trends').insert({
              id: sample.id,
              captured_at: sample.capturedAt,
              docker_allocated_bytes: sample.dockerAllocatedBytes,
              vhdx_bytes: sample.vhdxBytes,
              payload: JSON.stringify(sample)
            }).onConflict('id').ignore()
          }
        })
      }
      return rows.length
    })

    const rows = await databaseService.db('storage_trends')
      .select('payload')
      .orderBy('captured_at','asc')
    this.samples = rows
      .map(row => {
        try { return JSON.parse(row.payload) as StorageTrendSample } catch { return null }
      })
      .filter((value): value is StorageTrendSample => Boolean(value && this.isSample(value)))

    this.prune()
    this.loaded = true
    await this.persist()
  }

  private isSample(value: any): value is StorageTrendSample {
    return value &&
      typeof value.id === 'string' &&
      typeof value.capturedAt === 'string' &&
      Number.isFinite(Number(value.dockerAllocatedBytes)) &&
      Number.isFinite(Number(value.vhdxBytes))
  }

  private prune() {
    const cutoff = Date.now() - RETENTION_MS
    this.samples = this.samples
      .filter(sample => Date.parse(sample.capturedAt) >= cutoff)
      .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
      .slice(-MAX_SAMPLES)
  }

  private async persist() {
    this.prune()
    const samples = [...this.samples]
    await databaseService.db.transaction(async trx => {
      await trx('storage_trends').delete()
      for (const sample of samples) {
        await trx('storage_trends').insert({
          id: sample.id,
          captured_at: sample.capturedAt,
          docker_allocated_bytes: sample.dockerAllocatedBytes,
          vhdx_bytes: sample.vhdxBytes,
          payload: JSON.stringify(sample)
        })
      }
    })
  }

  async sampleNow() {
    return this.sample(true)
  }

  private async sample(force: boolean): Promise<StorageTrendSample> {
    await this.ensureLoaded()
    if (this.sampling) return this.sampling

    const latest = this.samples.at(-1)
    if (!force && latest && Date.now() - Date.parse(latest.capturedAt) < MIN_SCHEDULED_GAP_MS) {
      return latest
    }

    this.sampling = (async () => {
      const usage = await dockerService.diskUsage()
      if (!usage.length) throw new Error('Docker storage usage is unavailable.')

      const images = row(usage, /^images?$/i) ?? row(usage, /image/i)
      const containers = row(usage, /^containers?$/i) ?? row(usage, /container/i)
      const volumes = row(usage, /local volumes?|volumes?/i)
      const buildCache = row(usage, /build cache/i)

      const allocatedRows = [images, containers, volumes, buildCache].filter(Boolean) as DiskUsage[]
      const dockerAllocatedBytes = allocatedRows.reduce((sum, item) => sum + parseHumanBytes(item.size), 0)
      const dockerReclaimableBytes = allocatedRows.reduce((sum, item) => sum + parseHumanBytes(item.reclaimable), 0)

      const vhdx = (await windowsStorageService.findVhdx().catch(() => []))[0]

      const sample: StorageTrendSample = {
        id: randomUUID(),
        capturedAt: new Date().toISOString(),
        imagesBytes: parseHumanBytes(images?.size ?? '0 B'),
        containersBytes: parseHumanBytes(containers?.size ?? '0 B'),
        volumesBytes: parseHumanBytes(volumes?.size ?? '0 B'),
        buildCacheBytes: parseHumanBytes(buildCache?.size ?? '0 B'),
        dockerAllocatedBytes,
        dockerReclaimableBytes,
        vhdxBytes: Number(vhdx?.bytes ?? 0),
        hostDriveFreeBytes: parseHumanBytes(vhdx?.driveFree ?? '0 B'),
        imageCount: Number(images?.totalCount ?? 0),
        containerCount: Number(containers?.totalCount ?? 0),
        volumeCount: Number(volumes?.totalCount ?? 0),
        buildCacheRecords: Number(buildCache?.totalCount ?? 0)
      }

      this.samples.push(sample)
      await this.persist()
      return structuredClone(sample)
    })()

    try {
      return await this.sampling
    } finally {
      this.sampling = null
    }
  }

  async trends(range: StorageTrendRange): Promise<StorageTrendSeries> {
    await this.ensureLoaded()
    const valid: StorageTrendRange = ['24h', '7d', '30d'].includes(range) ? range : '24h'
    const cutoff = Date.now() - rangeMs(valid)
    return summarize(valid, this.samples.filter(sample => Date.parse(sample.capturedAt) >= cutoff))
  }
}

export const storageTrendService = new StorageTrendService()
