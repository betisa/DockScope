import { useEffect, useMemo, useState } from 'react'
import type { ComposeProject, ComposeServiceInfo, ContainerInfo } from '../../../shared/contracts'
import { formatUptime } from '../../../shared/formatting'
import { Activity01Icon, RefreshIcon, Search01Icon } from '@hugeicons/core-free-icons'
import { AppIcon } from '../components/Icon'
import { Badge, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { PageTitle } from '../components/PageTitle'

const HISTORY_KEY = 'ui.uptime.report.history.v1'
const HISTORY_SLOTS = 30
const REFRESH_INTERVAL = 30_000
const DAY = 24 * 60 * 60 * 1000

type MonitorState = 'up' | 'down' | 'unknown'
type MonitorKind = 'container' | 'compose'

type UptimeMonitor = {
  id: string
  name: string
  kind: MonitorKind
  group: string
  image: string
  startedAt: string
  state: MonitorState
  health: string
  status: string
}

type StatusSample = {
  at: string
  state: MonitorState
}

type HistoryStore = Record<string, StatusSample[]>

export function UptimePage() {
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([])
  const [history, setHistory] = useState<HistoryStore>({})
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const next = await collectMonitors()
      const timestamp = Date.now()
      setMonitors(next)
      setSelectedId(current => current && next.some(monitor => monitor.id === current) ? current : next[0]?.id ?? '')
      setHistory(previous => {
        const nextHistory = updateHistory(previous, next, timestamp)
        void window.dockerApi.preferences.set(HISTORY_KEY, nextHistory).catch(() => undefined)
        return nextHistory
      })
      setLastRefresh(new Date(timestamp))
      setError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let disposed = false
    const initialize = async () => {
      try {
        const stored = await window.dockerApi.preferences.get<HistoryStore>(HISTORY_KEY)
        if (!disposed && stored && typeof stored === 'object') setHistory(stored)
      } catch {
        // Historical samples are optional; the live runtime report remains available.
      }
      if (!disposed) await refresh()
    }

    void initialize()
    const timer = window.setInterval(() => {
      if (!disposed) void refresh()
    }, REFRESH_INTERVAL)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const summary = useMemo(() => ({
    total: monitors.length,
    up: monitors.filter(monitor => monitor.state === 'up').length,
    down: monitors.filter(monitor => monitor.state === 'down').length,
    unknown: monitors.filter(monitor => monitor.state === 'unknown').length
  }), [monitors])

  const visibleMonitors = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return monitors
    return monitors.filter(monitor => `${monitor.name} ${monitor.group} ${monitor.image} ${monitor.status}`.toLowerCase().includes(normalized))
  }, [monitors, query])

  const selected = monitors.find(monitor => monitor.id === selectedId) ?? monitors[0] ?? null
  const selectedHistory = selected
    ? history[selected.id] ?? seedHistory(selected, now)
    : []
  const uptime24 = selected ? calculateWindowUptime(selected, now, DAY) : 0
  const uptime30 = selected ? calculateWindowUptime(selected, now, DAY * 30) : 0

  return (
    <div className="page uptime-page">
      <div className="page-heading">
        <PageTitle page="uptime" title="Uptime Reports" subtitle="Runtime-derived availability for Docker containers and Compose services." />
        <div className="inline-actions">
          <span className="uptime-refresh-state"><span className="status-dot ok" /> Auto-refresh 30s</span>
          <button className="button primary" onClick={() => void refresh()} disabled={loading}>
            <AppIcon icon={RefreshIcon} />
            Refresh report
          </button>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Could not refresh uptime report">{error}</InlineAlert>}

      {loading ? <section className="card"><LoadingState label="Loading uptime report" rows={7} /></section> : (
        <>
          <div className="uptime-summary-grid">
            <SummaryCard label="Monitors" value={String(summary.total)} detail="Containers and Compose services" />
            <SummaryCard label="Up now" value={String(summary.up)} detail="Running workloads" tone="ok" />
            <SummaryCard label="Down now" value={String(summary.down)} detail="Stopped or exited workloads" tone={summary.down ? 'danger' : 'neutral'} />
            <SummaryCard label="Last check" value={lastRefresh ? lastRefresh.toLocaleTimeString() : '—'} detail="Docker runtime snapshot" />
          </div>

          <div className="uptime-report-layout">
            <aside className="card uptime-monitor-sidebar" aria-label="Uptime monitors">
              <div className="uptime-sidebar-heading">
                <div>
                  <div className="eyebrow">Monitors</div>
                  <h2>Docker workloads</h2>
                </div>
                <Badge tone={summary.down ? 'danger' : 'ok'}>{summary.up}/{summary.total} up</Badge>
              </div>
              <label className="uptime-search">
                <AppIcon icon={Search01Icon} size={15} />
                <span className="sr-only">Search monitors</span>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workloads…" />
              </label>
              <div className="uptime-monitor-list">
                {!visibleMonitors.length ? (
                  <EmptyState title="No matching monitors" text="Run containers or Compose services to populate this report." />
                ) : visibleMonitors.map(monitor => (
                  <MonitorRow
                    key={monitor.id}
                    monitor={monitor}
                    selected={monitor.id === selected?.id}
                    samples={history[monitor.id] ?? seedHistory(monitor, now)}
                    onSelect={() => setSelectedId(monitor.id)}
                  />
                ))}
              </div>
            </aside>

            <main className="uptime-report-detail">
              {selected ? (
                <MonitorReport
                  monitor={selected}
                  samples={selectedHistory}
                  now={now}
                  uptime24={uptime24}
                  uptime30={uptime30}
                />
              ) : (
                <section className="card uptime-empty-detail">
                  <AppIcon icon={Activity01Icon} size={28} />
                  <EmptyState title="Select a workload" text="Choose a container or Compose service to inspect its uptime report." />
                </section>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  )
}

async function collectMonitors(): Promise<UptimeMonitor[]> {
  const [containers, projects] = await Promise.all([
    window.dockerApi.containers.list(),
    window.dockerApi.compose.list().catch(() => [] as ComposeProject[])
  ])
  const composeGroups = await Promise.all(projects.map(async project => {
    const services = await window.dockerApi.compose.services(project).catch(() => [] as ComposeServiceInfo[])
    return services.map(service => toComposeMonitor(project, service))
  }))
  const composeMonitors = composeGroups.flat()
  const composeIds = new Set(composeMonitors.map(monitor => monitor.id.replace(/^compose:/, '').split(':').pop()))
  const containerMonitors = containers
    .filter(container => !composeIds.has(container.id))
    .map(toContainerMonitor)
  return [...containerMonitors, ...composeMonitors].sort((left, right) => left.name.localeCompare(right.name))
}

function toContainerMonitor(container: ContainerInfo): UptimeMonitor {
  const state = container.state.toLowerCase() === 'running' ? 'up' : 'down'
  return {
    id: `container:${container.id}`,
    name: container.name || container.id.slice(0, 12),
    kind: 'container',
    group: 'Docker container',
    image: container.image,
    startedAt: container.startedAt,
    state,
    health: healthFromText(container.status),
    status: container.status || container.state
  }
}

function toComposeMonitor(project: ComposeProject, service: ComposeServiceInfo): UptimeMonitor {
  const state = service.state.toLowerCase() === 'running' ? 'up' : 'down'
  return {
    id: `compose:${project.name}:${service.id || service.name}`,
    name: service.service || service.name || 'Compose service',
    kind: 'compose',
    group: `Compose · ${project.name}`,
    image: service.image,
    startedAt: service.startedAt,
    state,
    health: service.health || 'No healthcheck',
    status: service.state || 'Unknown'
  }
}

function healthFromText(value: string) {
  if (/unhealthy/i.test(value)) return 'Unhealthy'
  if (/healthy/i.test(value)) return 'Healthy'
  return 'No healthcheck'
}

function updateHistory(previous: HistoryStore, monitors: UptimeMonitor[], now: number): HistoryStore {
  const next: HistoryStore = {}
  for (const monitor of monitors) {
    const existing = previous[monitor.id]?.length ? previous[monitor.id] : seedHistory(monitor, now)
    next[monitor.id] = [...existing, { at: new Date(now).toISOString(), state: monitor.state }].slice(-HISTORY_SLOTS)
  }
  return next
}

function seedHistory(monitor: UptimeMonitor, now: number): StatusSample[] {
  const started = Date.parse(monitor.startedAt)
  return Array.from({ length: HISTORY_SLOTS }, (_, index) => {
    const at = now - (HISTORY_SLOTS - 1 - index) * (DAY / (HISTORY_SLOTS - 1))
    const state: MonitorState = Number.isFinite(started) && started <= at ? monitor.state : 'unknown'
    return { at: new Date(at).toISOString(), state }
  })
}

function calculateWindowUptime(monitor: UptimeMonitor, now: number, windowMs: number) {
  if (monitor.state !== 'up') return 0
  const started = Date.parse(monitor.startedAt)
  if (!Number.isFinite(started)) return 0
  const windowStart = now - windowMs
  return Math.min(100, Math.max(0, ((now - Math.max(started, windowStart)) / windowMs) * 100))
}

function SummaryCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'ok' | 'danger' }) {
  return <div className="card uptime-summary-card">
    <span>{label}</span>
    <strong className={tone}>{value}</strong>
    <small>{detail}</small>
  </div>
}

function MonitorRow({ monitor, samples, selected, onSelect }: { monitor: UptimeMonitor; samples: StatusSample[]; selected: boolean; onSelect: () => void }) {
  const percentage = monitor.state === 'up' ? 'UP' : monitor.state === 'down' ? 'DOWN' : 'UNKNOWN'
  return <button className={`uptime-monitor-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <div className="uptime-monitor-row-heading">
      <Badge tone={monitor.state === 'up' ? 'ok' : monitor.state === 'down' ? 'danger' : 'neutral'}>{percentage}</Badge>
      <strong>{monitor.name}</strong>
    </div>
    <small>{monitor.group}</small>
    <HistoryBars samples={samples} compact />
  </button>
}

function MonitorReport({ monitor, samples, now, uptime24, uptime30 }: { monitor: UptimeMonitor; samples: StatusSample[]; now: number; uptime24: number; uptime30: number }) {
  return <>
    <section className="card uptime-report-card">
      <div className="uptime-report-heading">
        <div>
          <div className="eyebrow">{monitor.group}</div>
          <h2>{monitor.name}</h2>
          <p>{monitor.image || monitor.status}</p>
        </div>
        <Badge tone={monitor.state === 'up' ? 'ok' : 'danger'}>{monitor.state === 'up' ? 'Up' : 'Down'}</Badge>
      </div>
      <div className="uptime-history-panel">
        <HistoryBars samples={samples} />
        <div className="uptime-history-caption"><span>Runtime-derived status history</span><span>Last 24 hours</span></div>
      </div>
      <div className="uptime-report-note"><span className="status-dot ok" /> Checks are derived from Docker runtime snapshots every 30 seconds.</div>
    </section>

    <section className="uptime-detail-metrics">
      <Metric label="Current state" value={monitor.state === 'up' ? 'Running' : 'Stopped'} detail={monitor.health} tone={monitor.state === 'up' ? 'ok' : 'danger'} />
      <Metric label="Uptime" value={`${uptime24.toFixed(2)}%`} detail="Current 24-hour window" tone={uptime24 >= 99 ? 'ok' : 'neutral'} />
      <Metric label="Uptime" value={`${uptime30.toFixed(2)}%`} detail="Current 30-day window" tone={uptime30 >= 99 ? 'ok' : 'neutral'} />
      <Metric label="Running for" value={monitor.state === 'up' ? formatUptime(monitor.startedAt, true, now) : '—'} detail={monitor.startedAt ? `Started ${formatDateTime(monitor.startedAt)}` : 'Start time unavailable'} />
    </section>

    <section className="card uptime-chart-card">
      <div className="section-row compact">
        <div><div className="eyebrow">Availability report</div><h3>Runtime state over time</h3></div>
        <span className="muted">UP / DOWN / UNKNOWN</span>
      </div>
      <RuntimeChart samples={samples} />
    </section>
  </>
}

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'ok' | 'danger' }) {
  return <div className="card uptime-detail-metric">
    <span>{label}</span>
    <strong className={tone}>{value}</strong>
    <small>{detail}</small>
  </div>
}

function HistoryBars({ samples, compact = false }: { samples: StatusSample[]; compact?: boolean }) {
  return <div className={`uptime-bars ${compact ? 'compact' : ''}`} role="img" aria-label="Runtime status history">
    {samples.map((sample, index) => <span key={`${sample.at}-${index}`} className={`uptime-bar ${sample.state}`} title={`${formatDateTime(sample.at)} · ${sample.state}`} />)}
  </div>
}

function RuntimeChart({ samples }: { samples: StatusSample[] }) {
  const width = 760
  const height = 190
  const points = samples.map((sample, index) => {
    const x = samples.length <= 1 ? width / 2 : (index / (samples.length - 1)) * width
    const y = sample.state === 'up' ? 36 : sample.state === 'down' ? 150 : 94
    return `${x},${y}`
  }).join(' ')
  return <div className="uptime-runtime-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Runtime state chart" preserveAspectRatio="none">
      {[36, 94, 150].map(y => <line key={y} x1="0" x2={width} y1={y} y2={y} className="uptime-chart-gridline" />)}
      <polyline points={points} className="uptime-chart-line" />
      <text x="8" y="28" className="uptime-chart-label">UP</text>
      <text x="8" y="88" className="uptime-chart-label">UNKNOWN</text>
      <text x="8" y="144" className="uptime-chart-label">DOWN</text>
    </svg>
    <div className="uptime-chart-axis"><span>{samples[0] ? formatDateTime(samples[0].at) : '—'}</span><span>Now</span></div>
  </div>
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
