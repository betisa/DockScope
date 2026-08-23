import { useEffect, useMemo, useState } from 'react'
import type { PortBindingInfo, PortExplorerResult } from '../../../shared/contracts'
import type { PageId } from '../navigation'
import { Badge, EmptyState, InlineAlert, LoadingState, Switch } from '../components/ui'
import { PageTitle } from '../components/PageTitle'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { AppIcon } from '../components/Icon'
import { Globe02Icon, RefreshIcon } from '@hugeicons/core-free-icons'

const emptyResult: PortExplorerResult = {
  bindings: [],
  summary: {
    totalBindings: 0,
    publishedBindings: 0,
    runningBindings: 0,
    conflictBindings: 0,
    httpCandidates: 0,
    loopbackBindings: 0,
    allInterfaceBindings: 0
  }
}

export function PortExplorerPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [result, setResult] = useState<PortExplorerResult>(emptyResult)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [protocol, setProtocol] = useState('all')
  const [state, setState] = useState('all')
  const [exposure, setExposure] = useState('all')
  const [conflictsOnly, setConflictsOnly] = useState(false)
  const [copied, setCopied] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await window.dockerApi.ports.list())
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
      setResult(emptyResult)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => result.bindings.filter(binding => {
    if (protocol !== 'all' && binding.protocol !== protocol) return false
    if (state === 'running' && binding.containerState.toLowerCase() !== 'running') return false
    if (state === 'stopped' && binding.containerState.toLowerCase() === 'running') return false
    if (exposure !== 'all' && binding.exposure !== exposure) return false
    if (conflictsOnly && !binding.conflict) return false
    return true
  }), [result.bindings, protocol, state, exposure, conflictsOnly])

  const list = usePaginatedSearch(
    filtered,
    binding => [
      binding.containerName,
      binding.image,
      binding.containerState,
      binding.composeProject,
      binding.composeService,
      binding.hostIp,
      binding.hostPort ?? '',
      binding.containerPort,
      binding.protocol,
      binding.endpoint,
      binding.exposure,
      binding.conflictWith.join(' ')
    ].join(' '),
    { pageSize: 10 }
  )

  const openContainer = (binding: PortBindingInfo) => {
    sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
      page: 'containers',
      resourceId: binding.containerId,
      resourceName: binding.containerName,
      tab: 'ports'
    }))
    onNavigate('containers')
  }

  const openCompose = (binding: PortBindingInfo) => {
    if (!binding.composeProject) return
    sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
      page: 'compose',
      resourceName: binding.composeProject
    }))
    onNavigate('compose')
  }

  const copy = async (binding: PortBindingInfo) => {
    const value = binding.suggestedUrl || binding.endpoint
    await navigator.clipboard.writeText(value)
    setCopied(binding.id)
    window.setTimeout(() => setCopied(current => current === binding.id ? '' : current), 1400)
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="ports"
          title="Port Explorer"
          subtitle="Published Docker ports, Compose ownership, host exposure, browser endpoints and binding conflicts."
        />
        <button className="button secondary" onClick={load}>
          <AppIcon icon={RefreshIcon} />
          Refresh
        </button>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load Docker port bindings">{error}</InlineAlert>}

      <div className="metric-grid port-metric-grid">
        <Metric label="Published" value={result.summary.publishedBindings} />
        <Metric label="Running" value={result.summary.runningBindings} />
        <Metric label="HTTP candidates" value={result.summary.httpCandidates} />
        <Metric label="Conflicts" value={result.summary.conflictBindings} tone={result.summary.conflictBindings ? 'danger' : 'ok'} />
      </div>

      {result.summary.allInterfaceBindings > 0 && (
        <div className="info-banner port-exposure-banner">
          <AppIcon icon={Globe02Icon} />
          <div>
            <strong>{result.summary.allInterfaceBindings} binding(s) listen on all host interfaces.</strong>
            <span>
              Bindings on <code>0.0.0.0</code> or <code>::</code> can be reachable beyond localhost depending on host firewall and network configuration.
            </span>
          </div>
        </div>
      )}

      <section className="card table-card">
        <div className="port-filter-bar">
          <label>
            <span>Protocol</span>
            <select className="select" value={protocol} onChange={event => setProtocol(event.target.value)}>
              <option value="all">All protocols</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="sctp">SCTP</option>
            </select>
          </label>

          <label>
            <span>Container state</span>
            <select className="select" value={state} onChange={event => setState(event.target.value)}>
              <option value="all">All states</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped / inactive</option>
            </select>
          </label>

          <label>
            <span>Exposure</span>
            <select className="select" value={exposure} onChange={event => setExposure(event.target.value)}>
              <option value="all">All exposure types</option>
              <option value="all-interfaces">All IPv4 interfaces</option>
              <option value="ipv6-all">All IPv6 interfaces</option>
              <option value="loopback">Loopback only</option>
              <option value="specific-interface">Specific interface</option>
              <option value="routed">Routed / no host port</option>
            </select>
          </label>

          <Switch checked={conflictsOnly} onChange={setConflictsOnly} label="Conflicts only" compact />
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
          placeholder="Search ports, containers, services or endpoints…"
        />

        {loading ? (
          <LoadingState label="Loading Port Explorer" rows={8} />
        ) : !list.pageItems.length ? (
          <EmptyState
            title={result.bindings.length ? 'No port bindings match this view' : 'No published ports'}
            text={result.bindings.length
              ? 'Change the search or filters to inspect other Docker port bindings.'
              : 'Containers with published or routed ports will appear here.'}
          />
        ) : (
          <div className="port-table-scroll">
            <table className="port-explorer-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Container</th>
                  <th>Compose</th>
                  <th>Container Port</th>
                  <th>Protocol</th>
                  <th>Exposure</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.pageItems.map(binding => (
                  <tr key={binding.id} className={binding.conflict ? 'port-conflict-row' : ''}>
                    <td>
                      <div className="port-endpoint">
                        <strong className="mono">{binding.endpoint}</strong>
                        {binding.suggestedUrl && <span className="muted mono">{binding.suggestedUrl}</span>}
                      </div>
                    </td>
                    <td>
                      <button className="resource-link" onClick={() => openContainer(binding)}>
                        <strong>{binding.containerName || binding.containerId.slice(0, 12)}</strong>
                        <span>{binding.image}</span>
                      </button>
                    </td>
                    <td>
                      {binding.composeProject ? (
                        <button className="resource-link compact" onClick={() => openCompose(binding)}>
                          <strong>{binding.composeProject}</strong>
                          <span>{binding.composeService || 'Compose service'}</span>
                        </button>
                      ) : <span className="muted">Standalone</span>}
                    </td>
                    <td><strong>{binding.containerPort}</strong></td>
                    <td><Badge tone="neutral">{binding.protocol.toUpperCase()}</Badge></td>
                    <td><ExposureBadge binding={binding} /></td>
                    <td>
                      <div className="port-status-stack">
                        <Badge tone={binding.containerState.toLowerCase() === 'running' ? 'ok' : 'neutral'}>
                          {binding.containerState || 'unknown'}
                        </Badge>
                        {binding.conflict && (
                          <Badge tone="danger">Conflict with {binding.conflictWith.join(', ')}</Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="inline-actions port-actions">
                        <button className="button secondary" onClick={() => void copy(binding)}>
                          {copied === binding.id ? 'Copied' : 'Copy'}
                        </button>
                        {binding.canOpenInBrowser && (
                          <button
                            className="button primary"
                            onClick={() => void window.dockerApi.ports.open(binding.suggestedUrl)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card port-notes">
        <div className="section-row">
          <div>
            <div className="eyebrow">Conflict model</div>
            <h2>How Port Explorer detects collisions</h2>
          </div>
        </div>
        <div className="port-rule-grid">
          <Rule title="Protocol-aware" text="TCP and UDP bindings on the same numeric host port are treated independently." />
          <Rule title="Wildcard-aware" text="0.0.0.0 overlaps other IPv4 bindings on the same port; :: overlaps IPv6 bindings." />
          <Rule title="Running resources" text="Conflict warnings compare active/running container bindings; inactive historical bindings remain visible but do not create a live conflict alert." />
          <Rule title="Browser safety" text="Open is offered only for likely HTTP(S) TCP ports, and Main Process validates localhost or literal-IP URLs before opening the browser." />
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'ok' | 'danger' }) {
  return (
    <div className="metric card">
      <span>{label}</span>
      <strong>{value}</strong>
      {tone !== 'neutral' && <Badge tone={tone}>{tone === 'danger' ? 'Attention' : 'Healthy'}</Badge>}
    </div>
  )
}

function ExposureBadge({ binding }: { binding: PortBindingInfo }) {
  const map: Record<PortBindingInfo['exposure'], { label: string; tone: 'neutral' | 'ok' | 'warn' | 'info' }> = {
    'all-interfaces': { label: 'All IPv4', tone: 'warn' },
    'ipv6-all': { label: 'All IPv6', tone: 'warn' },
    'loopback': { label: 'Loopback', tone: 'ok' },
    'specific-interface': { label: binding.hostIp || 'Specific IP', tone: 'info' },
    'routed': { label: 'Routed', tone: 'neutral' }
  }
  const item = map[binding.exposure]
  return <Badge tone={item.tone}>{item.label}</Badge>
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="port-rule">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}
