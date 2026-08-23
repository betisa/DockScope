import { useEffect, useState } from 'react'
import type { StorageTrendRange, StorageTrendSeries, VhdxInfo } from '../../../shared/contracts'
import { Badge, CodePanel, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { PageTitle } from '../components/PageTitle'
import { StorageTrendCharts, formatBytes, formatSignedBytes } from '../components/StorageTrendCharts'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'

const emptySeries: StorageTrendSeries = {
  range: '24h',
  samples: [],
  summary: {
    sampleCount: 0,
    firstCapturedAt: '',
    lastCapturedAt: '',
    dockerAllocatedDeltaBytes: 0,
    vhdxDeltaBytes: 0,
    peakDockerAllocatedBytes: 0,
    peakVhdxBytes: 0,
    latestDockerAllocatedBytes: 0,
    latestDockerReclaimableBytes: 0,
    latestVhdxBytes: 0,
    latestHostDriveFreeBytes: 0
  }
}

export function StoragePage() {
  const [rows, setRows] = useState<VhdxInfo[]>([])
  const [range, setRange] = useState<StorageTrendRange>('24h')
  const [trends, setTrends] = useState<StorageTrendSeries>(emptySeries)
  const [loading, setLoading] = useState(true)
  const [sampling, setSampling] = useState(false)
  const [error, setError] = useState('')
  const [output, setOutput] = useState('')

  const load = async (nextRange = range) => {
    setLoading(true)
    setError('')
    try {
      const [vhdxRows, trendSeries] = await Promise.all([
        window.dockerApi.storage.findVhdx(),
        window.dockerApi.storage.trends(nextRange)
      ])
      setRows(vhdxRows)
      setTrends(trendSeries)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(range) }, [range])

  const sampleNow = async () => {
    setSampling(true)
    setError('')
    try {
      await window.dockerApi.storage.sampleNow()
      await load(range)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setSampling(false)
    }
  }

  const latest = trends.samples.at(-1)

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="storage"
          title="Storage Trends & VHDX"
          subtitle="Historical Docker storage growth, reclaimable space and physical Docker Desktop VHDX footprint."
        />
        <div className="inline-actions">
          <button className="button secondary" disabled={sampling} onClick={() => void sampleNow()}>
            <AppIcon icon={RefreshIcon} />
            {sampling ? 'Sampling…' : 'Record sample now'}
          </button>
          <button className="button secondary" onClick={() => void load(range)}>Refresh</button>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load Storage Trends">{error}</InlineAlert>}

      <section className="storage-trend-controls card">
        <div>
          <div className="eyebrow">History range</div>
          <h2>Storage timeline</h2>
          <p className="muted">
            Samples are stored locally, approximately every 15 minutes while DockScope is running, with bounded 31-day retention.
          </p>
        </div>
        <div className="segmented-control" role="group" aria-label="Storage trend range">
          {(['24h', '7d', '30d'] as StorageTrendRange[]).map(value => (
            <button
              key={value}
              className={range === value ? 'active' : ''}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {value === '24h' ? '24 hours' : value === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <LoadingState label="Loading storage trends" rows={8} />
      ) : (
        <>
          <section className="storage-trend-summary">
            <TrendMetric
              label="Docker allocated"
              value={formatBytes(trends.summary.latestDockerAllocatedBytes)}
              delta={formatSignedBytes(trends.summary.dockerAllocatedDeltaBytes)}
              growing={trends.summary.dockerAllocatedDeltaBytes > 0}
            />
            <TrendMetric
              label="Docker reclaimable"
              value={formatBytes(trends.summary.latestDockerReclaimableBytes)}
              detail={percentage(
                trends.summary.latestDockerReclaimableBytes,
                trends.summary.latestDockerAllocatedBytes
              )}
            />
            <TrendMetric
              label="VHDX size"
              value={formatBytes(trends.summary.latestVhdxBytes)}
              delta={formatSignedBytes(trends.summary.vhdxDeltaBytes)}
              growing={trends.summary.vhdxDeltaBytes > 0}
            />
            <TrendMetric
              label="Host drive free"
              value={formatBytes(trends.summary.latestHostDriveFreeBytes)}
              detail={trends.summary.lastCapturedAt ? `as of ${formatDate(trends.summary.lastCapturedAt)}` : 'No sample'}
            />
            <TrendMetric
              label="Samples"
              value={String(trends.summary.sampleCount)}
              detail={`Range: ${rangeLabel(range)}`}
            />
          </section>

          <StorageTrendCharts series={trends} />

          {latest && (
            <section className="card storage-latest-breakdown">
              <div className="section-row">
                <div>
                  <div className="eyebrow">Latest sample</div>
                  <h2>Storage composition</h2>
                  <p className="muted">{formatDate(latest.capturedAt)}</p>
                </div>
                <Badge tone="info">{trends.summary.sampleCount} samples in view</Badge>
              </div>
              <div className="storage-breakdown-grid">
                <Breakdown label="Images" bytes={latest.imagesBytes} count={latest.imageCount} />
                <Breakdown label="Containers" bytes={latest.containersBytes} count={latest.containerCount} />
                <Breakdown label="Volumes" bytes={latest.volumesBytes} count={latest.volumeCount} />
                <Breakdown label="Build Cache" bytes={latest.buildCacheBytes} count={latest.buildCacheRecords} />
              </div>
            </section>
          )}

          <section className="card storage-trend-insights">
            <div className="section-row">
              <div><div className="eyebrow">Range analysis</div><h2>Growth & peak signals</h2></div>
            </div>
            <div className="storage-insight-grid">
              <Insight
                title="Docker allocation change"
                value={formatSignedBytes(trends.summary.dockerAllocatedDeltaBytes)}
                text={growthText(trends.summary.dockerAllocatedDeltaBytes, 'Docker-reported allocation')}
              />
              <Insight
                title="VHDX physical change"
                value={formatSignedBytes(trends.summary.vhdxDeltaBytes)}
                text={growthText(trends.summary.vhdxDeltaBytes, 'Docker Desktop virtual disk')}
              />
              <Insight
                title="Peak Docker allocation"
                value={formatBytes(trends.summary.peakDockerAllocatedBytes)}
                text="Highest Docker-reported allocated footprint inside the selected range."
              />
              <Insight
                title="Peak VHDX"
                value={formatBytes(trends.summary.peakVhdxBytes)}
                text="Largest observed physical virtual-disk file size inside the selected range."
              />
            </div>
          </section>
        </>
      )}

      <section className="card storage-sampling-note">
        <div className="section-row">
          <div>
            <div className="eyebrow">Sampling model</div>
            <h2>Local, bounded and read-only</h2>
          </div>
          <Badge tone="ok">No external telemetry</Badge>
        </div>
        <div className="storage-sampling-grid">
          <span><strong>15 min</strong> scheduled interval while the app is running</span>
          <span><strong>31 days</strong> maximum retention window</span>
          <span><strong>3,100</strong> maximum stored samples</span>
          <span><strong>Local only</strong> stored under Electron userData</span>
        </div>
      </section>

      <div className="warning-banner">
        <strong>VHDX interpretation.</strong> Docker object cleanup can reduce Docker-reported allocation before the physical VHDX file shrinks. Use VHDX compaction only after cleanup and with the existing disruptive-operation safeguards.
      </div>

      {!rows.length ? (
        <EmptyState
          title="Docker VHDX not found"
          text="Storage Trends can still record Docker object history. Configure a custom VHDX path in Settings when Docker Desktop uses a non-standard location."
        />
      ) : (
        <div className="vhdx-grid">
          {rows.map(v => (
            <section className="card vhdx-card" key={v.path}>
              <div className="section-row">
                <div><div className="eyebrow">Virtual disk</div><h2>{v.size}</h2></div>
                <Badge tone="warn">Admin required</Badge>
              </div>
              <div className="detail-meta">
                <span>Path</span><code className="wrap">{v.path}</code>
                <span>Host free</span><strong>{v.driveFree}</strong>
              </div>
              <button className="button danger" onClick={async () => {
                const typed = window.prompt('This will stop Docker Desktop and all WSL distributions.\nType COMPACT DOCKER VHDX to continue.')
                if (typed !== 'COMPACT DOCKER VHDX') return
                const task = await window.dockerApi.tasks.enqueue({
                  kind: 'vhdx-compact',
                  vhdxPath: v.path,
                  sourcePage: 'storage',
                  resourceName: v.path
                })
                setOutput(`Queued in Task Center: ${task.title}`)
              }}>Compact VHDX</button>
            </section>
          ))}
        </div>
      )}

      {output && <CodePanel title="VHDX operation" value={output} />}
    </div>
  )
}

function TrendMetric({
  label,
  value,
  delta,
  detail,
  growing = false
}: {
  label: string
  value: string
  delta?: string
  detail?: string
  growing?: boolean
}) {
  return (
    <div className="metric card storage-trend-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta && <Badge tone={growing ? 'warn' : delta === 'No change' ? 'neutral' : 'ok'}>{delta}</Badge>}
      {detail && <small>{detail}</small>}
    </div>
  )
}

function Breakdown({ label, bytes, count }: { label: string; bytes: number; count: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatBytes(bytes)}</strong>
      <small>{count} record{count === 1 ? '' : 's'}</small>
    </div>
  )
}

function Insight({ title, value, text }: { title: string; value: string; text: string }) {
  return (
    <article>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{text}</p>
    </article>
  )
}

function percentage(part: number, total: number) {
  if (!total || !part) return '0% of current allocation'
  return `${Math.round(part / total * 100)}% of current allocation`
}

function rangeLabel(range: StorageTrendRange) {
  return range === '24h' ? '24 hours' : range === '7d' ? '7 days' : '30 days'
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function growthText(delta: number, subject: string) {
  if (delta > 0) return `${subject} increased during the selected range. Review composition and reclaimable space if growth is unexpected.`
  if (delta < 0) return `${subject} decreased during the selected range. This may reflect cleanup, pruning, resource deletion, or VHDX compaction.`
  return `${subject} is unchanged between the first and latest sample in this range.`
}
