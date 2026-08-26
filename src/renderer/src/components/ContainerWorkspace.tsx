import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContainerDiagnostics, ContainerInfo, ContainerProcess } from '../../../shared/contracts'
import { Badge, CodePanel, EmptyState, InlineAlert } from './ui'
import { LiveLogsPanel } from './LiveLogsPanel'
import { LiveStatsPanel } from './LiveStatsPanel'
import { TerminalPane } from './TerminalPane'
import { ContainerAdvisorPanel } from './ContainerAdvisorPanel'
import { ContainerFileBrowser } from './ContainerFileBrowser'

type Tab = 'advisor'|'logs'|'stats'|'processes'|'health'|'ports'|'mounts'|'networks'|'environment'|'files'|'inspect'|'terminal'
const tabs: Tab[] = ['advisor','stats','logs','processes','health','ports','mounts','networks','environment','files','inspect','terminal']

export function ContainerWorkspace({ container, onClose, initialTab }: { container: ContainerInfo; onClose: () => void; initialTab?: string }) {
  const normalizedInitialTab = initialTab === 'overview' ? 'stats' : initialTab
  const requestedTab = tabs.includes(normalizedInitialTab as Tab) ? normalizedInitialTab as Tab : undefined
  const [tab, setTab] = useState<Tab>(() => requestedTab ?? preferredWorkspaceTab(container))
  const tabManuallySelected = useRef(Boolean(requestedTab))
  const [diag, setDiag] = useState<ContainerDiagnostics | null>(null)
  const [diagError, setDiagError] = useState('')
  const [processes, setProcesses] = useState<ContainerProcess[]>([])
  const [inspect, setInspect] = useState('')
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  useEffect(() => {
    tabManuallySelected.current = Boolean(requestedTab)
    if (!requestedTab) setTab(preferredWorkspaceTab(container))
    setDiag(null)
    setDiagError('')
    let active = true
    void window.dockerApi.containers.diagnostics(container.id)
      .then((value) => {
        if (active) {
          setDiag(value)
          if (!tabManuallySelected.current) setTab(preferredWorkspaceTab(value))
        }
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

  return createPortal(
    <div className="container-workspace-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="container-workspace card" role="dialog" aria-modal="true" aria-labelledby="container-workspace-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="workspace-titlebar">
          <div><div className="eyebrow">Container workspace</div><h2 id="container-workspace-dialog-title">{container.name}</h2><span className="mono muted">{container.image}</span></div>
          <button ref={closeButtonRef} className="icon-button" onClick={onClose} aria-label="Close container workspace">×</button>
        </div>
        <div className="workspace-tabs" role="tablist" aria-label="Container workspace sections">
          {tabs.map((x) => <button key={x} role="tab" aria-selected={tab===x} className={tab===x?'active':''} onClick={() => { tabManuallySelected.current = true; setTab(x) }}>{title(x)}</button>)}
        </div>
        <div className="workspace-body">
          {tab === 'advisor' && <ContainerAdvisorPanel containerId={container.id} />}
          {tab === 'stats' && <OverviewStats container={container} diag={diag} diagError={diagError} />}
          {tab === 'logs' && <LiveLogsPanel containerId={container.id} />}
          {tab === 'processes' && <Processes rows={processes} />}
          {tab === 'health' && <Health diag={diag} />}
          {tab === 'ports' && <Ports diag={diag} />}
          {tab === 'mounts' && <Mounts diag={diag} />}
          {tab === 'networks' && <Networks diag={diag} />}
          {tab === 'environment' && <Environment diag={diag} />}
          {tab === 'files' && <ContainerFileBrowser containerId={container.id} running={container.state === 'running'} initialPath="/" />}
          {tab === 'inspect' && <CodePanel title="docker inspect --size" value={inspect} />}
          {tab === 'terminal' && <TerminalPane containerId={container.id} running={container.state === 'running'} />}
        </div>
      </div>
    </div>,
    document.body
  )
}

function OverviewStats({ container, diag, diagError }: { container: ContainerInfo; diag: ContainerDiagnostics|null; diagError: string }) {
  return <div className="overview-stats-panel">
    <LiveStatsPanel containerId={container.id} startedAt={diag?.startedAt || container.startedAt} containerName={container.name} image={container.image} containerState={diag?.state || container.state} />
    <section className="overview-summary-strip">
      <div className="overview-summary-heading"><div><div className="eyebrow">Container overview</div><strong>Inspect snapshot</strong></div><span>RUNTIME DETAILS</span></div>
      <Overview container={container} diag={diag} diagError={diagError} />
    </section>
  </div>
}

function title(x: string) { return x.charAt(0).toUpperCase()+x.slice(1) }
function preferredWorkspaceTab(value: { state?: string; status?: string; exitCode?: number; oomKilled?: boolean; restartCount?: number; stateError?: string; health?: ContainerDiagnostics['health'] }): Tab {
  const running = String(value.state ?? '').toLowerCase() === 'running'
  const status = String(value.status ?? '')
  const healthProblem = Boolean(value.health && (
    value.health.status === 'unhealthy' ||
    (value.health.configured && value.health.status === 'unknown')
  ))
  const problem = !running || /unhealthy|failed|restarting|dead|exited/i.test(status) || (value.exitCode !== undefined && value.exitCode !== 0) || Boolean(value.oomKilled) || Number(value.restartCount ?? 0) >= 3 || Boolean(value.stateError) || healthProblem
  return problem ? 'advisor' : 'stats'
}

function Overview({ container, diag, diagError }: { container: ContainerInfo; diag: ContainerDiagnostics|null; diagError: string }) {
  if (!diag && diagError) {
    return <div>
      <InlineAlert tone="danger" title="Could not load container details">{diagError}</InlineAlert>
      <div className="diagnostic-grid overview-diagnostic-grid">
        <Info label="State" value={container.state} />
        <Info label="Status" value={container.status || '—'} />
        <Info label="Image" value={container.image || '—'} />
        <Info label="Ports" value={container.ports || '—'} />
      </div>
    </div>
  }
  if (!diag) return <EmptyState title="Loading diagnostics" text="Reading Docker inspect metadata…" />
  return <div className="diagnostic-grid overview-diagnostic-grid">
    <Info label="State" value={diag.state} /><Info label="Health" value={diag.health.status} /><Info label="Platform" value={diag.platform || '—'} /><Info label="Restart policy" value={diag.restartPolicy} />
    <Info label="Exit code" value={String(diag.exitCode)} /><Info label="Restarts" value={String(diag.restartCount)} /><Info label="OOM killed" value={diag.oomKilled ? 'Yes' : 'No'} /><Info label="Created" value={diag.created} /><Info label="Started" value={diag.startedAt} /><Info label="Working directory" value={diag.workingDir || '—'} /><Info label="Command" value={[...diag.entrypoint,...diag.command].join(' ') || '—'} />
  </div>
}
function Info({label,value}:{label:string,value:string}) { return <div className="card diagnostic-item"><span>{label}</span><strong className="wrap">{value}</strong></div> }
function Processes({rows}:{rows:ContainerProcess[]}) { return !rows.length ? <EmptyState title="No process data" text="docker top returned no process rows or the container is stopped."/> : <div className="table-card"><table><thead><tr><th>PID</th><th>User</th><th>CPU</th><th>Memory</th><th>Command</th></tr></thead><tbody>{rows.map((p,i)=><tr key={`${p.pid}-${i}`}><td>{p.pid}</td><td>{p.user}</td><td>{p.cpu}</td><td>{p.memory}</td><td className="mono wrap">{p.command}</td></tr>)}</tbody></table></div> }
type HealthHistoryState = 'up'|'down'|'unknown'

function Health({diag}:{diag:ContainerDiagnostics|null}) {
  if (!diag) return <EmptyState title="Loading health report" text="Reading Docker health-check metadata…" />

  const health = diag.health
  const status = healthStatusLabel(health.status, health.configured)
  const tone = healthTone(health.status, health.configured)
  const passing = health.logs.filter(item => item.exitCode === 0).length
  const failing = health.logs.length - passing
  const latest = health.logs.at(-1)
  const samples = health.logs.map(item => ({
    at:item.end || item.start,
    state:item.exitCode === 0 ? 'up' as const : 'down' as const
  }))

  return <div className="health-report">
    <div className="health-summary-grid">
      <HealthSummaryCard label="Current status" value={status} detail={healthExplanation(health.status, health.configured)} tone={tone} />
      <HealthSummaryCard label="Failing streak" value={String(health.failingStreak)} detail="Consecutive Docker probe failures" tone={health.failingStreak ? 'danger' : 'neutral'} />
      <HealthSummaryCard label="Recent checks" value={String(health.logs.length)} detail={`${passing} passing · ${failing} failing`} tone={failing ? 'danger' : health.logs.length ? 'ok' : 'neutral'} />
      <HealthSummaryCard label="Container state" value={title(diag.state || 'unknown')} detail={diag.status || 'Runtime state unavailable'} tone={diag.state === 'running' ? 'ok' : 'danger'} />
    </div>

    <section className="card health-report-card">
      <div className="health-report-heading">
        <div>
          <div className="eyebrow">Runtime health</div>
          <h2>Health check</h2>
          <p className="health-test-command">{health.test.join(' ') || 'No healthcheck configured.'}</p>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="health-history-panel">
        {samples.length ? <HealthHistoryBars samples={samples} /> : <div className="health-history-empty">{health.configured ? 'No recent Docker probe results are available.' : 'No Docker health check is configured.'}</div>}
        <div className="health-history-caption"><span>Recent Docker probe results</span><span>{health.logs.length ? `Last ${health.logs.length} checks` : 'No recorded checks'}</span></div>
      </div>
      <div className="health-report-note"><span className={`status-dot ${tone === 'ok' ? 'ok' : tone === 'danger' ? 'bad' : ''}`} />{healthExplanation(health.status, health.configured)}</div>
    </section>

    <div className="health-detail-metrics">
      <HealthMetric label="Passing checks" value={String(passing)} detail="Recent probes with exit code 0" tone={passing ? 'ok' : 'neutral'} />
      <HealthMetric label="Failing checks" value={String(failing)} detail="Recent probes with a non-zero exit" tone={failing ? 'danger' : 'ok'} />
      <HealthMetric label="Last result" value={latest ? latest.exitCode === 0 ? 'Passed' : 'Failed' : '—'} detail={latest?.end ? `Completed ${formatHealthDate(latest.end)}` : 'No result timestamp'} tone={latest ? latest.exitCode === 0 ? 'ok' : 'danger' : 'neutral'} />
      <HealthMetric label="Check config" value={health.configured ? 'Configured' : 'Not configured'} detail={health.configured ? `Retries ${health.retries ?? '—'} · Timeout ${health.timeout ?? '—'}` : 'Health cannot be assessed'} />
    </div>

    <section className="card health-checks-card">
      <div className="section-row compact">
        <div><div className="eyebrow">Check history</div><h3>Recent health output</h3></div>
        <span className="muted">PASS / FAIL</span>
      </div>
      {health.logs.length ? <div className="health-list">{health.logs.slice().reverse().map((item, index) => <div className="card health-row" key={`${item.end}-${index}`}>
        <div><Badge tone={item.exitCode === 0 ? 'ok' : 'danger'}>{item.exitCode === 0 ? 'Passed' : 'Failed'}</Badge><strong>Exit {item.exitCode}</strong><span className="muted">{formatHealthDate(item.end || item.start)}</span></div>
        <pre>{item.output || 'No output'}</pre>
      </div>)}</div> : <EmptyState title={health.configured ? 'No health check history' : 'No healthcheck configured'} text={health.configured ? 'Docker has not returned any recent probe output.' : 'Configure a Docker health check to collect runtime health evidence.'} />}
    </section>
  </div>
}

function healthStatusLabel(status:string, configured:boolean) {
  if (!configured || status === 'not-configured') return 'Not configured'
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase()+status.slice(1)
}

function healthTone(status:string, configured:boolean): 'neutral'|'ok'|'danger' {
  if (!configured || status === 'not-configured') return 'neutral'
  if (status === 'healthy') return 'ok'
  if (status === 'unhealthy') return 'danger'
  return 'neutral'
}

function healthExplanation(status:string, configured:boolean) {
  if (!configured || status === 'not-configured') return 'No Docker health check is configured for this container.'
  if (status === 'healthy') return 'Docker reports that the latest health check passed.'
  if (status === 'unhealthy') return 'Docker reports consecutive health-check failures.'
  return 'Docker has not provided an assessable health status.'
}

function HealthSummaryCard({ label, value, detail, tone = 'neutral' }: { label:string; value:string; detail:string; tone?:'neutral'|'ok'|'danger' }) {
  return <div className="card health-summary-card"><span>{label}</span><strong className={tone}>{value}</strong><small>{detail}</small></div>
}

function HealthMetric({ label, value, detail, tone = 'neutral' }: { label:string; value:string; detail:string; tone?:'neutral'|'ok'|'danger' }) {
  return <div className="card health-detail-metric"><span>{label}</span><strong className={tone}>{value}</strong><small>{detail}</small></div>
}

function HealthHistoryBars({ samples }: { samples:Array<{ at:string; state:HealthHistoryState }> }) {
  const passing = samples.filter(sample => sample.state === 'up').length
  return <div className="health-history-bars" role="img" aria-label={`Recent health checks: ${passing} passing, ${samples.length - passing} failing`}>
    {samples.map((sample, index) => <span key={`${sample.at}-${index}`} className={`health-history-bar ${sample.state}`} title={`${formatHealthDate(sample.at)} · ${sample.state === 'up' ? 'passed' : 'failed'}`} />)}
  </div>
}

function formatHealthDate(value:string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}
function Ports({diag}:{diag:ContainerDiagnostics|null}) { return !diag?.ports.length?<EmptyState title="No published ports" text="This container has no port bindings."/>:<div className="table-card"><table><thead><tr><th>Container</th><th>Host</th><th>Protocol</th><th>Endpoint</th></tr></thead><tbody>{diag.ports.map((p,i)=><tr key={i}><td>{p.privatePort}</td><td>{p.publicHost||'—'}:{p.publicPort||'—'}</td><td>{p.protocol}</td><td>{p.publicPort?<button className="link-button" onClick={()=>navigator.clipboard.writeText(`http://localhost:${p.publicPort}`)}>Copy localhost:{p.publicPort}</button>:'Not published'}</td></tr>)}</tbody></table></div> }
function Mounts({diag}:{diag:ContainerDiagnostics|null}) { return !diag?.mounts.length?<EmptyState title="No mounts" text="No bind mounts or volumes are attached."/>:<div className="table-card"><table><thead><tr><th>Type</th><th>Name</th><th>Source</th><th>Destination</th><th>RW</th></tr></thead><tbody>{diag.mounts.map((m,i)=><tr key={i}><td>{m.type}</td><td>{m.name||'—'}</td><td className="mono wrap">{m.source}</td><td className="mono wrap">{m.destination}</td><td>{m.rw?'Yes':'No'}</td></tr>)}</tbody></table></div> }
function Networks({diag}:{diag:ContainerDiagnostics|null}) { return !diag?.networks.length?<EmptyState title="No networks" text="No network attachment found."/>:<div className="table-card"><table><thead><tr><th>Name</th><th>IP</th><th>Gateway</th><th>MAC</th><th>Aliases</th></tr></thead><tbody>{diag.networks.map((n)=><tr key={n.name}><td>{n.name}</td><td>{n.ipAddress||'—'}</td><td>{n.gateway||'—'}</td><td className="mono">{n.macAddress||'—'}</td><td>{n.aliases.join(', ')||'—'}</td></tr>)}</tbody></table></div> }
function Environment({diag}:{diag:ContainerDiagnostics|null}) { const [revealed,setRevealed]=useState<Record<number,boolean>>({}); const rows=useMemo(()=>diag?.environment.map((x)=>{const i=x.indexOf('=');return {key:i>=0?x.slice(0,i):x,value:i>=0?x.slice(i+1):''}})??[],[diag]); return <div><div className="warning-banner"><strong>Secret-aware view.</strong> Values matching PASSWORD, SECRET, TOKEN, KEY or CONNECTION are masked by default and are never persisted by this UI.</div><div className="table-card"><table><thead><tr><th>Variable</th><th>Value</th><th/></tr></thead><tbody>{rows.map((r,i)=>{const secret=/(PASSWORD|SECRET|TOKEN|KEY|CONNECTION)/i.test(r.key); const show=!secret||revealed[i]; return <tr key={`${r.key}-${i}`}><td className="mono">{r.key}</td><td className="mono wrap">{show?r.value:'••••••••••••'}</td><td>{secret&&<button className="link-button" onClick={()=>setRevealed(x=>({...x,[i]:!x[i]}))}>{show?'Hide':'Reveal'}</button>}</td></tr>})}</tbody></table></div></div> }
