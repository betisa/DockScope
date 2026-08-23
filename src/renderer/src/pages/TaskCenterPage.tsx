import { useEffect, useMemo, useState } from 'react'
import type { ComposeProject, OperationTask, OperationTaskKind, OperationTaskRequest } from '../../../shared/contracts'
import type { PageId } from '../navigation'
import { Badge, EmptyState, InlineAlert, LoadingState, Switch } from '../components/ui'
import { PageTitle } from '../components/PageTitle'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'

type StatusFilter = 'all' | OperationTask['status']
type KindFilter = 'all' | OperationTaskKind

export function TaskCenterPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [tasks, setTasks] = useState<OperationTask[]>([])
  const [projects, setProjects] = useState<ComposeProject[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(Date.now())

  const [launcherKind, setLauncherKind] = useState<OperationTaskKind>('image-pull')
  const [imageRef, setImageRef] = useState('')
  const [projectName, setProjectName] = useState('')
  const [noCache, setNoCache] = useState(false)
  const [composeBuild, setComposeBuild] = useState(false)
  const [pruneAll, setPruneAll] = useState(false)
  const [keepStorageGb, setKeepStorageGb] = useState(0)
  const [includeUnusedImages, setIncludeUnusedImages] = useState(false)
  const [vhdxPath, setVhdxPath] = useState('')
  const [launching, setLaunching] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [taskRows, composeRows] = await Promise.all([
        window.dockerApi.tasks.list(),
        window.dockerApi.compose.list().catch(() => [])
      ])
      setTasks(taskRows)
      setProjects(composeRows)
      if (!projectName && composeRows[0]) setProjectName(composeRows[0].name)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const unsubscribe = window.dockerApi.tasks.onChanged(task => {
      setTasks(current => {
        const exists = current.some(item => item.id === task.id)
        const next = exists
          ? current.map(item => item.id === task.id ? task : item)
          : [task, ...current]
        return next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const filtered = useMemo(() => tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    if (kindFilter !== 'all' && task.kind !== kindFilter) return false
    return true
  }), [tasks, statusFilter, kindFilter])

  const list = usePaginatedSearch(
    filtered,
    task => `${task.title} ${task.kind} ${task.status} ${task.resourceName} ${task.resourceId} ${task.commandSummary} ${task.progressText} ${task.output}`,
    { pageSize: 10 }
  )

  const selected = tasks.find(task => task.id === selectedId) ?? null
  const counts = {
    queued: tasks.filter(task => task.status === 'queued').length,
    running: tasks.filter(task => task.status === 'running').length,
    completed: tasks.filter(task => task.status === 'completed').length,
    failed: tasks.filter(task => task.status === 'failed').length,
    cancelled: tasks.filter(task => task.status === 'cancelled').length
  }

  const enqueue = async () => {
    setLaunching(true)
    setError('')
    try {
      const request: OperationTaskRequest = {
        kind: launcherKind,
        sourcePage: 'tasks'
      }

      if (launcherKind === 'image-pull') {
        request.imageRef = imageRef.trim()
        request.resourceName = request.imageRef
      }

      if (launcherKind.startsWith('compose-')) {
        const project = projects.find(item => item.name === projectName)
        if (!project) throw new Error('Select a Compose project.')
        request.project = project
        request.resourceName = project.name
        request.noCache = noCache
        request.build = composeBuild
      }

      if (launcherKind === 'buildkit-prune') {
        request.pruneAll = pruneAll
        request.keepStorageGb = keepStorageGb
      }

      if (launcherKind === 'safe-cleanup') {
        request.includeUnusedImages = includeUnusedImages
      }

      if (launcherKind === 'vhdx-compact') {
        request.vhdxPath = vhdxPath.trim()
        request.resourceName = request.vhdxPath
      }

      const task = await window.dockerApi.tasks.enqueue(request)
      setSelectedId(task.id)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLaunching(false)
    }
  }

  const discoverVhdx = async () => {
    try {
      const info = await window.dockerApi.storage.findVhdx()
      const first = info[0]
      if (!first) throw new Error('Docker Desktop VHDX was not found.')
      setVhdxPath(first.path)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    }
  }

  const clearCompleted = async () => {
    if (!window.confirm('Clear completed, failed and cancelled task history? Running tasks will be kept.')) return
    await window.dockerApi.tasks.clearCompleted()
    setTasks(current => current.filter(task => task.status === 'queued' || task.status === 'running'))
    setSelectedId(current => tasks.find(task => task.id === current && (task.status === 'queued' || task.status === 'running')) ? current : '')
  }

  const openSource = (task: OperationTask) => {
    const page = task.sourcePage as PageId
    if (!page) return
    if (task.resourceId || task.resourceName) {
      sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
        page,
        resourceId: task.resourceId || undefined,
        resourceName: task.resourceName || undefined
      }))
    }
    onNavigate(page)
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="tasks"
          title="Operation Task Center"
          subtitle="Queued and long-running Docker operations with live output, progress, cancellation and persistent history."
        />
        <div className="inline-actions">
          <button className="button secondary" onClick={load}><AppIcon icon={RefreshIcon} />Refresh</button>
          <button className="button secondary" onClick={() => void clearCompleted()}>Clear history</button>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Task Center error">{error}</InlineAlert>}

      <section className="task-summary-grid">
        <Summary label="Queued" value={counts.queued} tone={counts.queued ? 'info' : 'neutral'} />
        <Summary label="Running" value={counts.running} tone={counts.running ? 'info' : 'neutral'} />
        <Summary label="Completed" value={counts.completed} tone={counts.completed ? 'ok' : 'neutral'} />
        <Summary label="Failed" value={counts.failed} tone={counts.failed ? 'danger' : 'neutral'} />
        <Summary label="Cancelled" value={counts.cancelled} tone={counts.cancelled ? 'warn' : 'neutral'} />
      </section>

      <section className="card task-launcher">
        <div className="section-row">
          <div>
            <div className="eyebrow">Operation launcher</div>
            <h2>Run through Task Center</h2>
            <p className="muted">Only allowlisted operations are available. Arbitrary shell commands are not accepted.</p>
          </div>
          <button className="button primary" disabled={launching} onClick={() => void enqueue()}>
            {launching ? 'Queueing…' : 'Start task'}
          </button>
        </div>

        <div className="task-launcher-grid">
          <label className="setting-row setting-column">
            <span>Operation</span>
            <select value={launcherKind} onChange={event => setLauncherKind(event.target.value as OperationTaskKind)}>
              <option value="image-pull">Image Pull</option>
              <option value="compose-pull">Compose Pull</option>
              <option value="compose-build">Compose Build</option>
              <option value="compose-up">Compose Up</option>
              <option value="buildkit-prune">BuildKit Prune</option>
              <option value="safe-cleanup">Safe / Balanced Cleanup</option>
              <option value="vhdx-compact">VHDX Compact</option>
            </select>
          </label>

          {launcherKind === 'image-pull' && (
            <label className="setting-row setting-column">
              <span>Image reference</span>
              <input value={imageRef} onChange={event => setImageRef(event.target.value)} placeholder="postgres:18 or ghcr.io/org/app:tag" />
            </label>
          )}

          {launcherKind.startsWith('compose-') && (
            <label className="setting-row setting-column">
              <span>Compose project</span>
              <select value={projectName} onChange={event => setProjectName(event.target.value)}>
                {projects.map(project => <option value={project.name} key={project.name}>{project.name}</option>)}
              </select>
            </label>
          )}

          {launcherKind === 'compose-build' && (
            <Switch checked={noCache} onChange={setNoCache} label="No cache" description="Pass --no-cache to Compose build." />
          )}

          {launcherKind === 'compose-up' && (
            <Switch checked={composeBuild} onChange={setComposeBuild} label="Build before up" description="Pass --build to Compose up." />
          )}

          {launcherKind === 'buildkit-prune' && (
            <>
              <Switch checked={pruneAll} onChange={setPruneAll} label="Prune all unused cache" description="More aggressive; future builds may rebuild layers." />
              <label className="setting-row setting-column">
                <span>Keep storage (GB)</span>
                <input type="number" min="0" max="10000" value={keepStorageGb} onChange={event => setKeepStorageGb(Number(event.target.value) || 0)} />
              </label>
            </>
          )}

          {launcherKind === 'safe-cleanup' && (
            <Switch
              checked={includeUnusedImages}
              onChange={setIncludeUnusedImages}
              label="Balanced cleanup"
              description="Also remove all unused images. Volumes remain excluded."
            />
          )}

          {launcherKind === 'vhdx-compact' && (
            <div className="task-vhdx-input">
              <label className="setting-row setting-column">
                <span>VHDX path</span>
                <input value={vhdxPath} onChange={event => setVhdxPath(event.target.value)} placeholder="docker_data.vhdx" />
              </label>
              <button className="button secondary" onClick={() => void discoverVhdx()}>Detect Docker VHDX</button>
            </div>
          )}
        </div>
      </section>

      <section className="card table-card">
        <div className="task-filter-bar">
          <label>
            <span>Status</span>
            <select className="select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            <span>Operation</span>
            <select className="select" value={kindFilter} onChange={event => setKindFilter(event.target.value as KindFilter)}>
              <option value="all">All operations</option>
              <option value="image-pull">Image Pull</option>
              <option value="compose-pull">Compose Pull</option>
              <option value="compose-build">Compose Build</option>
              <option value="compose-up">Compose Up</option>
              <option value="buildkit-prune">BuildKit Prune</option>
              <option value="safe-cleanup">Legacy Cleanup</option>
              <option value="smart-cleanup">Smart Cleanup</option>
              <option value="vhdx-compact">VHDX Compact</option>
            </select>
          </label>
        </div>

        <ListControls
          query={list.query}
          onQueryChange={list.setQuery}
          page={list.page}
          totalPages={list.totalPages}
          totalItems={list.totalItems}
          startItem={list.startItem}
          endItem={list.endItem}
          onPrevious={() => list.setPage(list.page - 1)}
          onNext={() => list.setPage(list.page + 1)}
          placeholder="Search tasks, resource names, commands or output…"
        />

        {loading ? (
          <LoadingState label="Loading operation tasks" rows={8} />
        ) : !list.pageItems.length ? (
          <EmptyState
            title={tasks.length ? 'No tasks match this view' : 'No operation tasks'}
            text={tasks.length ? 'Change search or filters.' : 'Start a long-running operation from the launcher to populate Task Center.'}
          />
        ) : (
          <div className="task-table-scroll">
            <table className="task-center-table">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Resource</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{list.pageItems.map(task => (
                <tr key={task.id} className={selectedId === task.id ? 'selected-row' : ''}>
                  <td>
                    <button className="resource-link" onClick={() => setSelectedId(task.id)}>
                      <strong>{task.title}</strong>
                      <span className="mono">{task.commandSummary}</span>
                    </button>
                  </td>
                  <td><TaskStatusBadge task={task} /></td>
                  <td>
                    <TaskProgress task={task} />
                  </td>
                  <td>
                    <div className="task-resource-cell">
                      <strong>{task.resourceName || '—'}</strong>
                      <span>{task.sourcePage || 'Task Center'}</span>
                    </div>
                  </td>
                  <td>{formatDate(task.startedAt || task.createdAt)}</td>
                  <td>{formatDuration(task, clock)}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="button secondary" onClick={() => setSelectedId(task.id)}>Output</button>
                      {task.cancellable && (task.status === 'queued' || task.status === 'running') && (
                        <button className="button danger" onClick={() => void window.dockerApi.tasks.cancel(task.id)}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="card task-detail">
          <div className="workspace-titlebar">
            <div>
              <div className="eyebrow">Task output</div>
              <h2>{selected.title}</h2>
              <p className="muted mono">{selected.commandSummary}</p>
            </div>
            <div className="inline-actions">
              <TaskStatusBadge task={selected} />
              {selected.sourcePage && selected.sourcePage !== 'tasks' && (
                <button className="button secondary" onClick={() => openSource(selected)}>Open source</button>
              )}
              {selected.cancellable && (selected.status === 'queued' || selected.status === 'running') && (
                <button className="button danger" onClick={() => void window.dockerApi.tasks.cancel(selected.id)}>Cancel</button>
              )}
              <button className="icon-button" onClick={() => setSelectedId('')} aria-label="Close task output">×</button>
            </div>
          </div>

          <div className="task-detail-grid">
            <Detail label="Task ID" value={selected.id} />
            <Detail label="Created" value={formatDate(selected.createdAt)} />
            <Detail label="Started" value={formatDate(selected.startedAt)} />
            <Detail label="Completed" value={formatDate(selected.completedAt)} />
            <Detail label="Duration" value={formatDuration(selected, clock)} />
            <Detail label="Exit code" value={selected.exitCode == null ? '—' : String(selected.exitCode)} />
          </div>

          <div className="task-output-meta">
            <span>{selected.progressText || 'No progress message'}</span>
            <span>{selected.progress == null ? 'Indeterminate' : `${Math.round(selected.progress)}%`}</span>
          </div>
          <div className="task-progress-track" aria-label="Task progress">
            <span style={{ width: `${selected.progress == null ? (selected.status === 'running' ? 35 : 0) : selected.progress}%` }} className={selected.progress == null && selected.status === 'running' ? 'indeterminate' : ''} />
          </div>

          <pre className="task-output">{selected.output || 'No process output yet.'}</pre>
        </section>
      )}
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'info' | 'ok' | 'warn' | 'danger' }) {
  return (
    <div className="metric card">
      <span>{label}</span>
      <strong>{value}</strong>
      {tone !== 'neutral' && <Badge tone={tone}>{label}</Badge>}
    </div>
  )
}

function TaskStatusBadge({ task }: { task: OperationTask }) {
  const tone = task.status === 'completed'
    ? 'ok'
    : task.status === 'failed'
      ? 'danger'
      : task.status === 'cancelled'
        ? 'warn'
        : 'info'
  return <Badge tone={tone}>{task.status.toUpperCase()}</Badge>
}

function TaskProgress({ task }: { task: OperationTask }) {
  return (
    <div className="task-progress-cell">
      <div className="task-progress-track small">
        <span
          className={task.progress == null && task.status === 'running' ? 'indeterminate' : ''}
          style={{ width: `${task.progress == null ? (task.status === 'running' ? 35 : 0) : task.progress}%` }}
        />
      </div>
      <span>{task.progressText || (task.progress == null ? 'Indeterminate' : `${Math.round(task.progress)}%`)}</span>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="diagnostic-item card"><span>{label}</span><strong className="wrap">{value || '—'}</strong></div>
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatDuration(task: OperationTask, now: number) {
  const start = Date.parse(task.startedAt || task.createdAt)
  const end = task.completedAt ? Date.parse(task.completedAt) : task.status === 'running' ? now : start
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—'
  const milliseconds = Math.max(0, end - start)
  if (milliseconds < 1000) return `${milliseconds}ms`
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (minutes < 60) return `${minutes}m ${remaining}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
