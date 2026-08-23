import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  ResourceDependencyGraph,
  ResourceGraphEdge,
  ResourceGraphNode,
  ResourceGraphNodeKind
} from '../../../shared/contracts'
import type { PageId } from '../navigation'
import { Badge, EmptyState, InlineAlert, LoadingState, Switch } from '../components/ui'
import { PageTitle } from '../components/PageTitle'
import { AppIcon } from '../components/Icon'
import {
  ContainerIcon,
  Database01Icon,
  Globe02Icon,
  Image01Icon,
  Layers01Icon,
  RefreshIcon
} from '@hugeicons/core-free-icons'

type GraphFilter = 'all' | ResourceGraphNodeKind

type LayoutNode = ResourceGraphNode & {
  x: number
  y: number
  width: number
  height: number
}

const emptyGraph: ResourceDependencyGraph = {
  nodes: [],
  edges: [],
  summary: {
    composeProjects: 0,
    services: 0,
    containers: 0,
    images: 0,
    volumes: 0,
    networks: 0,
    ports: 0,
    sharedResources: 0
  }
}

const columns: Record<ResourceGraphNodeKind, number> = {
  'compose-project': 70,
  'compose-service': 320,
  container: 570,
  image: 850,
  volume: 1080,
  network: 1310,
  port: 1540
}

export function ResourceGraphPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [graph, setGraph] = useState<ResourceDependencyGraph>(emptyGraph)
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GraphFilter>('all')
  const [focusNeighborhood, setFocusNeighborhood] = useState(false)
  const [showEdgeLabels, setShowEdgeLabels] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const next = await window.dockerApi.graph.dependencies()
      setGraph(next)
      setSelectedId(current => current && next.nodes.some(node => node.id === current) ? current : '')
    } catch (value) {
      setGraph(emptyGraph)
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const selected = graph.nodes.find(node => node.id === selectedId) ?? null

  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const ids = new Set<string>([selectedId])
    for (const edge of graph.edges) {
      if (edge.source === selectedId) ids.add(edge.target)
      if (edge.target === selectedId) ids.add(edge.source)
    }
    return ids
  }, [graph.edges, selectedId])

  const queryIds = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return new Set<string>()
    const direct = graph.nodes.filter(node =>
      [
        node.label,
        node.subtitle,
        node.kind,
        node.resourceId,
        node.resourceName,
        node.parentProject,
        node.parentService,
        ...Object.entries(node.metadata).flatMap(([key, value]) => [key, value])
      ].join(' ').toLowerCase().includes(normalized)
    )
    const ids = new Set(direct.map(node => node.id))
    for (const node of direct) {
      for (const edge of graph.edges) {
        if (edge.source === node.id) ids.add(edge.target)
        if (edge.target === node.id) ids.add(edge.source)
      }
    }
    return ids
  }, [graph.nodes, graph.edges, query])

  const visibleNodes = useMemo(() => graph.nodes.filter(node => {
    if (filter !== 'all' && node.kind !== filter) {
      const connectedToFiltered = graph.edges.some(edge => {
        if (edge.source === node.id) return graph.nodes.find(item => item.id === edge.target)?.kind === filter
        if (edge.target === node.id) return graph.nodes.find(item => item.id === edge.source)?.kind === filter
        return false
      })
      if (!connectedToFiltered) return false
    }
    if (focusNeighborhood && selectedId && !relatedIds.has(node.id)) return false
    if (query.trim() && !queryIds.has(node.id)) return false
    return true
  }), [graph.nodes, graph.edges, filter, focusNeighborhood, selectedId, relatedIds, query, queryIds])

  const visibleIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () => graph.edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [graph.edges, visibleIds]
  )
  const layout = useMemo(() => layoutGraph(visibleNodes), [visibleNodes])
  const layoutMap = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout.nodes])

  const openResource = (node: ResourceGraphNode) => {
    if (node.kind === 'compose-project' || node.kind === 'compose-service') {
      const project = node.kind === 'compose-project' ? node.resourceName : node.parentProject
      if (!project) return
      sessionStorage.setItem('dsm.m08.intent', JSON.stringify({ page: 'compose', resourceName: project }))
      onNavigate('compose')
      return
    }

    if (node.kind === 'container') {
      sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
        page: 'containers',
        resourceId: node.resourceId,
        resourceName: node.resourceName
      }))
      onNavigate('containers')
      return
    }

    if (node.kind === 'image') {
      sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
        page: 'images',
        resourceId: node.resourceId,
        resourceName: node.resourceName
      }))
      onNavigate('images')
      return
    }

    if (node.kind === 'volume') {
      sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
        page: 'volumes',
        resourceName: node.resourceName
      }))
      onNavigate('volumes')
      return
    }

    if (node.kind === 'network') {
      sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
        page: 'networks',
        resourceId: node.resourceId,
        resourceName: node.resourceName
      }))
      onNavigate('networks')
      return
    }

    if (node.kind === 'port') {
      onNavigate('ports')
    }
  }

  return (
    <div className="page resource-graph-page">
      <div className="page-heading">
        <PageTitle
          page="resource-graph"
          title="Resource Dependency Graph"
          subtitle="Compose ownership and Docker relationships across containers, images, volumes, networks and published ports."
        />
        <button className="button secondary" onClick={load}>
          <AppIcon icon={RefreshIcon} />
          Refresh
        </button>
      </div>

      {error && <InlineAlert tone="danger" title="Could not build Docker dependency graph">{error}</InlineAlert>}

      <section className="resource-graph-summary">
        <Summary label="Compose" value={graph.summary.composeProjects} />
        <Summary label="Services" value={graph.summary.services} />
        <Summary label="Containers" value={graph.summary.containers} />
        <Summary label="Images" value={graph.summary.images} />
        <Summary label="Volumes" value={graph.summary.volumes} />
        <Summary label="Networks" value={graph.summary.networks} />
        <Summary label="Ports" value={graph.summary.ports} />
        <Summary label="Shared resources" value={graph.summary.sharedResources} accent={graph.summary.sharedResources > 0} />
      </section>

      <section className="card resource-graph-shell">
        <div className="resource-graph-toolbar">
          <label className="resource-graph-search">
            <span>Search graph</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Container, Compose, image, volume, network, port…"
            />
          </label>

          <label>
            <span>Resource type</span>
            <select className="select" value={filter} onChange={event => setFilter(event.target.value as GraphFilter)}>
              <option value="all">All resources</option>
              <option value="compose-project">Compose projects</option>
              <option value="compose-service">Compose services</option>
              <option value="container">Containers</option>
              <option value="image">Images</option>
              <option value="volume">Volumes</option>
              <option value="network">Networks</option>
              <option value="port">Published ports</option>
            </select>
          </label>

          <Switch
            checked={focusNeighborhood}
            onChange={setFocusNeighborhood}
            label="Focus selected neighborhood"
            disabled={!selectedId}
            compact
          />
          <Switch checked={showEdgeLabels} onChange={setShowEdgeLabels} label="Edge labels" compact />

          {(query || filter !== 'all' || focusNeighborhood) && (
            <button className="button secondary" onClick={() => {
              setQuery('')
              setFilter('all')
              setFocusNeighborhood(false)
            }}>
              Clear view
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState label="Building resource dependency graph" rows={9} />
        ) : !graph.nodes.length ? (
          <EmptyState title="No Docker dependencies" text="Create or start Docker resources and refresh the graph." />
        ) : !layout.nodes.length ? (
          <EmptyState title="No graph nodes match this view" text="Change search, resource type, or neighborhood filters." />
        ) : (
          <div className="resource-graph-scroll" aria-label="Docker resource dependency graph">
            <svg
              className="resource-graph-svg"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width={layout.width}
              height={layout.height}
              role="img"
              aria-label={`${layout.nodes.length} visible Docker resources connected by ${visibleEdges.length} dependency edges`}
            >
              <defs>
                <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" className="resource-edge-arrow" />
                </marker>
              </defs>

              <GraphColumnHeaders height={layout.height} />

              <g className="resource-graph-edges">
                {visibleEdges.map(edge => {
                  const source = layoutMap.get(edge.source)
                  const target = layoutMap.get(edge.target)
                  if (!source || !target) return null
                  return <GraphEdge key={edge.id} edge={edge} source={source} target={target} showLabel={showEdgeLabels} />
                })}
              </g>

              <g className="resource-graph-nodes">
                {layout.nodes.map(node => (
                  <GraphNode
                    key={node.id}
                    node={node}
                    selected={node.id === selectedId}
                    shared={incomingCount(node.id, graph.edges) > 1 && isShareable(node.kind)}
                    onSelect={() => setSelectedId(current => current === node.id ? '' : node.id)}
                    onOpen={() => openResource(node)}
                  />
                ))}
              </g>
            </svg>
          </div>
        )}
      </section>

      {selected && (
        <ResourceDetail
          node={selected}
          graph={graph}
          onClose={() => {
            setSelectedId('')
            setFocusNeighborhood(false)
          }}
          onSelect={setSelectedId}
          onOpen={() => openResource(selected)}
        />
      )}

      <section className="card resource-graph-legend">
        <div className="section-row">
          <div><div className="eyebrow">Graph semantics</div><h2>Relationship model</h2></div>
        </div>
        <div className="resource-legend-grid">
          <Legend kind="compose-project" label="Compose Project" />
          <Legend kind="compose-service" label="Compose Service" />
          <Legend kind="container" label="Container" />
          <Legend kind="image" label="Image" />
          <Legend kind="volume" label="Volume" />
          <Legend kind="network" label="Network" />
          <Legend kind="port" label="Published Port" />
        </div>
        <div className="resource-edge-key">
          <span><strong>contains</strong> Project → Service</span>
          <span><strong>runs</strong> Service → Container</span>
          <span><strong>uses</strong> Container → Image</span>
          <span><strong>mounts</strong> Container → Volume</span>
          <span><strong>network</strong> Container → Network</span>
          <span><strong>publishes</strong> Container → Host Port</span>
        </div>
      </section>
    </div>
  )
}

function GraphNode({
  node,
  selected,
  shared,
  onSelect,
  onOpen
}: {
  node: LayoutNode
  selected: boolean
  shared: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const label = truncate(node.label, 24)
  const subtitle = truncate(node.subtitle, 29)
  return (
    <g
      className={`resource-node resource-node-${node.kind} ${selected ? 'selected' : ''}`}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${kindLabel(node.kind)} ${node.label}${node.state ? `, ${node.state}` : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
        if (event.key === 'Enter' && event.ctrlKey) onOpen()
      }}
    >
      <title>{`${kindLabel(node.kind)}: ${node.label}${node.subtitle ? ` — ${node.subtitle}` : ''}`}</title>
      <rect width={node.width} height={node.height} rx="10" />
      <text className="resource-node-kind" x="12" y="17">{kindLabel(node.kind)}</text>
      <text className="resource-node-label" x="12" y="37">{label}</text>
      <text className="resource-node-subtitle" x="12" y="52">{subtitle}</text>
      {node.kind === 'container' && node.state && <circle className={`resource-state-dot state-${node.state}`} cx={node.width - 14} cy="15" r="4" />}
      {shared && (
        <g transform={`translate(${node.width - 53} 7)`}>
          <rect className="resource-shared-pill" width="39" height="16" rx="8" />
          <text className="resource-shared-text" x="19.5" y="11" textAnchor="middle">shared</text>
        </g>
      )}
    </g>
  )
}

function GraphEdge({
  edge,
  source,
  target,
  showLabel
}: {
  edge: ResourceGraphEdge
  source: LayoutNode
  target: LayoutNode
  showLabel: boolean
}) {
  const sx = source.x + source.width
  const sy = source.y + source.height / 2
  const tx = target.x
  const ty = target.y + target.height / 2
  const curve = Math.max(60, (tx - sx) * .42)
  const path = `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`
  const labelX = sx + (tx - sx) / 2
  const labelY = sy + (ty - sy) / 2 - 5
  return (
    <g className={`resource-edge resource-edge-${edge.kind}`}>
      <path d={path} markerEnd="url(#graph-arrow)" />
      {showLabel && (
        <g className="resource-edge-label" transform={`translate(${labelX} ${labelY})`}>
          <rect x="-34" y="-10" width="68" height="17" rx="7" />
          <text textAnchor="middle" y="2">{truncate(edge.label, 13)}</text>
        </g>
      )}
    </g>
  )
}

function ResourceDetail({
  node,
  graph,
  onClose,
  onSelect,
  onOpen
}: {
  node: ResourceGraphNode
  graph: ResourceDependencyGraph
  onClose: () => void
  onSelect: (id: string) => void
  onOpen: () => void
}) {
  const incoming = graph.edges.filter(edge => edge.target === node.id)
  const outgoing = graph.edges.filter(edge => edge.source === node.id)
  const neighbor = (edge: ResourceGraphEdge, direction: 'incoming' | 'outgoing') =>
    graph.nodes.find(item => item.id === (direction === 'incoming' ? edge.source : edge.target))

  return (
    <section className="card resource-graph-detail">
      <div className="workspace-titlebar">
        <div className="resource-detail-title">
          <ResourceIcon kind={node.kind} />
          <div>
            <div className="eyebrow">{kindLabel(node.kind)}</div>
            <h2>{node.label}</h2>
            <p className="muted">{node.subtitle || node.resourceId}</p>
          </div>
        </div>
        <div className="inline-actions">
          {node.state && <Badge tone={node.state === 'running' ? 'ok' : 'neutral'}>{node.state}</Badge>}
          <button className="button primary" onClick={onOpen}>Open resource</button>
          <button className="icon-button" onClick={onClose} aria-label="Close resource graph details">×</button>
        </div>
      </div>

      <div className="resource-detail-body">
        <div className="resource-detail-grid">
          <DetailCard title="Incoming dependencies" count={incoming.length}>
            {incoming.length ? incoming.map(edge => {
              const related = neighbor(edge, 'incoming')
              return related && (
                <button className="resource-related-row" key={edge.id} onClick={() => onSelect(related.id)}>
                  <span><strong>{related.label}</strong><small>{kindLabel(related.kind)}</small></span>
                  <Badge tone="neutral">{edge.label}</Badge>
                </button>
              )
            }) : <span className="muted">No incoming edges.</span>}
          </DetailCard>

          <DetailCard title="Outgoing dependencies" count={outgoing.length}>
            {outgoing.length ? outgoing.map(edge => {
              const related = neighbor(edge, 'outgoing')
              return related && (
                <button className="resource-related-row" key={edge.id} onClick={() => onSelect(related.id)}>
                  <span><strong>{related.label}</strong><small>{kindLabel(related.kind)}</small></span>
                  <Badge tone="neutral">{edge.label}</Badge>
                </button>
              )
            }) : <span className="muted">No outgoing edges.</span>}
          </DetailCard>
        </div>

        <section className="resource-metadata">
          <div className="section-row compact"><div><div className="eyebrow">Metadata</div><h3>Graph evidence</h3></div></div>
          <div className="resource-metadata-grid">
            <Metadata label="Resource ID" value={node.resourceId} />
            {node.parentProject && <Metadata label="Compose project" value={node.parentProject} />}
            {node.parentService && <Metadata label="Compose service" value={node.parentService} />}
            {Object.entries(node.metadata).map(([key, value]) => value ? <Metadata key={key} label={humanize(key)} value={value} /> : null)}
          </div>
        </section>
      </div>
    </section>
  )
}

function DetailCard({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="resource-detail-card">
      <div className="section-row compact"><h3>{title}</h3><Badge tone="info">{count}</Badge></div>
      <div className="resource-related-list">{children}</div>
    </section>
  )
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="resource-metadata-item"><span>{label}</span><code className="wrap">{value}</code></div>
}

function ResourceIcon({ kind }: { kind: ResourceGraphNodeKind }) {
  const icon = kind === 'container' ? ContainerIcon
    : kind === 'image' ? Image01Icon
      : kind === 'volume' ? Database01Icon
        : kind === 'network' || kind === 'port' ? Globe02Icon
          : Layers01Icon
  return <span className={`resource-detail-icon resource-detail-icon-${kind}`}><AppIcon icon={icon} size={20} /></span>
}

function GraphColumnHeaders({ height }: { height: number }) {
  const entries: Array<[ResourceGraphNodeKind, string]> = [
    ['compose-project', 'Compose'],
    ['compose-service', 'Services'],
    ['container', 'Containers'],
    ['image', 'Images'],
    ['volume', 'Volumes'],
    ['network', 'Networks'],
    ['port', 'Ports']
  ]
  return (
    <g className="resource-column-headers">
      {entries.map(([kind, label]) => (
        <g key={kind}>
          <line x1={columns[kind] - 24} y1="55" x2={columns[kind] - 24} y2={height - 20} />
          <text x={columns[kind]} y="35">{label}</text>
        </g>
      ))}
    </g>
  )
}

function layoutGraph(nodes: ResourceGraphNode[]) {
  const width = 1790
  const nodeWidth = 190
  const nodeHeight = 62
  const top = 78
  const gap = 86
  const groups = new Map<ResourceGraphNodeKind, ResourceGraphNode[]>()
  for (const node of nodes) groups.set(node.kind, [...(groups.get(node.kind) ?? []), node])
  for (const values of groups.values()) values.sort((a, b) => a.label.localeCompare(b.label))

  const layoutNodes: LayoutNode[] = []
  let maxRows = 1
  for (const kind of Object.keys(columns) as ResourceGraphNodeKind[]) {
    const values = groups.get(kind) ?? []
    maxRows = Math.max(maxRows, values.length)
    values.forEach((node, index) => layoutNodes.push({
      ...node,
      x: columns[kind],
      y: top + index * gap,
      width: nodeWidth,
      height: nodeHeight
    }))
  }
  return { nodes: layoutNodes, width, height: Math.max(310, top + maxRows * gap + 35) }
}

function incomingCount(id: string, edges: ResourceGraphEdge[]) {
  return edges.filter(edge => edge.target === id).length
}

function isShareable(kind: ResourceGraphNodeKind) {
  return ['image', 'volume', 'network', 'port'].includes(kind)
}

function Summary({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="card resource-summary-card"><span>{label}</span><strong>{value}</strong>{accent && <Badge tone="info">Shared</Badge>}</div>
}

function Legend({ kind, label }: { kind: ResourceGraphNodeKind; label: string }) {
  return <span className={`resource-legend-item resource-legend-${kind}`}><i />{label}</span>
}

function kindLabel(kind: ResourceGraphNodeKind) {
  return ({
    'compose-project': 'Compose Project',
    'compose-service': 'Compose Service',
    container: 'Container',
    image: 'Image',
    volume: 'Volume',
    network: 'Network',
    port: 'Port'
  } as const)[kind]
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase())
}
