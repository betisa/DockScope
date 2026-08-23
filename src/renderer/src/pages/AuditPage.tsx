import { useEffect, useMemo, useState } from 'react'
import type { AuditEntry, AuditSummary, DiagnosticsBundleExportResult, RecoverySnapshot } from '../../../shared/contracts'
import { Badge, CodePanel, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { AppIcon } from '../components/Icon'
import { Delete02Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { PageTitle } from '../components/PageTitle'

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [selected, setSelected] = useState<RecoverySnapshot | null>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bundleExporting, setBundleExporting] = useState(false)
  const [bundleResult, setBundleResult] = useState<DiagnosticsBundleExportResult | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [nextEntries, nextSnapshots, nextSummary] = await Promise.all([
        window.dockerApi.audit.list(),
        window.dockerApi.audit.snapshots(),
        window.dockerApi.audit.summary()
      ])
      setEntries(nextEntries)
      setSnapshots(nextSnapshots)
      setSummary(nextSummary)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filteredEntries = useMemo(
    () => filter === 'all'
      ? entries
      : entries.filter(entry => entry.status === filter || entry.category === filter),
    [entries, filter]
  )

  const historyList = usePaginatedSearch(
    filteredEntries,
    entry => `${entry.operation} ${entry.category} ${entry.status} ${entry.severity} ${entry.commandSummary} ${entry.resourceNames.join(' ')} ${entry.completedAt}`,
    { pageSize: 10 }
  )
  const snapshotList = usePaginatedSearch(
    snapshots,
    snapshot => `${snapshot.resourceName} ${snapshot.resourceType} ${snapshot.resourceId} ${snapshot.createdAt} ${snapshot.notes.join(' ')}`,
    { pageSize: 10 }
  )

  const exportDiagnostics = async () => {
    setBundleExporting(true)
    setBundleResult(null)
    setError('')
    try {
      const result = await window.dockerApi.diagnosticsBundle.export()
      setBundleResult(result)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setBundleExporting(false)
    }
  }

  return (
    <div className="page split-page">
      <div className="content-pane">
        <div className="page-heading">
          <PageTitle page="audit" title="Audit, Cleanup History & Recovery" subtitle="Trace destructive operations and preserve recovery metadata before deletion." />
          <div className="inline-actions">
            <button className="button secondary" onClick={load}><AppIcon icon={RefreshIcon} />Refresh</button>
            <button className="button secondary" onClick={async () => {
              const result = await window.dockerApi.audit.export()
              if (result.message) window.alert(result.message + (result.path ? `\n${result.path}` : ''))
            }}>Export report</button>
            <button className="button primary" disabled={bundleExporting} onClick={() => void exportDiagnostics()}>
              {bundleExporting ? 'Generating bundle…' : 'Export diagnostics bundle'}
            </button>
            <button className="button danger" onClick={async () => {
              if (!window.confirm('Clear audit history and recovery snapshots?')) return
              await window.dockerApi.audit.clear()
              await load()
            }}><AppIcon icon={Delete02Icon} />Clear</button>
          </div>
        </div>

        {error && <InlineAlert tone="danger" title="Could not load audit history">{error}</InlineAlert>}

        <section className="card diagnostics-export-card">
          <div className="section-row">
            <div>
              <div className="eyebrow">Support diagnostics</div>
              <h2>Diagnostics Bundle Export</h2>
              <p className="muted">
                Creates a redacted ZIP containing Docker inventory, recent container diagnostics/log tails, BuildKit,
                Volume Intelligence, Resource Graph, monitoring, Task Center, Audit and recovery metadata.
              </p>
            </div>
            <Badge tone="info">Best-effort redaction</Badge>
          </div>
          <div className="diagnostics-export-notes">
            <span>Volume contents and container filesystems are never copied.</span>
            <span>Container logs are limited to a recent tail and at most 25 containers.</span>
            <span>Review the ZIP before sharing it outside a trusted support channel.</span>
          </div>
          {bundleResult && (
            <div className={`diagnostics-export-result ${bundleResult.ok ? 'ok' : 'neutral'}`} role="status">
              <div>
                <strong>{bundleResult.message}</strong>
                {bundleResult.path && <code className="wrap">{bundleResult.path}</code>}
              </div>
              {bundleResult.ok && (
                <div className="diagnostics-export-stats">
                  <span>{bundleResult.fileCount ?? 0} files</span>
                  <span>{formatBytes(bundleResult.sizeBytes ?? 0)}</span>
                  <span>{bundleResult.collectorFailures ?? 0} collector failures</span>
                </div>
              )}
            </div>
          )}
        </section>

        {summary && <div className="metric-grid">
          <Metric label="Actions" value={summary.totalActions} />
          <Metric label="Successful" value={summary.successfulActions} />
          <Metric label="Failed" value={summary.failedActions} danger={summary.failedActions > 0} />
          <Metric label="Recovery snapshots" value={summary.recoverySnapshots} />
        </div>}

        <section className="card">
          <div className="section-row">
            <div><div className="eyebrow">History</div><h2>Recorded operations</h2></div>
            <select className="select" value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter audit history">
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="cleanup">Cleanup</option>
              <option value="volume">Volumes</option>
              <option value="container">Containers</option>
              <option value="compose">Compose</option>
            </select>
          </div>

          <ListControls
            query={historyList.query} onQueryChange={historyList.setQuery}
            page={historyList.page} totalPages={historyList.totalPages} totalItems={historyList.totalItems}
            startItem={historyList.startItem} endItem={historyList.endItem}
            onPrevious={() => historyList.setPage(historyList.page - 1)}
            onNext={() => historyList.setPage(historyList.page + 1)}
            placeholder="Search audit history…"
          />

          {loading ? <LoadingState label="Loading audit history" rows={7} /> :
            !historyList.pageItems.length ? <EmptyState title="No audit entries" text="Destructive and cleanup operations will appear here." /> :
            <div className="audit-list paged-audit-list">
              {historyList.pageItems.map(entry => (
                <article className="card audit-item" key={entry.id}>
                  <div className="audit-main">
                    <div className="audit-title">
                      <strong>{entry.operation}</strong>
                      <Badge tone={entry.status === 'success' ? 'ok' : 'danger'}>{entry.status}</Badge>
                      <Badge tone={entry.severity === 'critical' ? 'danger' : entry.severity === 'warning' ? 'warn' : 'info'}>{entry.severity}</Badge>
                    </div>
                    <div className="muted">{new Date(entry.completedAt).toLocaleString()} · {entry.category} · {entry.durationMs} ms</div>
                    <div className="mono wrap audit-command">{entry.commandSummary}</div>
                    <div className="muted wrap">{entry.resourceNames.join(', ') || 'Multiple/implicit resources'}</div>
                  </div>
                  <div className="audit-actions">
                    {entry.snapshotIds.map(id => <button className="button secondary" key={id} onClick={async () => setSelected(await window.dockerApi.audit.snapshot(id))}>Recovery snapshot</button>)}
                  </div>
                </article>
              ))}
            </div>}
        </section>

        <section className="card table-card" style={{ marginTop: 16 }}>
          <div className="section-row">
            <div><div className="eyebrow">Recovery metadata</div><h2>Snapshots</h2></div>
            <Badge tone="warn">Metadata only</Badge>
          </div>

          <ListControls
            query={snapshotList.query} onQueryChange={snapshotList.setQuery}
            page={snapshotList.page} totalPages={snapshotList.totalPages} totalItems={snapshotList.totalItems}
            startItem={snapshotList.startItem} endItem={snapshotList.endItem}
            onPrevious={() => snapshotList.setPage(snapshotList.page - 1)}
            onNext={() => snapshotList.setPage(snapshotList.page + 1)}
            placeholder="Search recovery snapshots…"
          />

          {!snapshotList.pageItems.length ? <EmptyState title="No snapshots" text="Snapshots are captured automatically before supported destructive operations." /> :
            <table><thead><tr><th>Resource</th><th>Type</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>{snapshotList.pageItems.map(snapshot => <tr key={snapshot.id}>
                <td><strong>{snapshot.resourceName}</strong></td><td>{snapshot.resourceType}</td>
                <td>{new Date(snapshot.createdAt).toLocaleString()}</td>
                <td><button className="button secondary" onClick={() => setSelected(snapshot)}>View</button></td>
              </tr>)}</tbody></table>}
        </section>
      </div>

      {selected && <aside className="detail-pane">
        <div className="detail-header">
          <div><div className="eyebrow">Recovery snapshot</div><h2>{selected.resourceName}</h2></div>
          <button className="icon-button" aria-label="Close recovery snapshot" onClick={() => setSelected(null)}>×</button>
        </div>
        <div className="warning-banner"><strong>Metadata only.</strong> Volume contents and deleted image layers are not backed up by this snapshot.</div>
        <div className="detail-meta">
          <span>Type</span><strong>{selected.resourceType}</strong>
          <span>Created</span><span>{new Date(selected.createdAt).toLocaleString()}</span>
          <span>ID</span><code className="wrap">{selected.resourceId}</code>
        </div>
        <ul className="recovery-notes">{selected.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
        <CodePanel title="Recovery metadata" value={JSON.stringify(selected.data, null, 2)} />
      </aside>}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="metric card"><span>{label}</span><strong>{value}</strong>{danger && <Badge tone="danger">Attention</Badge>}</div>
}
