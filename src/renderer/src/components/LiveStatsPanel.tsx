import { useEffect, useMemo, useState } from 'react'

type Stats = {
  Name?: string; CPUPerc?: string; MemUsage?: string; MemPerc?: string; NetIO?: string; BlockIO?: string; PIDs?: string
}

export function LiveStatsPanel({ containerId }: { containerId: string }) {
  const [current, setCurrent] = useState<Stats | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [state, setState] = useState('Connecting…')

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

  return (
    <div className="stats-workspace">
      <div className="stream-state">● {state}</div>
      <div className="stats-grid">
        <Stat title="CPU" value={current?.CPUPerc ?? '—'} chart={<Sparkline values={cpuHistory} />} />
        <Stat title="Memory" value={current?.MemUsage ?? '—'} sub={current?.MemPerc} chart={<Sparkline values={memHistory} />} />
        <Stat title="Network I/O" value={current?.NetIO ?? '—'} />
        <Stat title="Block I/O" value={current?.BlockIO ?? '—'} />
        <Stat title="Processes" value={current?.PIDs ?? '—'} />
      </div>
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

function Stat({ title, value, sub, chart }: { title: string; value: string; sub?: string; chart?: React.ReactNode }) {
  return <section className="card live-stat"><span>{title}</span><strong>{value}</strong>{sub && <small>{sub}</small>}{chart}</section>
}

function Sparkline({ values }: { values: number[] }) {
  const points = useMemo(() => {
    if (!values.length) return ''
    const max = Math.max(100, ...values)
    return values.map((v, i) => `${(i/(Math.max(values.length-1,1)))*100},${38-(Math.min(v,max)/max)*34}`).join(' ')
  }, [values])
  return <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
}
