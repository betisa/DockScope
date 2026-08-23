import { useEffect, useState } from 'react'
import type { ComposeProject } from '../../../shared/contracts'
import { Badge, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { ComposeWorkspace } from '../components/ComposeWorkspace'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { PageTitle } from '../components/PageTitle'

export function ComposePage({ filter }: { filter: string }) {
  const [rows, setRows] = useState<ComposeProject[]>([])
  const [selected, setSelected] = useState<ComposeProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await window.dockerApi.compose.list()
      setRows(data)
      try {
        const raw = sessionStorage.getItem('dsm.m08.intent')
        const intent = raw ? JSON.parse(raw) : null
        if (intent?.page === 'compose' && intent.resourceName) {
          setSelected(data.find(item => item.name === intent.resourceName) ?? null)
          sessionStorage.removeItem('dsm.m08.intent')
        }
      } catch { /* ignore stale intent */ }
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const list = usePaginatedSearch(
    rows,
    project => `${project.name} ${project.status} ${project.configFiles}`,
    { pageSize: 10, initialQuery: filter }
  )

  return (
    <div className="page compose-page">
      <div className="page-heading">
        <PageTitle page="compose" title="Compose Workspace" subtitle="Project and service lifecycle, aggregated diagnostics, topology and guarded Compose editing." />
        <button className="button secondary" onClick={load}>
          <AppIcon icon={RefreshIcon} />
          Refresh projects
        </button>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load Compose projects">{error}</InlineAlert>}

      <section className="card compose-list-shell">
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
          placeholder="Search Compose projects…"
        />

        {loading ? (
          <LoadingState label="Loading Compose projects" rows={6} />
        ) : !list.pageItems.length ? (
          <EmptyState title="No Compose projects" text="Existing Docker Compose projects will appear here." />
        ) : (
          <div className="compose-project-grid paged-grid">
            {list.pageItems.map(project => (
              <button
                key={`${project.name}-${project.configFiles}`}
                className={`card compose-project-card ${selected?.name === project.name ? 'selected-project' : ''}`}
                onClick={() => setSelected(project)}
              >
                <div className="section-row compact">
                  <div><div className="eyebrow">Compose Project</div><h3>{project.name}</h3></div>
                  <Badge tone={/running/i.test(project.status) ? 'ok' : 'neutral'}>{project.status || 'unknown'}</Badge>
                </div>
                <div className="muted mono wrap">{project.configFiles}</div>
                <span className="open-workspace">Open workspace →</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && <ComposeWorkspace project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
