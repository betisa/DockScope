import { useEffect, useState } from 'react'
import type { ComposeProject } from '../../../shared/contracts'

type Row = { Name?: string; Container?: string; CPUPerc?: string; MemUsage?: string; MemPerc?: string; NetIO?: string; BlockIO?: string; PIDs?: string }

export function ComposeLiveStatsPanel({ project, services = [] }: { project: ComposeProject; services?: string[] }) {
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [state, setState] = useState('Connecting…')

  useEffect(() => {
    let disposed = false
    let localId: string | null = null
    let buffer = ''
    let unsubs: Array<() => void> = []
    window.dockerApi.streams.startComposeStats(project, services).then(({ sessionId }) => {
      if (disposed) { window.dockerApi.streams.stop(sessionId); return }
      localId = sessionId
      setState('Live · Esc to stop')
      unsubs = [
        window.dockerApi.streams.onData(sessionId, (chunk) => {
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as Row
              const key = parsed.Name || parsed.Container || `row-${Date.now()}`
              setRows((old) => ({ ...old, [key]: parsed }))
            } catch { /* partial line */ }
          }
        }),
        window.dockerApi.streams.onError(sessionId, (x) => setState(`Error: ${x}`)),
        window.dockerApi.streams.onExit(sessionId, () => setState('Stopped'))
      ]
    })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && localId) window.dockerApi.streams.stop(localId) }
    window.addEventListener('keydown', onKey)
    return () => {
      disposed = true
      window.removeEventListener('keydown', onKey)
      unsubs.forEach((x) => x())
      if (localId) window.dockerApi.streams.stop(localId)
    }
  }, [project.name, project.configFiles, services.join('|')])

  const list = Object.entries(rows)
  return <div className="compose-stats">
    <div className="stream-state activity-state">● {state}</div>
    <section className="card table-card">
      <table><thead><tr><th>Container</th><th>CPU</th><th>Memory</th><th>Mem %</th><th>Network I/O</th><th>Block I/O</th><th>PIDs</th></tr></thead>
      <tbody>{list.length ? list.map(([key, x]) => <tr key={key}><td><strong>{key}</strong></td><td>{x.CPUPerc ?? '—'}</td><td>{x.MemUsage ?? '—'}</td><td>{x.MemPerc ?? '—'}</td><td>{x.NetIO ?? '—'}</td><td>{x.BlockIO ?? '—'}</td><td>{x.PIDs ?? '—'}</td></tr>) : <tr><td colSpan={7}>Waiting for Compose stats…</td></tr>}</tbody></table>
    </section>
  </div>
}
