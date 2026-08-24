import { useEffect, useMemo, useState } from 'react'
import type { OperationalHealth, OperationalNotification } from '../../../shared/contracts'
import { Badge, EmptyState } from './ui'
import { ListControls } from './ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'

export function OperationalIntelligencePanel({ onNavigate, compact = false }: { onNavigate: (page: string) => void; compact?: boolean }) {
  const [items, setItems] = useState<OperationalNotification[]>([])
  const [health, setHealth] = useState<OperationalHealth | null>(null)
  const [severity, setSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(30)

  const load = async () => {
    const [notifications, nextHealth, appSettings] = await Promise.all([
      window.dockerApi.monitoring.notifications(),
      window.dockerApi.monitoring.health(),
      window.dockerApi.settings.get()
    ])
    setItems(notifications)
    setHealth(nextHealth)
    setPollIntervalSeconds(appSettings.monitoring.pollIntervalSeconds)
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), Math.max(10, pollIntervalSeconds) * 1000)
    return () => window.clearInterval(timer)
  }, [pollIntervalSeconds])

  const severityItems = useMemo(
    () => severity === 'all' ? items : items.filter(item => item.severity === severity),
    [items, severity]
  )
  const list = usePaginatedSearch(
    severityItems,
    item => `${item.title} ${item.message} ${item.severity} ${item.source} ${item.resourceName ?? ''} ${item.createdAt}`,
    { pageSize: compact ? 6 : 10 }
  )

  const markAllRead = async () => {
    await window.dockerApi.monitoring.markRead(items.map(item => item.id))
    await load()
  }

  const clear = async () => {
    if (!window.confirm('Clear notification history?')) return
    await window.dockerApi.monitoring.clear()
    await load()
  }

  return <div className={`operational-intelligence-panel ${compact ? 'compact' : ''}`}>
    <div className="operational-intelligence-toolbar">
      <div>
        <div className="eyebrow">Notification center</div>
        <h2>Recent activity</h2>
        <p>Policy controls are managed from Settings.</p>
      </div>
      <div className="inline-actions">
        <button className="button secondary" onClick={() => void load()}>Refresh</button>
        <button className="button secondary" onClick={() => void markAllRead()}>Mark all read</button>
        <button className="button danger" onClick={() => void clear()}>Clear</button>
      </div>
    </div>

    {health && <div className="metric-grid operational-intelligence-metrics">
      <Metric label="Docker" value={health.dockerReachable ? 'Running' : 'Unavailable'} tone={health.dockerReachable ? 'ok' : 'danger'} />
      <Metric label="Running" value={String(health.runningContainers)} />
      <Metric label="Unhealthy" value={String(health.unhealthyContainers)} tone={health.unhealthyContainers ? 'danger' : 'ok'} />
      <Metric label="VHDX" value={health.vhdxSize} />
    </div>}

    <section className="card operational-intelligence-list-card">
      <div className="section-row">
        <div><div className="eyebrow">Operational Intelligence</div><h2>Alerts</h2></div>
        <select className="select" value={severity} onChange={event => setSeverity(event.target.value as typeof severity)} aria-label="Filter notification severity">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warnings</option>
          <option value="info">Info</option>
        </select>
      </div>
      <ListControls
        query={list.query} onQueryChange={list.setQuery}
        page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
        startItem={list.startItem} endItem={list.endItem}
        onPrevious={() => list.setPage(list.page - 1)}
        onNext={() => list.setPage(list.page + 1)}
        placeholder="Search alerts…"
      />
      {!list.pageItems.length ? <EmptyState title="No operational alerts" text="Docker health and storage alerts will appear here." /> :
        <div className="notification-list paged-notification-list">
          {list.pageItems.map(item => <article className={`card notification-item ${item.read ? 'read' : 'unread'}`} key={item.id}>
            <div className={`notification-severity severity-${item.severity}`} />
            <div className="notification-body">
              <div className="notification-title-row">
                <strong>{item.title}</strong>
                <Badge tone={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warn' : 'info'}>{item.severity}</Badge>
              </div>
              <p>{item.message}</p>
              <div className="muted">{new Date(item.createdAt).toLocaleString()} · {item.source}</div>
            </div>
            <div className="notification-actions">
              {!item.read && <button className="button secondary" onClick={async () => { await window.dockerApi.monitoring.markRead([item.id]); await load() }}>Mark read</button>}
              {item.action?.page && <button className="button primary" onClick={() => onNavigate(item.action!.page!)}>{item.action.label}</button>}
            </div>
          </article>)}
        </div>}
    </section>
  </div>
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'danger' }) {
  return <div className="metric card"><span>{label}</span><strong>{value}</strong>{tone !== 'neutral' && <Badge tone={tone}>{tone === 'ok' ? 'Healthy' : 'Attention'}</Badge>}</div>
}
