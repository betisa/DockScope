import { useEffect, useMemo, useState } from 'react'
import type { ContainerDiagnostics, ContainerInfo, ContainerProcess } from '../../../shared/contracts'
import { Badge, CodePanel, EmptyState, InlineAlert } from './ui'
import { LiveLogsPanel } from './LiveLogsPanel'
import { LiveStatsPanel } from './LiveStatsPanel'
import { TerminalPane } from './TerminalPane'
import { ContainerAdvisorPanel } from './ContainerAdvisorPanel'
import { ContainerFileBrowser } from './ContainerFileBrowser'

type Tab = 'advisor'|'overview'|'logs'|'stats'|'processes'|'health'|'ports'|'mounts'|'networks'|'environment'|'files'|'inspect'|'terminal'
const tabs: Tab[] = ['advisor','overview','logs','stats','processes','health','ports','mounts','networks','environment','files','inspect','terminal']

export function ContainerWorkspace({ container, onClose, initialTab }: { container: ContainerInfo; onClose: () => void; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(tabs.includes(initialTab as Tab) ? initialTab as Tab : 'advisor')
  const [diag, setDiag] = useState<ContainerDiagnostics | null>(null)
  const [diagError, setDiagError] = useState('')
  const [processes, setProcesses] = useState<ContainerProcess[]>([])
  const [inspect, setInspect] = useState('')

  useEffect(() => {
    setDiag(null)
    setDiagError('')
    let active = true
    void window.dockerApi.containers.diagnostics(container.id)
      .then((value) => {
        if (active) setDiag(value)
      })
      .catch((value) => {
        if (active) setDiagError(value instanceof Error ? value.message : String(value))
      })
    return () => { active = false }
  }, [container.id])

  useEffect(() => {
    if (tab === 'processes') window.dockerApi.containers.processes(container.id).then(setProcesses).catch(() => setProcesses([]))
    if (tab === 'inspect' && !inspect) window.dockerApi.containers.inspect(container.id).then((x) => setInspect(x.stdout || x.stderr))
  }, [tab, container.id])

  return (
    <div className="container-workspace card">
      <div className="workspace-titlebar">
        <div><div className="eyebrow">Container workspace</div><h2>{container.name}</h2><span className="mono muted">{container.image}</span></div>
        <button className="icon-button" onClick={onClose} aria-label="Close container workspace">×</button>
      </div>
      <div className="workspace-tabs" role="tablist">
        {tabs.map((x) => <button key={x} className={tab===x?'active':''} onClick={() => setTab(x)}>{title(x)}</button>)}
      </div>
      <div className="workspace-body">
        {tab === 'advisor' && <ContainerAdvisorPanel containerId={container.id} />}
        {tab === 'overview' && <Overview container={container} diag={diag} diagError={diagError} />}
        {tab === 'logs' && <LiveLogsPanel containerId={container.id} />}
        {tab === 'stats' && <LiveStatsPanel containerId={container.id} />}
        {tab === 'processes' && <Processes rows={processes} />}
        {tab === 'health' && <Health diag={diag} />}
        {tab === 'ports' && <Ports diag={diag} />}
        {tab === 'mounts' && <Mounts diag={diag} />}
        {tab === 'networks' && <Networks diag={diag} />}
        {tab === 'environment' && <Environment diag={diag} />}
        {tab === 'files' && <ContainerFileBrowser containerId={container.id} running={container.state === 'running'} initialPath={diag?.workingDir || '/'} />}
        {tab === 'inspect' && <CodePanel title="docker inspect --size" value={inspect} />}
        {tab === 'terminal' && <TerminalPane containerId={container.id} running={container.state === 'running'} />}
      </div>
    </div>
  )
}

function title(x: string) { return x.charAt(0).toUpperCase()+x.slice(1) }
function Overview({ container, diag, diagError }: { container: ContainerInfo; diag: ContainerDiagnostics|null; diagError: string }) {
  if (!diag && diagError) {
    return <div>
      <InlineAlert tone="danger" title="Could not load container details">{diagError}</InlineAlert>
      <div className="diagnostic-grid">
        <Info label="State" value={container.state} />
        <Info label="Status" value={container.status || '—'} />
        <Info label="Image" value={container.image || '—'} />
        <Info label="Ports" value={container.ports || '—'} />
      </div>
    </div>
  }
  if (!diag) return <EmptyState title="Loading diagnostics" text="Reading Docker inspect metadata…" />
  return <div className="diagnostic-grid">
    <Info label="State" value={diag.state} /><Info label="Health" value={diag.health.status} /><Info label="Platform" value={diag.platform || '—'} /><Info label="Restart policy" value={diag.restartPolicy} />
    <Info label="Exit code" value={String(diag.exitCode)} /><Info label="Restarts" value={String(diag.restartCount)} /><Info label="OOM killed" value={diag.oomKilled ? 'Yes' : 'No'} /><Info label="Created" value={diag.created} /><Info label="Started" value={diag.startedAt} /><Info label="Working directory" value={diag.workingDir || '—'} /><Info label="Command" value={[...diag.entrypoint,...diag.command].join(' ') || '—'} />
  </div>
}
function Info({label,value}:{label:string,value:string}) { return <div className="card diagnostic-item"><span>{label}</span><strong className="wrap">{value}</strong></div> }
function Processes({rows}:{rows:ContainerProcess[]}) { return !rows.length ? <EmptyState title="No process data" text="docker top returned no process rows or the container is stopped."/> : <div className="table-card"><table><thead><tr><th>PID</th><th>User</th><th>CPU</th><th>Memory</th><th>Command</th></tr></thead><tbody>{rows.map((p,i)=><tr key={`${p.pid}-${i}`}><td>{p.pid}</td><td>{p.user}</td><td>{p.cpu}</td><td>{p.memory}</td><td className="mono wrap">{p.command}</td></tr>)}</tbody></table></div> }
function Health({diag}:{diag:ContainerDiagnostics|null}) { if(!diag)return null; const h=diag.health; return <div><div className="section-row compact"><div><h2>Health check</h2><p className="muted">{h.test.join(' ') || 'No healthcheck configured.'}</p></div><Badge tone={h.status==='healthy'?'ok':h.status==='unhealthy'?'danger':'neutral'}>{h.status}</Badge></div>{h.logs.length>0&&<div className="health-list">{h.logs.map((x,i)=><div className="card health-row" key={i}><div><strong>Exit {x.exitCode}</strong><span className="muted">{x.end}</span></div><pre>{x.output || 'No output'}</pre></div>)}</div>}</div> }
function Ports({diag}:{diag:ContainerDiagnostics|null}) { return !diag?.ports.length?<EmptyState title="No published ports" text="This container has no port bindings."/>:<div className="table-card"><table><thead><tr><th>Container</th><th>Host</th><th>Protocol</th><th>Endpoint</th></tr></thead><tbody>{diag.ports.map((p,i)=><tr key={i}><td>{p.privatePort}</td><td>{p.publicHost||'—'}:{p.publicPort||'—'}</td><td>{p.protocol}</td><td>{p.publicPort?<button className="link-button" onClick={()=>navigator.clipboard.writeText(`http://localhost:${p.publicPort}`)}>Copy localhost:{p.publicPort}</button>:'Not published'}</td></tr>)}</tbody></table></div> }
function Mounts({diag}:{diag:ContainerDiagnostics|null}) { return !diag?.mounts.length?<EmptyState title="No mounts" text="No bind mounts or volumes are attached."/>:<div className="table-card"><table><thead><tr><th>Type</th><th>Name</th><th>Source</th><th>Destination</th><th>RW</th></tr></thead><tbody>{diag.mounts.map((m,i)=><tr key={i}><td>{m.type}</td><td>{m.name||'—'}</td><td className="mono wrap">{m.source}</td><td className="mono wrap">{m.destination}</td><td>{m.rw?'Yes':'No'}</td></tr>)}</tbody></table></div> }
function Networks({diag}:{diag:ContainerDiagnostics|null}) { return !diag?.networks.length?<EmptyState title="No networks" text="No network attachment found."/>:<div className="table-card"><table><thead><tr><th>Name</th><th>IP</th><th>Gateway</th><th>MAC</th><th>Aliases</th></tr></thead><tbody>{diag.networks.map((n)=><tr key={n.name}><td>{n.name}</td><td>{n.ipAddress||'—'}</td><td>{n.gateway||'—'}</td><td className="mono">{n.macAddress||'—'}</td><td>{n.aliases.join(', ')||'—'}</td></tr>)}</tbody></table></div> }
function Environment({diag}:{diag:ContainerDiagnostics|null}) { const [revealed,setRevealed]=useState<Record<number,boolean>>({}); const rows=useMemo(()=>diag?.environment.map((x)=>{const i=x.indexOf('=');return {key:i>=0?x.slice(0,i):x,value:i>=0?x.slice(i+1):''}})??[],[diag]); return <div><div className="warning-banner"><strong>Secret-aware view.</strong> Values matching PASSWORD, SECRET, TOKEN, KEY or CONNECTION are masked by default and are never persisted by this UI.</div><div className="table-card"><table><thead><tr><th>Variable</th><th>Value</th><th/></tr></thead><tbody>{rows.map((r,i)=>{const secret=/(PASSWORD|SECRET|TOKEN|KEY|CONNECTION)/i.test(r.key); const show=!secret||revealed[i]; return <tr key={`${r.key}-${i}`}><td className="mono">{r.key}</td><td className="mono wrap">{show?r.value:'••••••••••••'}</td><td>{secret&&<button className="link-button" onClick={()=>setRevealed(x=>({...x,[i]:!x[i]}))}>{show?'Hide':'Reveal'}</button>}</td></tr>})}</tbody></table></div></div> }
