import { useMemo } from 'react'
import type { StorageTrendSample, StorageTrendSeries } from '../../../shared/contracts'

type MetricKey = keyof Pick<
  StorageTrendSample,
  'dockerAllocatedBytes' | 'vhdxBytes' | 'imagesBytes' | 'volumesBytes' | 'buildCacheBytes' | 'containersBytes'
>

type SeriesDef = {
  key: MetricKey
  label: string
  className: string
}

const footprintSeries: SeriesDef[] = [
  { key: 'dockerAllocatedBytes', label: 'Docker allocated', className: 'trend-docker' },
  { key: 'vhdxBytes', label: 'VHDX physical size', className: 'trend-vhdx' }
]

const breakdownSeries: SeriesDef[] = [
  { key: 'imagesBytes', label: 'Images', className: 'trend-images' },
  { key: 'volumesBytes', label: 'Volumes', className: 'trend-volumes' },
  { key: 'buildCacheBytes', label: 'Build Cache', className: 'trend-build-cache' },
  { key: 'containersBytes', label: 'Containers', className: 'trend-containers' }
]

export function StorageTrendCharts({ series }: { series: StorageTrendSeries }) {
  const samples = useMemo(() => downsample(series.samples, 240), [series.samples])

  if (samples.length < 2) {
    return (
      <div className="storage-trend-empty">
        <strong>More samples are needed for a trend line.</strong>
        <span>
          The current sample is already useful as a baseline. Storage Trends records another sample approximately every 15 minutes while the app is running.
        </span>
      </div>
    )
  }

  return (
    <div className="storage-trend-chart-grid">
      <TrendChart
        title="Docker allocation vs VHDX"
        subtitle="Docker-reported allocated bytes compared with the physical Docker Desktop virtual disk."
        samples={samples}
        series={footprintSeries}
      />
      <TrendChart
        title="Docker storage composition"
        subtitle="Images, Volumes, Build Cache and Container writable-layer footprint over time."
        samples={samples}
        series={breakdownSeries}
      />
    </div>
  )
}

function TrendChart({
  title,
  subtitle,
  samples,
  series
}: {
  title: string
  subtitle: string
  samples: StorageTrendSample[]
  series: SeriesDef[]
}) {
  const width = 920
  const height = 300
  const pad = { left: 58, right: 18, top: 36, bottom: 42 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const start = Date.parse(samples[0].capturedAt)
  const end = Date.parse(samples.at(-1)!.capturedAt)
  const span = Math.max(1, end - start)
  const max = Math.max(
    1,
    ...series.flatMap(def => samples.map(sample => Number(sample[def.key] ?? 0)))
  )

  const x = (value: string) => pad.left + (Date.parse(value) - start) / span * plotWidth
  const y = (value: number) => pad.top + plotHeight - Math.max(0, value) / max * plotHeight

  const grid = [0, .25, .5, .75, 1]
  const first = samples[0]
  const middle = samples[Math.floor(samples.length / 2)]
  const last = samples.at(-1)!

  return (
    <section className="card storage-trend-chart-card">
      <div className="chart-heading">
        <div>
          <div className="eyebrow">Historical storage</div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="storage-trend-legend">
          {series.map(def => (
            <span key={def.key}><i className={def.className} />{def.label}</span>
          ))}
        </div>
      </div>

      <div className="storage-trend-svg-scroll">
        <svg
          className="storage-trend-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}. ${series.map(def => `${def.label}: ${formatBytes(Number(last[def.key]))}`).join(', ')} at the latest sample.`}
        >
          <g className="storage-trend-grid">
            {grid.map(ratio => {
              const lineY = pad.top + plotHeight * (1 - ratio)
              return (
                <g key={ratio}>
                  <line x1={pad.left} y1={lineY} x2={width - pad.right} y2={lineY} />
                  <text x={pad.left - 8} y={lineY + 3} textAnchor="end">{formatCompactBytes(max * ratio)}</text>
                </g>
              )
            })}
          </g>

          <g className="storage-trend-axis-labels">
            <text x={pad.left} y={height - 13}>{formatAxisTime(first.capturedAt)}</text>
            <text x={width / 2} y={height - 13} textAnchor="middle">{formatAxisTime(middle.capturedAt)}</text>
            <text x={width - pad.right} y={height - 13} textAnchor="end">{formatAxisTime(last.capturedAt)}</text>
          </g>

          {series.map(def => (
            <g className={`storage-trend-series ${def.className}`} key={def.key}>
              <path d={linePath(samples, def.key, x, y)} />
              {samples.length <= 80 && samples.map(sample => (
                <circle key={sample.id} cx={x(sample.capturedAt)} cy={y(Number(sample[def.key] ?? 0))} r="2.2">
                  <title>{`${def.label}: ${formatBytes(Number(sample[def.key] ?? 0))} — ${new Date(sample.capturedAt).toLocaleString()}`}</title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="storage-trend-latest" role="list" aria-label={`${title} latest values`}>
        {series.map(def => (
          <div role="listitem" key={def.key}>
            <span>{def.label}</span>
            <strong>{formatBytes(Number(last[def.key] ?? 0))}</strong>
            <small>{formatSignedBytes(Number(last[def.key] ?? 0) - Number(first[def.key] ?? 0))}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function linePath(
  samples: StorageTrendSample[],
  key: MetricKey,
  x: (value: string) => number,
  y: (value: number) => number
) {
  return samples.map((sample, index) =>
    `${index === 0 ? 'M' : 'L'} ${x(sample.capturedAt).toFixed(2)} ${y(Number(sample[key] ?? 0)).toFixed(2)}`
  ).join(' ')
}

function downsample(samples: StorageTrendSample[], limit: number) {
  if (samples.length <= limit) return samples
  const result: StorageTrendSample[] = []
  const step = (samples.length - 1) / (limit - 1)
  for (let index = 0; index < limit; index++) {
    result.push(samples[Math.round(index * step)])
  }
  return result
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

export function formatSignedBytes(bytes: number) {
  if (!bytes) return 'No change'
  return `${bytes > 0 ? '+' : '−'}${formatBytes(Math.abs(bytes))}`
}

function formatCompactBytes(bytes: number) {
  if (!bytes) return '0'
  const units = [
    ['TB', 1024 ** 4],
    ['GB', 1024 ** 3],
    ['MB', 1024 ** 2],
    ['KB', 1024]
  ] as const
  for (const [unit, factor] of units) {
    if (bytes >= factor) return `${(bytes / factor).toFixed(bytes / factor >= 10 ? 0 : 1)}${unit}`
  }
  return `${Math.round(bytes)}B`
}

function formatAxisTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
