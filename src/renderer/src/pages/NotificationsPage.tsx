import { useEffect, useMemo, useState } from 'react'
import type { MonitoringSettings, OperationalHealth, OperationalNotification } from '../../../shared/contracts'
import { Badge, EmptyState, Switch } from '../components/ui'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { PageTitle } from '../components/PageTitle'

export function NotificationsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [items, setItems] = useState<OperationalNotification[]>([])
  const [health, setHealth] = useState<OperationalHealth | null>(null)
  const [settings, setSettings] = useState<MonitoringSettings | null>(null)
  const [severity, setSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const load = async () => {
    const [notifications, nextHealth, nextSettings] = await Promise.all([
      window.dockerApi.monitoring.notifications(),
      window.dockerApi.monitoring.health(),
      window.dockerApi.monitoring.settings()
    ])
    setItems(notifications)
    setHealth(nextHealth)
    setSettings(nextSettings)
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 15_000)
    return () => clearInterval(timer)
  }, [])

  const severityItems = useMemo(
    () => severity === 'all' ? items : items.filter(item => item.severity === severity),
    [items, severity]
  )
  const list = usePaginatedSearch(
    severityItems,
    item => `${item.title} ${item.message} ${item.severity} ${item.source} ${item.resourceName ?? ''} ${item.createdAt}`,
    { pageSize: 10 }
  )

  const save = async (patch: Partial<MonitoringSettings>) => {
    if (!settings) return
    setSettings(await window.dockerApi.monitoring.saveSettings({ ...settings, ...patch }))
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle page="notifications" title="Operational Intelligence" subtitle="Health changes, exits, restart loops and Docker storage pressure." />
        <div className="inline-actions">
          <button className="button secondary" onClick={async () => { await window.dockerApi.monitoring.refresh(); await load() }}>Refresh now</button>
          <button className="button secondary" onClick={async () => { await window.dockerApi.monitoring.markRead(items.map(item => item.id)); await load() }}>Mark all read</button>
          <button className="button danger" onClick={async () => { if (window.confirm('Clear notification history?')) { await window.dockerApi.monitoring.clear(); await load() } }}>Clear</button>
        </div>
      </div>

      {health && <div className="metric-grid">
        <Metric label="Docker" value={health.dockerReachable ? 'Running' : 'Unavailable'} tone={health.dockerReachable ? 'ok' : 'danger'} />
        <Metric label="Running" value={String(health.runningContainers)} />
        <Metric label="Unhealthy" value={String(health.unhealthyContainers)} tone={health.unhealthyContainers ? 'danger' : 'ok'} />
        <Metric label="VHDX" value={health.vhdxSize} />
      </div>}

      {settings && <section className="card" style={{ marginBottom: 16 }}>
        <div className="section-row">
          <div><div className="eyebrow">Monitoring</div><h2>Alert policy</h2></div>
          <Badge tone={settings.enabled ? 'ok' : 'neutral'}>{settings.enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        <div className="settings-grid">
          <Toggle label="Background monitoring" checked={settings.enabled} onChange={value => save({ enabled: value })} />
          <Toggle label="Windows notifications" checked={settings.nativeNotifications} onChange={value => save({ nativeNotifications: value })} />
          <Toggle label="Unhealthy containers" checked={settings.unhealthyAlerts} onChange={value => save({ unhealthyAlerts: value })} />
          <Toggle label="Unexpected exits" checked={settings.unexpectedExitAlerts} onChange={value => save({ unexpectedExitAlerts: value })} />
          <Toggle label="Restart loops" checked={settings.restartLoopAlerts} onChange={value => save({ restartLoopAlerts: value })} />
          <Toggle label="Storage warnings" checked={settings.storageAlerts} onChange={value => save({ storageAlerts: value })} />
          <Toggle label="Build cache warnings" checked={settings.buildCacheAlerts} onChange={value => save({ buildCacheAlerts: value })} />
          <Field label="VHDX warning (GB)" value={settings.vhdxWarningGb} onChange={value => save({ vhdxWarningGb: value })} />
          <Field label="Build cache warning (GB)" value={settings.buildCacheWarningGb} onChange={value => save({ buildCacheWarningGb: value })} />
          <Field label="Poll interval (sec)" value={settings.pollIntervalSeconds} onChange={value => save({ pollIntervalSeconds: value })} />
        </div>
      </section>}

      <section className="card">
        <div className="section-row">
          <div><div className="eyebrow">Notification center</div><h2>Recent activity</h2></div>
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
          placeholder="Search notifications…"
        />

        {!list.pageItems.length ? <EmptyState title="No operational notifications" text="Docker health and storage alerts will appear here." /> :
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
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'danger' }) {
  return <div className="metric card"><span>{label}</span><strong>{value}</strong>{tone !== 'neutral' && <Badge tone={tone}>{tone === 'ok' ? 'Healthy' : 'Attention'}</Badge>}</div>
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="setting-toggle"><Switch checked={checked} onChange={onChange} label={label} /></div>
}
function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="setting-field"><span>{label}</span><input type="number" min="1" value={value} onChange={event => onChange(Number(event.target.value))} /></label>
}
