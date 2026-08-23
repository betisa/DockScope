import { useEffect, useState } from 'react'
import type { VolumeIntelligence } from '../../../shared/contracts'
import type { PageId } from '../navigation'
import { Badge, EmptyState, InlineAlert, LoadingState, Switch } from '../components/ui'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { PageTitle } from '../components/PageTitle'
import { VolumeIntelligenceWorkspace } from '../components/VolumeIntelligenceWorkspace'

export function VolumesPage({ filter, onNavigate }: { filter: string; onNavigate: (page: PageId) => void }) {
  const [rows, setRows] = useState<VolumeIntelligence[]>([])
  const [selected, setSelected] = useState<VolumeIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [highRiskOnly, setHighRiskOnly] = useState(false)
  const [unusedOnly, setUnusedOnly] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const next = await window.dockerApi.volumes.intelligence()
      setRows(next)
      setSelected(current => current ? next.find(item => item.name === current.name) ?? null : null)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = rows.filter(volume => {
    if (highRiskOnly && volume.risk.level === 'medium') return false
    if (unusedOnly && volume.references.length > 0) return false
    return true
  })

  const list = usePaginatedSearch(
    filtered,
    volume => [
      volume.name,
      volume.driver,
      volume.scope,
      volume.size,
      volume.createdAt,
      volume.mountpoint,
      volume.references.map(reference => `${reference.containerName} ${reference.image} ${reference.composeProject} ${reference.composeService} ${reference.destination}`).join(' '),
      volume.workloads.map(workload => `${workload.label} ${workload.evidence.join(' ')}`).join(' '),
      volume.composeProjects.join(' '),
      Object.entries(volume.labels).map(([key,value]) => `${key} ${value}`).join(' '),
      volume.risk.level,
      volume.risk.deletionAssessment
    ].join(' '),
    { pageSize: 10, initialQuery: filter }
  )

  const openContainer = (containerId: string, containerName: string) => {
    sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
      page: 'containers',
      resourceId: containerId,
      resourceName: containerName,
      tab: 'mounts'
    }))
    onNavigate('containers')
  }

  const openCompose = (project: string) => {
    sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
      page: 'compose',
      resourceName: project
    }))
    onNavigate('compose')
  }

  const remove = async (volume: VolumeIntelligence) => {
    if (volume.references.length) {
      window.alert('This volume is currently referenced by one or more containers and cannot be removed from Volume Intelligence.')
      return
    }

    const typed = window.prompt(
      `Persistent data deletion.\n\nRisk: ${volume.risk.level.toUpperCase()} (${volume.risk.score}/100)\nAssessment: ${assessmentLabel(volume)}\n\nType DELETE ${volume.name} to permanently remove this volume.`
    )
    if (typed !== `DELETE ${volume.name}`) return

    await window.dockerApi.volumes.remove([volume.name])
    if (selected?.name === volume.name) setSelected(null)
    await load()
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="volumes"
          title="Volume Intelligence"
          subtitle="Persistent-data ownership, workload detection, risk scoring, backup guidance and Docker volume inventory."
        />
        <button className="button secondary" onClick={load}>
          <AppIcon icon={RefreshIcon} />
          Refresh
        </button>
      </div>

      <div className="warning-banner">
        <strong>Persistent data boundary.</strong> No volume is labeled “safe to delete.” An unused volume can still contain valuable databases, uploads, object storage, or application state.
      </div>

      {error && <InlineAlert tone="danger" title="Could not load Volume Intelligence">{error}</InlineAlert>}

      <section className="volume-summary-grid">
        <Summary label="Volumes" value={rows.length} />
        <Summary label="Referenced" value={rows.filter(item => item.references.length).length} />
        <Summary label="Database / storage" value={rows.filter(item => item.workloads.some(workload => workload.kind !== 'generic')).length} />
        <Summary label="Critical risk" value={rows.filter(item => item.risk.level === 'critical').length} danger />
      </section>

      <section className="card table-card">
        <div className="volume-intelligence-filters">
          <Switch checked={highRiskOnly} onChange={setHighRiskOnly} label="High / critical risk only" compact />
          <Switch checked={unusedOnly} onChange={setUnusedOnly} label="No current references only" compact />
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
          placeholder="Search volumes, workloads, containers, Compose projects or labels…"
        />

        {loading ? (
          <LoadingState label="Loading Volume Intelligence" rows={8} />
        ) : !list.pageItems.length ? (
          <EmptyState
            title={rows.length ? 'No volumes match this view' : 'No volumes'}
            text={rows.length ? 'Change the search or filters to inspect other volumes.' : 'Docker volumes will appear here when they exist.'}
          />
        ) : (
          <div className="volume-table-scroll">
            <table className="volume-intelligence-table">
              <thead>
                <tr>
                  <th>Volume</th>
                  <th>Size</th>
                  <th>Workload</th>
                  <th>Ownership</th>
                  <th>Created</th>
                  <th>Risk</th>
                  <th>Assessment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{list.pageItems.map(volume => (
                <tr key={volume.name} className={selected?.name === volume.name ? 'selected-row' : ''}>
                  <td>
                    <button className="resource-link" onClick={() => setSelected(volume)}>
                      <strong className="mono wrap">{volume.name}</strong>
                      <span>{volume.driver || 'unknown driver'} · {volume.scope || 'unknown scope'}</span>
                    </button>
                  </td>
                  <td><strong>{volume.size || 'Unknown'}</strong></td>
                  <td>
                    <div className="volume-workload-badges">
                      {volume.workloads.length
                        ? volume.workloads.map(workload => (
                          <Badge key={workload.kind} tone={workload.kind === 'generic' ? 'info' : 'warn'}>{workload.label}</Badge>
                        ))
                        : <span className="muted">Unknown</span>}
                    </div>
                  </td>
                  <td>
                    <div className="volume-owner-cell">
                      <strong>{volume.references.length} container{volume.references.length === 1 ? '' : 's'}</strong>
                      <span>{volume.composeProjects.length ? volume.composeProjects.join(', ') : 'No Compose ownership'}</span>
                    </div>
                  </td>
                  <td>{formatDate(volume.createdAt)}</td>
                  <td><RiskBadge volume={volume} /></td>
                  <td><AssessmentBadge volume={volume} /></td>
                  <td>
                    <div className="inline-actions">
                      <button className="button secondary" onClick={() => setSelected(volume)}>Intelligence</button>
                      {volume.references.length === 0 && (
                        <button className="button danger" onClick={() => void remove(volume)}>Remove</button>
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
        <VolumeIntelligenceWorkspace
          volume={selected}
          onClose={() => setSelected(null)}
          onOpenContainer={openContainer}
          onOpenCompose={openCompose}
        />
      )}
    </div>
  )
}

function Summary({label,value,danger=false}:{label:string;value:number;danger?:boolean}) {
  return <div className="metric card"><span>{label}</span><strong>{value}</strong>{danger && value > 0 && <Badge tone="danger">Attention</Badge>}</div>
}

function RiskBadge({volume}:{volume:VolumeIntelligence}) {
  const tone=volume.risk.level==='critical'?'danger':volume.risk.level==='high'?'warn':'info'
  return <Badge tone={tone}>{volume.risk.level.toUpperCase()} · {volume.risk.score}</Badge>
}

function AssessmentBadge({volume}:{volume:VolumeIntelligence}) {
  const value=volume.risk.deletionAssessment
  return <Badge tone={value==='blocked'?'danger':value==='high-risk'?'warn':'info'}>{assessmentLabel(volume)}</Badge>
}

function assessmentLabel(volume:VolumeIntelligence) {
  if (volume.risk.deletionAssessment==='blocked') return 'Blocked'
  if (volume.risk.deletionAssessment==='high-risk') return 'High risk'
  return 'Review required'
}

function formatDate(value:string) {
  if (!value) return '—'
  const date=new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
