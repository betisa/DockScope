import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  BuildHistoryRecord,
  ContainerInfo,
  ComposeServiceInfo,
  DiskUsage,
  EngineStatus,
  OperationalNotification,
  StorageTrendSeries,
  VolumeIntelligence
} from '../../../shared/contracts'
import type { PageId } from '../App'
import { Badge, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { ContainerStateChart, StorageUsageChart } from '../components/DashboardCharts'
import { StorageTrendCharts, formatBytes } from '../components/StorageTrendCharts'
import { AppIcon } from '../components/Icon'
import {
  Alert02Icon,
  CleanIcon,
  ContainerIcon,
  Database01Icon,
  HardDriveIcon,
  Layers01Icon,
  Notification03Icon,
  RefreshIcon,
  Settings01Icon
} from '@hugeicons/core-free-icons'
import { PageTitle } from '../components/PageTitle'
import { DashboardCustomizer } from '../components/DashboardCustomizer'
import { OperationalIntelligenceDrawer } from '../components/OperationalIntelligenceDrawer'
import { formatUptime } from '../../../shared/formatting'
import {
  DEFAULT_DASHBOARD_LAYOUT,
  loadDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  type DashboardLayout,
  type DashboardWidgetId
} from '../dashboardCustomization'

const emptyStorageTrend: StorageTrendSeries = {
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

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [usage, setUsage] = useState<DiskUsage[]>([])
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [composeServices, setComposeServices] = useState<DashboardComposeService[]>([])
  const [builds, setBuilds] = useState<BuildHistoryRecord[]>([])
  const [volumes, setVolumes] = useState<VolumeIntelligence[]>([])
  const [alerts, setAlerts] = useState<OperationalNotification[]>([])
  const [storageTrends, setStorageTrends] = useState<StorageTrendSeries>(emptyStorageTrend)
  const [layout, setLayout] = useState<DashboardLayout>(() => ({ ...DEFAULT_DASHBOARD_LAYOUT, order:[...DEFAULT_DASHBOARD_LAYOUT.order], hidden:[] }))
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [intelligenceOpen, setIntelligenceOpen] = useState(false)
  const [dragged, setDragged] = useState<DashboardWidgetId | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const closeCustomizer = useCallback(() => setCustomizerOpen(false), [])

  const updateLayout = (next: DashboardLayout) => {
    setLayout(next)
    void saveDashboardLayout(next)
  }

  const loadComposeUptime = async () => {
    try {
      const projects = await window.dockerApi.compose.list()
      const groupedServices = await Promise.all(projects.map(async project => {
        const services = await window.dockerApi.compose.services(project).catch(() => [])
        return services.map(service => ({ ...service, projectName: project.name }))
      }))
      setComposeServices(groupedServices.flat())
    } catch {
      setComposeServices([])
    }
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const status = await window.dockerApi.engine.status()
      setEngine(status)

      if (!status.reachable) {
        setUsage([])
        setContainers([])
        setBuilds([])
        setVolumes([])
        setAlerts([])
        setStorageTrends(emptyStorageTrend)
        setComposeServices([])
        return
      }

      const [diskUsage, containerRows, trendSeries, buildRows, volumeRows, notificationRows] = await Promise.all([
        window.dockerApi.disk.usage(),
        window.dockerApi.containers.list(),
        window.dockerApi.storage.trends('24h').catch(() => emptyStorageTrend),
        window.dockerApi.buildkit.history().catch(() => []),
        window.dockerApi.volumes.intelligence().catch(() => []),
        window.dockerApi.monitoring.notifications().catch(() => [])
      ])
      setUsage(diskUsage)
      setContainers(containerRows)
      setStorageTrends(trendSeries)
      setBuilds(buildRows)
      setVolumes(volumeRows)
      setAlerts(notificationRows)
      void loadComposeUptime()
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDashboardLayout().then(setLayout) }, [])

  useEffect(() => { void load() }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const containerSummary = useMemo(() => {
    const running = containers.filter(container => container.state.toLowerCase() === 'running').length
    const unhealthy = containers.filter(container => /unhealthy/i.test(container.status)).length
    const stopped = containers.length - running
    return { running, unhealthy, stopped }
  }, [containers])

  const diagnosticContainers = useMemo(
    () => containers
      .map(container => ({ container, issue: classifyContainerIssue(container) }))
      .filter((row): row is { container: ContainerInfo; issue: ContainerIssue } => Boolean(row.issue))
      .sort((left, right) => issueRank(left.issue) - issueRank(right.issue))
      .slice(0, 6),
    [containers]
  )

  const recentBuilds = useMemo(
    () => [...builds]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 6),
    [builds]
  )

  const topVolumes = useMemo(
    () => [...volumes]
      .sort((left, right) => parseHumanBytes(right.size) - parseHumanBytes(left.size))
      .slice(0, 6),
    [volumes]
  )

  const recentAlerts = useMemo(
    () => [...alerts]
      .filter(alert => alert.severity === 'warning' || alert.severity === 'critical')
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 6),
    [alerts]
  )
  const unreadAlerts = alerts.filter(alert => !alert.read).length

  const storageSummary = useMemo(() => {
    const allocatedBytes = usage.reduce((total, item) => total + parseHumanBytes(item.size), 0)
    const reclaimableBytes = usage.reduce((total, item) => total + parseHumanBytes(item.reclaimable), 0)
    return { allocatedBytes, reclaimableBytes }
  }, [usage])

  const uptimeEntries = useMemo(() => {
    const composeIds = new Set(composeServices.map(service => service.id).filter(Boolean))
    const containerEntries: UptimeEntry[] = containers
      .filter(container => !composeIds.has(container.id) && container.state.toLowerCase() === 'running' && Number.isFinite(Date.parse(container.startedAt)))
      .map(container => ({
        id: `container:${container.id}`,
        name: container.name,
        source: 'Container',
        detail: container.image,
        startedAt: container.startedAt,
        target: 'containers' as PageId
      }))
    const composeEntries: UptimeEntry[] = composeServices
      .filter(service => service.state.toLowerCase() === 'running' && Number.isFinite(Date.parse(service.startedAt)))
      .map(service => ({
        id: `compose:${service.projectName}:${service.id}`,
        name: service.service || service.name,
        source: `Compose · ${service.projectName}`,
        detail: service.name,
        startedAt: service.startedAt,
        target: 'compose' as PageId
      }))

    return [...containerEntries, ...composeEntries]
      .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
      .slice(0, 8)
  }, [containers, composeServices])

  const openContainerDiagnostics = (container: ContainerInfo) => {
    sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
      page:'containers',
      resourceId:container.id,
      resourceName:container.name,
      tab:'advisor',
      source:'dashboard-container-diagnostics',
      createdAt:Date.now()
    }))
    onNavigate('containers')
  }

  const reorder = (source: DashboardWidgetId, target: DashboardWidgetId) => {
    if (source === target) return
    const order = [...layout.order]
    const sourceIndex = order.indexOf(source)
    const targetIndex = order.indexOf(target)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [item] = order.splice(sourceIndex, 1)
    order.splice(targetIndex, 0, item)
    updateLayout({ ...layout, order })
  }

  const widgets: Record<DashboardWidgetId, ReactNode> = {
    runtime: (
      <section className="card dashboard-runtime-widget">
        <div className="section-row">
          <div><div className="eyebrow">Control room</div><h2>Runtime at a glance</h2></div>
          <Badge tone={diagnosticContainers.length ? 'warn' : 'ok'}>{diagnosticContainers.length ? `${diagnosticContainers.length} need attention` : 'All clear'}</Badge>
        </div>
        <div className="metric-grid">
          <Metric label="Engine" value={engine?.reachable ? 'Running' : loading ? 'Checking…' : 'Unavailable'} tone={engine?.reachable ? 'ok' : 'danger'} />
          <Metric label="Running workloads" value={String(containerSummary.running)} detail={`${uptimeEntries.length} with uptime`} />
          <Metric label="Needs attention" value={String(diagnosticContainers.length)} tone={diagnosticContainers.length ? 'danger' : 'ok'} detail="Unhealthy or failed" />
          <Metric label="Docker storage" value={formatBytes(storageSummary.allocatedBytes)} detail={`${formatBytes(storageSummary.reclaimableBytes)} reclaimable`} />
        </div>
        <div className="dashboard-runtime-meta">
          <span>Docker {engine?.serverVersion || '—'}</span>
          <span>Compose {engine?.composeVersion || '—'}</span>
          <span>Context {engine?.context || '—'}</span>
        </div>
      </section>
    ),

    uptime: (
      <DashboardListWidget
        eyebrow="Runtime uptime"
        title="Running workloads"
        actionLabel="Open Containers"
        actionIcon={ContainerIcon}
        onAction={() => onNavigate('containers')}
        emptyTitle="No running workload uptime"
        emptyText="Running containers and Compose services with Docker start timestamps will appear here."
      >
        {uptimeEntries.map(entry => (
          <button className="dashboard-list-row" key={entry.id} onClick={() => onNavigate(entry.target)}>
            <span>
              <strong>{entry.name || 'Unnamed workload'}</strong>
              <small>{entry.source} · {entry.detail || 'Runtime metadata'}</small>
            </span>
            <span className="dashboard-list-value">
              <strong>{formatUptime(entry.startedAt, true, now)}</strong>
              <Badge tone="ok">Running</Badge>
            </span>
          </button>
        ))}
      </DashboardListWidget>
    ),

    'storage-chart': (
      <div className="card dashboard-chart-card">
        {usage.length ? (
          <StorageUsageChart usage={usage} />
        ) : (
          <EmptyState title="No storage data" text="Docker did not return disk-usage information." />
        )}
      </div>
    ),

    'storage-trend': (
      <section className="dashboard-trend-widget">
        <div className="card dashboard-trend-heading">
          <div className="section-row">
            <div><div className="eyebrow">Capacity planning</div><h2>Storage trends</h2><p className="muted">Use the trend to spot growth before it becomes a cleanup incident.</p></div>
            <DashboardIconLink label="Open Storage Trends" icon={HardDriveIcon} onClick={() => onNavigate('storage')} />
          </div>
        </div>
        <StorageTrendCharts series={storageTrends} />
      </section>
    ),

    'container-states': (
      <div className="card dashboard-chart-card">
        <ContainerStateChart containers={containers} />
        <div className="chart-summary-strip">
          <button onClick={() => onNavigate('containers')}><span>Running</span><strong>{containerSummary.running}</strong></button>
          <button onClick={() => onNavigate('containers')}><span>Stopped</span><strong>{containerSummary.stopped}</strong></button>
          <button onClick={() => setIntelligenceOpen(true)}><span>Needs attention</span><strong>{diagnosticContainers.length}</strong></button>
        </div>
      </div>
    ),

    'storage-details': (
      <section className="card">
        <div className="section-row">
          <div><div className="eyebrow">Storage details</div><h2>Docker disk usage</h2></div>
          <DashboardIconLink
            label="Open Cleanup Advisor"
            icon={CleanIcon}
            onClick={() => onNavigate('cleanup')}
          />
        </div>
        {!usage.length ? (
          <EmptyState title="No storage data" text="Start Docker Desktop and refresh the dashboard." />
        ) : (
          <div className="usage-grid">
            {usage.map(item => (
              <div className="usage-card" key={item.type}>
                <div className="usage-title">{item.type}</div>
                <div className="usage-size">{item.size}</div>
                <div className="muted">{item.active}/{item.totalCount} active</div>
                <div className="reclaim">Reclaimable {item.reclaimable}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    ),

    unhealthy: (
      <DashboardListWidget
        eyebrow="Container diagnostics"
        title="Problem containers"
        actionLabel="Open Containers"
        actionIcon={ContainerIcon}
        onAction={() => onNavigate('containers')}
        emptyTitle="No current container failures"
        emptyText="No unhealthy, restarting, dead, or non-zero exited containers were detected from the current Docker status metadata."
      >
        {diagnosticContainers.map(({ container, issue }) => (
          <button className="dashboard-list-row" key={container.id} onClick={() => openContainerDiagnostics(container)}>
            <span>
              <strong>{container.name}</strong>
              <small>{container.image} · {container.status || container.state}</small>
            </span>
            <Badge tone={issue.tone}>{issue.label}</Badge>
          </button>
        ))}
      </DashboardListWidget>
    ),

    'recent-builds': (
      <DashboardListWidget
        eyebrow="BuildKit"
        title="Recent builds"
        actionLabel="Open BuildKit"
        actionIcon={Layers01Icon}
        onAction={() => onNavigate('buildkit')}
        emptyTitle="No Buildx history"
        emptyText="Recent Buildx records will appear here."
      >
        {recentBuilds.map(build => (
          <button className="dashboard-list-row" key={build.id} onClick={() => onNavigate('buildkit')}>
            <span><strong>{build.name || `Build ${build.id}`}</strong><small>{formatDate(build.createdAt)} · {build.duration || '—'}</small></span>
            <Badge tone={/error|failed/i.test(build.status) ? 'danger' : /completed/i.test(build.status) ? 'ok' : 'info'}>{build.status || 'Unknown'}</Badge>
          </button>
        ))}
      </DashboardListWidget>
    ),

    'top-volumes': (
      <DashboardListWidget
        eyebrow="Persistent storage"
        title="Top volumes"
        actionLabel="Open Volumes"
        actionIcon={Database01Icon}
        onAction={() => onNavigate('volumes')}
        emptyTitle="No volumes"
        emptyText="Docker volume sizes will appear here when available."
      >
        {topVolumes.map(volume => (
          <button className="dashboard-list-row" key={volume.name} onClick={() => {
            sessionStorage.setItem('dsm.m08.intent', JSON.stringify({ page:'volumes', resourceName:volume.name }))
            onNavigate('volumes')
          }}>
            <span><strong className="mono">{volume.name}</strong><small>{volume.references.length} reference(s) · {volume.workloads[0]?.label || 'Unknown workload'}</small></span>
            <span className="dashboard-list-value"><strong>{volume.size}</strong><Badge tone={volume.risk.level === 'critical' ? 'danger' : volume.risk.level === 'high' ? 'warn' : 'info'}>{volume.risk.level}</Badge></span>
          </button>
        ))}
      </DashboardListWidget>
    ),

    'recent-alerts': (
      <DashboardListWidget
        eyebrow="Operational intelligence"
        title="Recent alerts"
        actionLabel="Open Notifications"
        actionIcon={Notification03Icon}
        onAction={() => setIntelligenceOpen(true)}
        emptyTitle="No recent warnings"
        emptyText="No warning or critical operational notifications are currently recorded."
      >
        {recentAlerts.map(alert => (
          <button className="dashboard-list-row" key={alert.id} onClick={() => setIntelligenceOpen(true)}>
            <span><strong>{alert.title}</strong><small>{alert.message} · {formatDate(alert.createdAt)}</small></span>
            <Badge tone={alert.severity === 'critical' ? 'danger' : 'warn'}>{alert.severity}</Badge>
          </button>
        ))}
      </DashboardListWidget>
    ),

    'quick-actions': (
      <section className="quick-grid">
        <Quick icon={ContainerIcon} title="Containers" text="Runtime & diagnostics" onClick={() => onNavigate('containers')} />
        <Quick icon={Layers01Icon} title="Compose" text="Projects & services" onClick={() => onNavigate('compose')} />
        <Quick icon={CleanIcon} title="Cleanup" text="Safe reclaim planning" onClick={() => onNavigate('cleanup')} />
        <Quick icon={HardDriveIcon} title="Storage" text="Trends & VHDX" onClick={() => onNavigate('storage')} />
      </section>
    )
  }

  return (
    <div className={`page dashboard-customizable density-${layout.density}`}>
      <div className="page-heading">
        <PageTitle page="dashboard" title="Docker workstation overview" subtitle="Runtime health, storage growth, operational signals, and safe maintenance actions in one place." />
        <div className="inline-actions">
          <button className="dashboard-intelligence-trigger" onClick={() => setIntelligenceOpen(true)} aria-label="Open Operational Intelligence" title="Operational Intelligence">
            <AppIcon icon={Notification03Icon} />
            {unreadAlerts > 0 && <span className="dashboard-intelligence-count">{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>}
          </button>
          <button className="button secondary" onClick={() => setCustomizerOpen(true)}>
            <AppIcon icon={Settings01Icon} />
            Customize
          </button>
          <button className="button secondary" onClick={load}>
            <AppIcon icon={RefreshIcon} />
            Refresh
          </button>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Dashboard refresh failed">{error}</InlineAlert>}

      {loading ? (
        <section className="card">
          <LoadingState label="Loading dashboard metrics" rows={7} />
        </section>
      ) : engine?.reachable ? (
        <div className="dashboard-widget-layout">
          {layout.order
            .filter(id => !layout.hidden.includes(id))
            .map(id => (
              <DashboardWidget
                key={id}
                id={id}
                draggable={id !== 'runtime'}
                onDragStart={() => setDragged(id)}
                onDragEnd={() => setDragged(null)}
                onDrop={() => {
                  if (dragged) reorder(dragged, id)
                  setDragged(null)
                }}
              >
                {widgets[id]}
              </DashboardWidget>
            ))}
        </div>
      ) : (
        <>
          {widgets.runtime}
          <section className="card">
            <EmptyState title="Docker Engine unavailable" text="Start Docker Desktop, verify your Docker context, and refresh the dashboard." />
          </section>
        </>
      )}

      <DashboardCustomizer
        open={customizerOpen}
        layout={layout}
        onChange={updateLayout}
        onReset={() => {
          void resetDashboardLayout().then(setLayout)
        }}
        onClose={closeCustomizer}
      />
      {intelligenceOpen && <OperationalIntelligenceDrawer
        onClose={() => setIntelligenceOpen(false)}
        onNavigate={target => {
          setIntelligenceOpen(false)
          if (target !== 'notifications') onNavigate(target as PageId)
        }}
      />}
    </div>
  )
}

function DashboardWidget({
  id,
  children,
  draggable,
  onDragStart,
  onDragEnd,
  onDrop
}: {
  id: DashboardWidgetId
  children: ReactNode
  draggable: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
}) {
  const wide = ['runtime', 'storage-trend', 'storage-details', 'quick-actions'].includes(id)
  return (
    <div
      className={`dashboard-widget ${wide ? 'dashboard-widget-wide' : ''}`}
      draggable={draggable}
      onDragStart={event => {
        if (!draggable) return
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={event => {
        if (draggable) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={event => {
        event.preventDefault()
        onDrop()
      }}
      aria-label={`${id.replaceAll('-', ' ')} dashboard widget`}
    >
      {draggable && <div className="dashboard-drag-handle" aria-hidden="true" title="Drag to reorder">⋮⋮</div>}
      {children}
    </div>
  )
}

function DashboardListWidget({
  eyebrow,
  title,
  actionLabel,
  actionIcon,
  onAction,
  emptyTitle,
  emptyText,
  children
}: {
  eyebrow: string
  title: string
  actionLabel: string
  actionIcon: any
  onAction: () => void
  emptyTitle: string
  emptyText: string
  children: ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="card dashboard-list-widget">
      <div className="section-row">
        <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>
        <DashboardIconLink label={actionLabel} icon={actionIcon} onClick={onAction} />
      </div>
      {hasChildren ? <div className="dashboard-list">{children}</div> : <EmptyState title={emptyTitle} text={emptyText} />}
    </section>
  )
}

function Metric({ label, value, tone = 'neutral', detail }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'danger'; detail?: string }) {
  return (
    <div className="metric card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
      {tone !== 'neutral' && <Badge tone={tone}>{tone === 'ok' ? 'Healthy' : 'Attention'}</Badge>}
    </div>
  )
}

function DashboardIconLink({ label, icon, onClick }: { label:string; icon:any; onClick:() => void }) {
  return (
    <button
      className="dashboard-icon-link"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <AppIcon icon={icon} size={17} />
    </button>
  )
}

function Quick({ icon, title, text, onClick }: { icon:any; title: string; text: string; onClick: () => void }) {
  return (
    <button className="quick card dashboard-quick-link" title={title} onClick={onClick}>
      <span className="dashboard-quick-icon"><AppIcon icon={icon} size={19} /></span>
      <span className="dashboard-quick-copy">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
    </button>
  )
}

type DashboardComposeService = ComposeServiceInfo & {
  projectName: string
}

type UptimeEntry = {
  id: string
  name: string
  source: string
  detail: string
  startedAt: string
  target: PageId
}

type ContainerIssue = {
  label: 'Unhealthy' | 'Restarting' | 'Dead' | 'Exited'
  tone: 'danger' | 'warn'
  rank: number
}

function classifyContainerIssue(container: ContainerInfo): ContainerIssue | null {
  const state = String(container.state ?? '').toLowerCase()
  const status = String(container.status ?? '')

  if (/unhealthy/i.test(status)) return { label:'Unhealthy', tone:'danger', rank:0 }
  if (state === 'dead' || /\bdead\b/i.test(status)) return { label:'Dead', tone:'danger', rank:1 }
  if (state === 'restarting' || /\brestart(?:ing)?\b/i.test(status)) return { label:'Restarting', tone:'warn', rank:2 }

  const exited = status.match(/Exited\s*\(([-+]?\d+)\)/i)
  if (exited && Number(exited[1]) !== 0) return { label:'Exited', tone:'danger', rank:3 }

  return null
}

function issueRank(issue: ContainerIssue) {
  return issue.rank
}

function parseHumanBytes(value: string) {
  const match = String(value ?? '').trim().match(/([\d.]+)\s*([kmgtp]?i?b)/i)
  if (!match) return 0
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const units: Record<string, number> = {
    b:1, kb:1_000, mb:1_000_000, gb:1_000_000_000, tb:1_000_000_000_000,
    kib:1024, mib:1024 ** 2, gib:1024 ** 3, tib:1024 ** 4
  }
  return Number.isFinite(amount) ? amount * (units[unit] ?? 1) : 0
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
