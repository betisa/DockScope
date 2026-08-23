import { useEffect, useMemo, useState } from 'react'
import type { BuilderInfo, BuildCacheRecord, BuildDiagnostics, BuildHistoryRecord } from '../../../shared/contracts'
import { Badge, CodePanel, ConfirmButton, EmptyState, InlineAlert, LoadingState, Switch } from '../components/ui'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { PageTitle } from '../components/PageTitle'
import { BuildDiagnosticsModal } from '../components/BuildDiagnosticsModal'

export function BuildKitPage() {
  const [builders, setBuilders] = useState<BuilderInfo[]>([])
  const [builds, setBuilds] = useState<BuildHistoryRecord[]>([])
  const [records, setRecords] = useState<BuildCacheRecord[]>([])
  const [output, setOutput] = useState('')
  const [onlyReclaimable, setOnlyReclaimable] = useState(true)
  const [buildStatus, setBuildStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBuild, setSelectedBuild] = useState<BuildHistoryRecord | null>(null)
  const [diagnostics, setDiagnostics] = useState<BuildDiagnostics | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [builderRows, historyRows, cacheRows] = await Promise.all([
        window.dockerApi.buildkit.builders(),
        window.dockerApi.buildkit.history(),
        window.dockerApi.buildkit.diskUsage()
      ])
      setBuilders(builderRows)
      setBuilds(historyRows)
      setRecords(cacheRows)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  const openDiagnostics = async (build: BuildHistoryRecord) => {
    setSelectedBuild(build)
    setDiagnostics(null)
    setDiagnosticsError('')
    setDiagnosticsLoading(true)
    try {
      setDiagnostics(await window.dockerApi.buildkit.diagnostics(build.id || build.ref))
    } catch (value) {
      setDiagnosticsError(value instanceof Error ? value.message : String(value))
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  const reloadDiagnostics = async () => {
    if (selectedBuild) await openDiagnostics(selectedBuild)
  }

  useEffect(() => { void load() }, [])

  const statusFilteredBuilds = useMemo(
    () => buildStatus === 'all' ? builds : builds.filter(build => build.status.toLowerCase() === buildStatus.toLowerCase()),
    [builds, buildStatus]
  )
  const reclaimableRecords = useMemo(
    () => onlyReclaimable ? records.filter(record => record.reclaimable) : records,
    [records, onlyReclaimable]
  )
  const buildStatuses = useMemo(
    () => Array.from(new Set(builds.map(build => build.status).filter(Boolean))).sort(),
    [builds]
  )

  const builderList = usePaginatedSearch(
    builders,
    builder => `${builder.name} ${builder.driver} ${builder.status} ${builder.endpoint} ${builder.platforms}`,
    { pageSize: 10 }
  )
  const buildList = usePaginatedSearch(
    statusFilteredBuilds,
    build => `${build.id} ${build.ref} ${build.name} ${build.status} ${build.createdAt} ${build.completedAt} ${build.duration} ${build.cachedSteps} ${build.completedSteps} ${build.totalSteps}`,
    { pageSize: 10 }
  )
  const cacheList = usePaginatedSearch(
    reclaimableRecords,
    record => `${record.id} ${record.type} ${record.size} ${record.createdAt} ${record.lastUsedAt} ${record.description}`,
    { pageSize: 10 }
  )

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle page="buildkit" title="BuildKit & Build History" subtitle="Inspect builder instances, completed build records, cache usage and reclaimable storage." />
        <div className="inline-actions">
          <button className="button secondary" onClick={load}><AppIcon icon={RefreshIcon} />Refresh</button>
          <ConfirmButton message="Queue unused Build Cache prune in Task Center?" onConfirm={async () => {
            const task = await window.dockerApi.tasks.enqueue({ kind:'buildkit-prune', pruneAll:false, keepStorageGb:0, sourcePage:'buildkit' })
            setOutput(`Queued in Task Center: ${task.title}`)
          }}>Safe prune</ConfirmButton>
          <ConfirmButton danger message="Queue ALL unused Build Cache prune? Future builds may need to rebuild or download layers." onConfirm={async () => {
            const task = await window.dockerApi.tasks.enqueue({ kind:'buildkit-prune', pruneAll:true, keepStorageGb:0, sourcePage:'buildkit' })
            setOutput(`Queued in Task Center: ${task.title}`)
          }}>Prune all</ConfirmButton>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load BuildKit data">{error}</InlineAlert>}

      <section className="card table-card">
        <div className="section-row">
          <div><div className="eyebrow">Builders</div><h2>Buildx inventory</h2></div>
          <Badge tone={builders.length ? 'info' : 'neutral'}>{builders.length} builders/nodes</Badge>
        </div>
        <ListControls
          query={builderList.query} onQueryChange={builderList.setQuery}
          page={builderList.page} totalPages={builderList.totalPages} totalItems={builderList.totalItems}
          startItem={builderList.startItem} endItem={builderList.endItem}
          onPrevious={() => builderList.setPage(builderList.page - 1)}
          onNext={() => builderList.setPage(builderList.page + 1)}
          placeholder="Search builders…"
        />
        {loading ? <LoadingState label="Loading builders" rows={5} /> :
          !builderList.pageItems.length ? <EmptyState title="No builders found" text="Docker Buildx may not be available or Docker Desktop is not running." /> :
          <table><thead><tr><th>Name</th><th>Driver</th><th>Status</th><th>Endpoint</th><th>Platforms</th></tr></thead>
            <tbody>{builderList.pageItems.map((builder, index) => <tr key={`${builder.name}-${index}`}>
              <td><strong>{builder.name}</strong></td><td>{builder.driver || '—'}</td>
              <td><Badge tone={/running|active/i.test(builder.status) ? 'ok' : 'neutral'}>{builder.status || 'unknown'}</Badge></td>
              <td className="mono wrap">{builder.endpoint || '—'}</td><td className="wrap">{builder.platforms || '—'}</td>
            </tr>)}</tbody></table>}
      </section>

      <section className="card table-card" style={{ marginTop: 16 }}>
        <div className="section-row">
          <div><div className="eyebrow">Build records</div><h2>Build history</h2></div>
          <div className="inline-actions">
            <Badge tone={builds.length ? 'info' : 'neutral'}>{builds.length} builds</Badge>
            <select className="select" value={buildStatus} onChange={event => setBuildStatus(event.target.value)} aria-label="Filter build status">
              <option value="all">All statuses</option>
              {buildStatuses.map(status => <option value={status} key={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <ListControls
          query={buildList.query} onQueryChange={buildList.setQuery}
          page={buildList.page} totalPages={buildList.totalPages} totalItems={buildList.totalItems}
          startItem={buildList.startItem} endItem={buildList.endItem}
          onPrevious={() => buildList.setPage(buildList.page - 1)}
          onNext={() => buildList.setPage(buildList.page + 1)}
          placeholder="Search build history…"
        />
        {loading ? <LoadingState label="Loading build history" rows={6} /> :
          !buildList.pageItems.length ? <EmptyState title="No build history" text="No Buildx records match this view." /> :
          <table>
            <thead>
              <tr>
                <th>Build ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Duration</th>
                <th>Steps</th>
                <th>Cached</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>{buildList.pageItems.map((build, index) => (
              <tr key={build.ref || build.id || `${build.name}-${index}`}>
                <td>
                  <div className="mono">{shortBuildId(build)}</div>
                  {build.ref && <div className="muted mono wrap build-ref" title={build.ref}>{build.ref}</div>}
                </td>
                <td className="wrap"><strong>{displayBuildName(build)}</strong></td>
                <td><Badge tone={statusTone(build.status)}>{build.status || 'unknown'}</Badge></td>
                <td>
                  <div>{formatDate(build.createdAt)}</div>
                  {build.completedAt && <div className="muted">Completed {formatDate(build.completedAt)}</div>}
                </td>
                <td>{build.duration || '—'}</td>
                <td>{formatSteps(build.completedSteps, build.totalSteps)}</td>
                <td>{formatCached(build.cachedSteps, build.totalSteps)}</td>
                <td><button className="button primary" onClick={() => void openDiagnostics(build)}>Diagnostics</button></td>
              </tr>
            ))}</tbody>
          </table>}
      </section>

      {selectedBuild && (
        <BuildDiagnosticsModal
          build={selectedBuild}
          diagnostics={diagnostics}
          loading={diagnosticsLoading}
          error={diagnosticsError}
          onReload={() => void reloadDiagnostics()}
          onClose={() => { setSelectedBuild(null); setDiagnostics(null); setDiagnosticsError('') }}
        />
      )}

      <section className="card table-card" style={{ marginTop: 16 }}>
        <div className="section-row">
          <div><div className="eyebrow">Cache</div><h2>Build cache records</h2></div>
          <Switch checked={onlyReclaimable} onChange={setOnlyReclaimable} label="Reclaimable only" compact />
        </div>
        <ListControls
          query={cacheList.query} onQueryChange={cacheList.setQuery}
          page={cacheList.page} totalPages={cacheList.totalPages} totalItems={cacheList.totalItems}
          startItem={cacheList.startItem} endItem={cacheList.endItem}
          onPrevious={() => cacheList.setPage(cacheList.page - 1)}
          onNext={() => cacheList.setPage(cacheList.page + 1)}
          placeholder="Search build cache…"
        />
        {loading ? <LoadingState label="Loading build cache" rows={6} /> :
          !cacheList.pageItems.length ? <EmptyState title="No cache records" text="No BuildKit cache records match this view." /> :
          <table><thead><tr><th>ID</th><th>Type</th><th>Size</th><th>Last used</th><th>Usage</th><th>Shared</th><th>Reclaimable</th></tr></thead>
            <tbody>{cacheList.pageItems.map((record, index) => <tr key={record.id || `cache-${index}`}>
              <td className="mono">{(record.id || '—').slice(0, 14)}</td><td>{record.type || '—'}</td>
              <td><strong>{record.size}</strong></td><td>{record.lastUsedAt || '—'}</td><td>{record.usageCount}</td>
              <td>{record.shared ? 'Yes' : 'No'}</td><td><Badge tone={record.reclaimable ? 'warn' : 'neutral'}>{record.reclaimable ? 'Yes' : 'No'}</Badge></td>
            </tr>)}</tbody></table>}
      </section>

      {output && <CodePanel title="BuildKit operation" value={output} />}
    </div>
  )
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (/complete|success/i.test(status)) return 'ok'
  if (/error|fail|cancel/i.test(status)) return 'danger'
  if (/running|active|progress/i.test(status)) return 'warn'
  return 'neutral'
}
function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}


function shortBuildId(build: BuildHistoryRecord) {
  if (build.id) return build.id.length > 18 ? build.id.slice(-18) : build.id
  if (!build.ref) return '—'
  const parts = build.ref.split('/').filter(Boolean)
  return parts.at(-1) || build.ref
}

function displayBuildName(build: BuildHistoryRecord) {
  if (build.name.trim()) return build.name
  const id = shortBuildId(build)
  return id === '—' ? 'Unnamed build' : `Build ${id}`
}

function formatSteps(completed: number, total: number) {
  if (!total) return completed ? String(completed) : '—'
  return `${completed}/${total}`
}

function formatCached(cached: number, total: number) {
  if (!total) return cached ? String(cached) : '—'
  const percent = Math.round((cached / total) * 100)
  return `${cached}/${total} (${percent}%)`
}
