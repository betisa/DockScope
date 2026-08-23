import { useEffect, useMemo, useState } from 'react'
import type { ComposeProject, ComposeServiceInfo, ComposeServiceModel, ComposeWorkspaceModel } from '../../../shared/contracts'
import { Badge, CodePanel, ConfirmButton, EmptyState, Switch } from './ui'
import { ComposeLiveLogsPanel } from './ComposeLiveLogsPanel'
import { ComposeLiveStatsPanel } from './ComposeLiveStatsPanel'
import { ComposeEditorPanel } from './ComposeEditorPanel'
import { ListControls } from './ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'

type Tab = 'overview' | 'services' | 'logs' | 'stats' | 'topology' | 'volumes' | 'networks' | 'compose' | 'environment'
const tabs: Array<{ id: Tab; label: string }> = [
  ['overview','Overview'],['services','Services'],['logs','Logs'],['stats','Stats'],['topology','Topology'],['volumes','Volumes'],['networks','Networks'],['compose','Compose'],['environment','Environment']
].map(([id,label]) => ({ id: id as Tab, label }))

export function ComposeWorkspace({ project, onClose }: { project: ComposeProject; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [services, setServices] = useState<ComposeServiceInfo[]>([])
  const [model, setModel] = useState<ComposeWorkspaceModel | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [svc, ws] = await Promise.all([window.dockerApi.compose.services(project), window.dockerApi.compose.workspace(project)])
    setServices(svc); setModel(ws)
  }
  useEffect(() => { load() }, [project.name, project.configFiles])

  const run = async (fn: () => Promise<any>) => {
    setBusy(true)
    try {
      const r = await fn(); setOutput(r.stdout || r.stderr || 'Operation completed.'); await load()
    } finally { setBusy(false) }
  }

  const running = services.filter((x) => x.state === 'running').length
  const unhealthy = services.filter((x) => x.health === 'unhealthy').length

  return <section className="card compose-workspace">
    <div className="workspace-titlebar">
      <div><div className="eyebrow">Compose Workspace</div><h2>{project.name}</h2><p className="muted wrap">{project.configFiles}</p></div>
      <div className="inline-actions">
        <button className="button secondary" disabled={busy} onClick={async () => {
          const task = await window.dockerApi.tasks.enqueue({ kind:'compose-pull', project, sourcePage:'compose', resourceName:project.name })
          setOutput(`Queued in Task Center: ${task.title}`)
        }}>Pull</button>
        <button className="button secondary" disabled={busy} onClick={async () => {
          const task = await window.dockerApi.tasks.enqueue({ kind:'compose-build', project, noCache:false, sourcePage:'compose', resourceName:project.name })
          setOutput(`Queued in Task Center: ${task.title}`)
        }}>Build</button>
        <button className="button primary" disabled={busy} onClick={async () => {
          const task = await window.dockerApi.tasks.enqueue({ kind:'compose-up', project, build:false, sourcePage:'compose', resourceName:project.name })
          setOutput(`Queued in Task Center: ${task.title}`)
        }}>Up</button>
        <button className="button secondary" disabled={busy} onClick={async () => {
          const task = await window.dockerApi.tasks.enqueue({ kind:'compose-up', project, build:true, sourcePage:'compose', resourceName:project.name })
          setOutput(`Queued in Task Center: ${task.title}`)
        }}>Up + Build</button>
        <button className="icon-button" aria-label="Close workspace" onClick={onClose}>×</button>
      </div>
    </div>

    <div className="workspace-tabs" role="tablist">
      {tabs.map((x) => <button key={x.id} className={tab === x.id ? 'active' : ''} onClick={() => setTab(x.id)}>{x.label}</button>)}
    </div>

    <div className="workspace-body compose-workspace-body">
      {tab === 'overview' && <Overview project={project} model={model} services={services} running={running} unhealthy={unhealthy} run={run} />}
      {tab === 'services' && <Services project={project} services={services} run={run} selected={selectedServices} setSelected={setSelectedServices} />}
      {tab === 'logs' && <><ServiceFilter model={model} selected={selectedServices} setSelected={setSelectedServices} /><ComposeLiveLogsPanel project={project} services={selectedServices} /></>}
      {tab === 'stats' && <><ServiceFilter model={model} selected={selectedServices} setSelected={setSelectedServices} /><ComposeLiveStatsPanel project={project} services={selectedServices} /></>}
      {tab === 'topology' && <Topology services={model?.services ?? []} />}
      {tab === 'volumes' && <ResourceList title="Project volumes" values={model?.volumes ?? []} empty="No named volumes declared in the resolved Compose model." />}
      {tab === 'networks' && <ResourceList title="Project networks" values={model?.networks ?? []} empty="No explicit networks declared in the resolved Compose model." />}
      {tab === 'compose' && <ComposeEditorPanel project={project} onRedeployed={load} />}
      {tab === 'environment' && <Environment services={model?.services ?? []} />}
    </div>
    {output && <CodePanel title="Last Compose operation" value={output} />}
  </section>
}

function Overview({ project, model, services, running, unhealthy, run }: any) {
  return <div className="compose-overview">
    <div className="diagnostic-grid">
      <Metric title="Services" value={String(model?.services.length ?? services.length)} />
      <Metric title="Running" value={String(running)} tone="ok" />
      <Metric title="Unhealthy" value={String(unhealthy)} tone={unhealthy ? 'danger' : 'ok'} />
      <Metric title="Volumes" value={String(model?.volumes.length ?? 0)} />
      <Metric title="Networks" value={String(model?.networks.length ?? 0)} />
      <Metric title="Config files" value={String(project.configFiles.split(',').filter(Boolean).length)} />
    </div>
    <section className="card compose-actions-card">
      <div><div className="eyebrow">Project lifecycle</div><h3>Operate the full application</h3><p className="muted">Volumes are preserved by normal Down. Removing persistent data remains a separate critical action.</p></div>
      <div className="inline-actions">
        <button className="button secondary" onClick={() => run(() => window.dockerApi.compose.start(project))}>Start</button>
        <ConfirmButton message={`Stop ${project.name}?`} onConfirm={() => run(() => window.dockerApi.compose.stop(project))}>Stop</ConfirmButton>
        <button className="button secondary" onClick={() => run(() => window.dockerApi.compose.restart(project))}>Restart</button>
        <ConfirmButton danger message={`Run docker compose down for ${project.name}? Named volumes are preserved.`} onConfirm={() => run(() => window.dockerApi.compose.down(project, false))}>Down</ConfirmButton>
      </div>
    </section>
  </div>
}

function Services({ project, services, run, selected, setSelected }: { project: ComposeProject; services: ComposeServiceInfo[]; run: (fn:()=>Promise<any>)=>void; selected:string[]; setSelected:(x:string[])=>void }) {
  const list = usePaginatedSearch(
    services,
    service => `${service.service} ${service.name} ${service.image} ${service.state} ${service.health} ${service.publishers.map(p => `${p.url}:${p.publishedPort}`).join(' ')}`,
    { pageSize: 10 }
  )

  if (!services.length) return <EmptyState title="No Compose containers" text="Run Compose Up to create the project services." />

  return <div>
    <ListControls
      query={list.query} onQueryChange={list.setQuery}
      page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
      startItem={list.startItem} endItem={list.endItem}
      onPrevious={() => list.setPage(list.page - 1)}
      onNext={() => list.setPage(list.page + 1)}
      placeholder="Search Compose services…"
    />
    <div className="compose-services-grid">{list.pageItems.map((service) => {
      const checked = selected.includes(service.service)
      return <section className="card service-card" key={service.id || service.service}>
        <div className="section-row compact">
          <div>
            <div className="service-select">
              <Switch
                checked={checked}
                onChange={(value) => setSelected(value ? [...selected, service.service] : selected.filter(x => x !== service.service))}
                label={service.service}
                compact
              />
            </div>
            <div className="muted mono">{service.image || 'image resolved by Compose'}</div>
          </div>
          <Badge tone={service.state === 'running' ? (service.health === 'unhealthy' ? 'danger' : 'ok') : 'neutral'}>{service.health || service.state || 'unknown'}</Badge>
        </div>
        <div className="service-meta">
          <span>Container</span><code>{service.name || '—'}</code>
          <span>State</span><strong>{service.state || '—'}</strong>
          <span>Ports</span><span>{service.publishers.length ? service.publishers.map(p => `${p.url || '0.0.0.0'}:${p.publishedPort} → ${p.targetPort}/${p.protocol}`).join(', ') : '—'}</span>
        </div>
        <div className="inline-actions">
          {service.state === 'running'
            ? <ConfirmButton message={`Stop service ${service.service}?`} onConfirm={() => run(() => window.dockerApi.compose.serviceStop(project, service.service))}>Stop</ConfirmButton>
            : <button className="button secondary" onClick={() => run(() => window.dockerApi.compose.serviceStart(project, service.service))}>Start</button>}
          <button className="button secondary" onClick={() => run(() => window.dockerApi.compose.serviceRestart(project, service.service))}>Restart</button>
        </div>
      </section>
    })}</div>
  </div>
}

function ServiceFilter({ model, selected, setSelected }: { model: ComposeWorkspaceModel|null; selected:string[]; setSelected:(x:string[])=>void }) {
  const names = model?.services.map(x => x.name) ?? []
  return <div className="service-filter"><span className="muted">Services:</span><button className={`filter-chip ${!selected.length?'active':''}`} onClick={() => setSelected([])}>All</button>{names.map(name => <button key={name} className={`filter-chip ${selected.includes(name)?'active':''}`} onClick={() => setSelected(selected.includes(name) ? selected.filter(x=>x!==name) : [...selected,name])}>{name}</button>)}</div>
}

function Topology({ services }: { services: ComposeServiceModel[] }) {
  const list = usePaginatedSearch(
    services,
    service => `${service.name} ${service.image} ${service.dependsOn.join(' ')} ${service.networks.join(' ')} ${service.volumes.join(' ')}`,
    { pageSize: 10 }
  )
  if (!services.length) return <EmptyState title="No topology" text="The resolved Compose model contains no services." />
  return <div>
    <ListControls
      query={list.query} onQueryChange={list.setQuery}
      page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
      startItem={list.startItem} endItem={list.endItem}
      onPrevious={() => list.setPage(list.page - 1)}
      onNext={() => list.setPage(list.page + 1)}
      placeholder="Search topology…"
    />
    <div className="topology-board">{list.pageItems.map(service => <div className="topology-node card" key={service.name}>
      <div className="topology-service">{service.name}</div>
      <div className="muted mono">{service.image || 'build service'}</div>
      {service.dependsOn.length ? <div className="dependency-list"><span>depends on</span>{service.dependsOn.map(dep => <Badge key={dep} tone="info">{dep}</Badge>)}</div> : <div className="muted">No declared dependencies</div>}
    </div>)}</div>
  </div>
}

function Environment({ services }: { services: ComposeServiceModel[] }) {
  const [reveal, setReveal] = useState(false)
  const secret = (key:string) => /(password|secret|token|api[_-]?key|connection|string|credential)/i.test(key)
  const rows = services.flatMap(service =>
    Object.entries(service.environment).map(([key, value]) => ({ service: service.name, key, value }))
  )
  const list = usePaginatedSearch(
    rows,
    row => `${row.service} ${row.key} ${row.value}`,
    { pageSize: 10 }
  )

  return <div>
    <div className="section-row compact">
      <div><h3>Resolved service environment</h3><p className="muted">Potential secrets are masked by default.</p></div>
      <button className="button secondary" onClick={() => setReveal(value => !value)}>{reveal ? 'Mask secrets' : 'Reveal secrets'}</button>
    </div>
    <ListControls
      query={list.query} onQueryChange={list.setQuery}
      page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
      startItem={list.startItem} endItem={list.endItem}
      onPrevious={() => list.setPage(list.page - 1)}
      onNext={() => list.setPage(list.page + 1)}
      placeholder="Search environment…"
    />
    {!list.pageItems.length ? <EmptyState title="No environment values" text="No resolved service environment values match this view." /> :
      <div className="table-card"><table><thead><tr><th>Service</th><th>Variable</th><th>Value</th></tr></thead>
        <tbody>{list.pageItems.map((row, index) => <tr key={`${row.service}-${row.key}-${index}`}>
          <td><strong>{row.service}</strong></td><td><code>{row.key}</code></td>
          <td className="mono wrap">{secret(row.key) && !reveal ? '••••••••' : row.value}</td>
        </tr>)}</tbody></table></div>}
  </div>
}

function ResourceList({ title, values, empty }: { title:string; values:string[]; empty:string }) {
  const list = usePaginatedSearch(values, value => value, { pageSize: 10 })
  return <section className="card resource-list-card">
    <div className="section-row"><h3>{title}</h3><Badge>{values.length}</Badge></div>
    <ListControls
      query={list.query} onQueryChange={list.setQuery}
      page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
      startItem={list.startItem} endItem={list.endItem}
      onPrevious={() => list.setPage(list.page - 1)}
      onNext={() => list.setPage(list.page + 1)}
      placeholder={`Search ${title.toLowerCase()}…`}
    />
    {list.pageItems.length
      ? list.pageItems.map(value => <div className="resource-list-row mono" key={value}>{value}</div>)
      : <EmptyState title={`No ${title.toLowerCase()}`} text={empty} />}
  </section>
}

function Metric({ title, value, tone='neutral' }: { title:string; value:string; tone?:'neutral'|'ok'|'danger' }) {
  return <div className="card diagnostic-item"><span>{title}</span><strong>{value}</strong>{tone!=='neutral'&&<Badge tone={tone}>{tone==='ok'?'Healthy':'Attention'}</Badge>}</div>
}
