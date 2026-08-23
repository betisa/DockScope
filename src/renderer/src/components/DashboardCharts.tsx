import { useMemo } from 'react'
import type { ContainerInfo, DiskUsage } from '../../../shared/contracts'

type StorageRow = {
  label: string
  totalBytes: number
  reclaimableBytes: number
  totalText: string
  reclaimableText: string
}

export function StorageUsageChart({ usage }: { usage: DiskUsage[] }) {
  const rows = useMemo<StorageRow[]>(
    () => usage.map(item => ({
      label: item.type,
      totalBytes: parseHumanBytes(item.size),
      reclaimableBytes: parseHumanBytes(item.reclaimable),
      totalText: item.size,
      reclaimableText: item.reclaimable
    })).sort((a, b) => b.totalBytes - a.totalBytes),
    [usage]
  )

  const max = Math.max(...rows.map(row => row.totalBytes), 1)

  return (
    <div className="dashboard-chart" aria-label="Docker storage usage chart">
      <div className="chart-heading">
        <div>
          <div className="eyebrow">Storage footprint</div>
          <h3>Allocated vs reclaimable</h3>
        </div>
        <div className="chart-legend" aria-label="Storage chart legend">
          <span><i className="legend-swatch storage-total" />Allocated</span>
          <span><i className="legend-swatch storage-reclaimable" />Reclaimable</span>
        </div>
      </div>

      <div className="storage-bars" role="list">
        {rows.map(row => {
          const totalPercent = Math.max(2, row.totalBytes / max * 100)
          const reclaimPercent = row.totalBytes > 0
            ? Math.min(100, row.reclaimableBytes / row.totalBytes * 100)
            : 0

          return (
            <div className="storage-bar-row" key={row.label} role="listitem">
              <div className="storage-bar-meta">
                <strong>{row.label}</strong>
                <span>{row.totalText}</span>
              </div>
              <div
                className="storage-bar-track"
                role="img"
                aria-label={`${row.label}: ${row.totalText} allocated, ${row.reclaimableText} reclaimable`}
              >
                <div className="storage-bar-total" style={{ width: `${totalPercent}%` }}>
                  <div
                    className="storage-bar-reclaimable"
                    style={{ width: `${reclaimPercent}%` }}
                  />
                </div>
              </div>
              <div className="storage-reclaim-text">
                {row.reclaimableText} reclaimable
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ContainerStateChart({ containers }: { containers: ContainerInfo[] }) {
  const segments = useMemo(() => {
    const groups = [
      { key: 'running', label: 'Running', count: 0, className: 'state-running' },
      { key: 'restarting', label: 'Restarting', count: 0, className: 'state-restarting' },
      { key: 'paused', label: 'Paused', count: 0, className: 'state-paused' },
      { key: 'stopped', label: 'Stopped', count: 0, className: 'state-stopped' },
      { key: 'other', label: 'Other', count: 0, className: 'state-other' }
    ]

    for (const container of containers) {
      const state = container.state.toLowerCase()
      if (state === 'running') groups[0].count++
      else if (state === 'restarting') groups[1].count++
      else if (state === 'paused') groups[2].count++
      else if (['exited', 'created', 'dead', 'removing'].includes(state)) groups[3].count++
      else groups[4].count++
    }

    return groups.filter(group => group.count > 0)
  }, [containers])

  const total = Math.max(containers.length, 1)
  const radius = 70
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="dashboard-chart container-state-chart">
      <div className="chart-heading">
        <div>
          <div className="eyebrow">Runtime</div>
          <h3>Container states</h3>
        </div>
      </div>

      <div className="donut-layout">
        <div className="donut-wrap">
          <svg
            className="donut-chart"
            viewBox="0 0 180 180"
            role="img"
            aria-label={`${containers.length} containers: ${segments.map(s => `${s.count} ${s.label}`).join(', ')}`}
          >
            <circle className="donut-track" cx="90" cy="90" r={radius} />
            {segments.map(segment => {
              const length = segment.count / total * circumference
              const currentOffset = offset
              offset += length
              return (
                <circle
                  key={segment.key}
                  className={`donut-segment ${segment.className}`}
                  cx="90"
                  cy="90"
                  r={radius}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-currentOffset}
                />
              )
            })}
          </svg>
          <div className="donut-center" aria-hidden="true">
            <strong>{containers.length}</strong>
            <span>containers</span>
          </div>
        </div>

        <div className="state-legend" role="list" aria-label="Container state counts">
          {segments.map(segment => (
            <div className="state-legend-row" key={segment.key} role="listitem">
              <span className={`state-dot ${segment.className}`} />
              <span>{segment.label}</span>
              <strong>{segment.count}</strong>
            </div>
          ))}
          {!segments.length && <div className="muted">No containers</div>}
        </div>
      </div>
    </div>
  )
}

function parseHumanBytes(value: string) {
  const match = value.trim().match(/([\d.]+)\s*([kmgtp]?i?b)/i)
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

  return Number.isFinite(amount) ? amount * (units[unit] ?? 1) : 0
}
