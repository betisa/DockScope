import { useEffect, useMemo, useState } from 'react'
import { formatUptime } from '../../../shared/formatting'

type Stats = {
  Name?: string; CPUPerc?: string; MemUsage?: string; MemPerc?: string; NetIO?: string; BlockIO?: string; PIDs?: string
}

export function LiveStatsPanel({ containerId, startedAt = '', containerName = 'Container', image = '', containerState = '' }: { containerId: string; startedAt?: string; containerName?: string; image?: string; containerState?: string }) {
  const [current, setCurrent] = useState<Stats | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [state, setState] = useState('Connecting…')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let disposed = false
    let localId: string | null = null
    let buffer = ''
    let unsubs: Array<() => void> = []
    const applyStats = (parsed: Stats) => {
      setCurrent(parsed)
      setCpuHistory((old) => [...old, pct(parsed.CPUPerc)].slice(-60))
      setMemHistory((old) => [...old, pct(parsed.MemPerc)].slice(-60))
    }

    window.dockerApi.streams.startContainerStats(containerId).then(({ sessionId }) => {
      if (disposed) { void window.dockerApi.streams.stop(sessionId); return }
      localId = sessionId
      setState('Live · Esc to stop')
      unsubs = [
        window.dockerApi.streams.onData(sessionId, (chunk) => {
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const parsed = parseStatsLine(line)
            if (parsed) {
              applyStats(parsed)
            }
          }

          const pending = buffer.trim()
          if (pending) {
            const parsed = parseStatsLine(pending)
            if (parsed) {
              buffer = ''
              applyStats(parsed)
            }
          }
        }),
        window.dockerApi.streams.onError(sessionId, (x) => setState(`Error: ${x}`)),
        window.dockerApi.streams.onExit(sessionId, () => setState('Stopped'))
      ]
    }).catch((error) => {
      if (!disposed) setState(`Error: ${error instanceof Error ? error.message : String(error)}`)
    })

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && localId) window.dockerApi.streams.stop(localId) }
    window.addEventListener('keydown', onKey)
    return () => {
      disposed = true
      window.removeEventListener('keydown', onKey)
      unsubs.forEach((u) => u())
      if (localId) window.dockerApi.streams.stop(localId)
    }
  }, [containerId])

  const memory = memoryDetails(current?.MemUsage)

  return (
    <div className="stats-workspace">
      <div className="stats-toolbar">
        <span className={`stream-state ${state.startsWith('Error') ? 'error' : ''}`}><span className="stats-live-dot" />{state}</span>
        <div className="stats-window-switcher" aria-label="Stats time window"><span className="active">LIVE</span><span>1H</span><span>6H</span><span>24H</span><span>7D</span></div>
      </div>
      <div className="stats-resource-grid">
        <ResourceCard title="CPU usage" value={current?.CPUPerc ?? '—'} gauge={gaugePct(current?.CPUPerc)} detail="Live Docker CPU" chart={<Sparkline values={cpuHistory} />} readings={[['Samples', String(cpuHistory.length || '—')], ['Peak', cpuHistory.length ? `${Math.max(...cpuHistory).toFixed(1)}%` : '—']]} />
        <ResourceCard title="Memory usage" value={current?.MemPerc ?? '—'} gauge={gaugePct(current?.MemPerc)} detail={memory.used} chart={<Sparkline values={memHistory} />} readings={[['Memory', current?.MemUsage ?? '—'], ['Available', memory.free]]} />
        <ResourceCard title="Disk I/O" value={current?.BlockIO ?? '—'} gauge={null} detail="Read / write activity" readings={[['Block I/O', current?.BlockIO ?? '—'], ['Status', state.startsWith('Error') ? 'Unavailable' : 'Live']]} />
      </div>
      <div className="stats-secondary-grid">
        <StatsPanel title="Network interfaces" kicker="LIVE">
          <div className="stats-interface-row"><span><i className="stats-status-dot" />container network</span><strong>{current?.NetIO ?? '—'}</strong></div>
          <small className="stats-panel-note">Network I/O · received / transmitted</small>
        </StatsPanel>
        <StatsPanel title="Uptime">
          <strong className="stats-uptime-value">{formatUptime(startedAt, containerState.toLowerCase() === 'running', now)}</strong>
          <small className="stats-panel-note">{startedAt ? `Started ${formatDate(startedAt)}` : 'Start time unavailable'}</small>
        </StatsPanel>
        <StatsPanel title="System information">
          <div className="stats-system-list"><InfoRow label="Name" value={containerName} /><InfoRow label="Image" value={image || '—'} /><InfoRow label="State" value={containerState || 'Unknown'} /><InfoRow label="Processes" value={current?.PIDs ?? '—'} /></div>
        </StatsPanel>
      </div>
      <section className="card stats-process-panel">
        <div className="stats-panel-heading"><div><div className="eyebrow">Process monitor</div><h3>Container processes</h3></div><strong>{current?.PIDs ?? '—'} total</strong></div>
        <div className="stats-process-meter"><span style={{ width:`${Math.min(100, Math.max(0, Number(current?.PIDs ?? 0) * 4))}%` }} /></div>
      </section>
    </div>
  )
}

function parseStatsLine(line: string): Stats | null {
  const cleanLine = line.replace(/\u001b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '').trim()
  if (!cleanLine) return null
  try {
    return JSON.parse(cleanLine) as Stats
  } catch {
    return null
  }
}

function pct(v?: string) { const n = Number((v ?? '0').replace('%','')); return Number.isFinite(n) ? n : 0 }

function gaugePct(value?: string) { return Math.min(100, Math.max(0, pct(value))) }

function memoryDetails(value?: string) {
  const [used = '—', total = '—'] = String(value ?? '').split('/').map(item => item.trim())
  const usedBytes = parseSize(used)
  const totalBytes = parseSize(total)
  const free = usedBytes !== null && totalBytes !== null && totalBytes >= usedBytes ? formatSize(totalBytes - usedBytes) : '—'
  return { used, total, free }
}

function parseSize(value: string) {
  const match = value.match(/^([\d.]+)\s*(B|KB|KIB|MB|MIB|GB|GIB|TB|TIB)?$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  const units: Record<string, number> = { B:1, KB:1000, KIB:1024, MB:1_000_000, MIB:1024 ** 2, GB:1_000_000_000, GIB:1024 ** 3, TB:1_000_000_000_000, TIB:1024 ** 4 }
  return amount * (units[(match[2] ?? 'B').toUpperCase()] ?? 1)
}

function formatSize(value: number) {
  if (value >= 1024 ** 3) return `${(value / (1024 ** 3)).toFixed(1)}GiB`
  if (value >= 1024 ** 2) return `${(value / (1024 ** 2)).toFixed(1)}MiB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)}KiB`
  return `${Math.round(value)}B`
}

function ResourceCard({ title, value, gauge, detail, chart, readings }: { title:string; value:string; gauge:number|null; detail:string; chart?:React.ReactNode; readings:Array<[string,string]> }) {
  return <section className="card stats-resource-card">
    <div className="stats-panel-heading"><div><div className="eyebrow">{title}</div></div><div className="stats-window-active">LIVE</div></div>
    <div className="stats-resource-body">
      <Gauge value={gauge} label={value} />
      <div className="stats-resource-readings">{readings.map(([label, reading]) => <div key={label}><span>{label}</span><strong>{reading}</strong></div>)}{chart}</div>
    </div>
    <small className="stats-resource-note">{detail}</small>
  </section>
}

function Gauge({ value, label }: { value:number|null; label:string }) {
  return <div className="stats-gauge" style={{ '--gauge-value': `${value ?? 0}%` } as React.CSSProperties}><div><strong>{label}</strong><span>{value === null ? 'No ratio' : `${value.toFixed(0)}%`}</span></div></div>
}

function StatsPanel({ title, kicker, children }: { title:string; kicker?:string; children:React.ReactNode }) {
  return <section className="card stats-panel"><div className="stats-panel-heading"><div className="eyebrow">{title}</div>{kicker && <span className="stats-window-active">{kicker}</span>}</div>{children}</section>
}

function InfoRow({ label, value }: { label:string; value:string }) {
  return <div><span>{label}</span><strong className="wrap">{value}</strong></div>
}

function formatDate(value:string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

function Sparkline({ values }: { values: number[] }) {
  const points = useMemo(() => {
    if (!values.length) return ''
    const max = Math.max(100, ...values)
    return values.map((v, i) => `${(i/(Math.max(values.length-1,1)))*100},${38-(Math.min(v,max)/max)*34}`).join(' ')
  }, [values])
  return <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
}
