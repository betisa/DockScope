import { Switch } from './ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComposeProject } from '../../../shared/contracts'
import { ColoredLogConsole } from './ColoredLogConsole'

export function ComposeLiveLogsPanel({ project, services = [] }: { project: ComposeProject; services?: string[] }) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [state, setState] = useState('Connecting…')
  const pausedRef = useRef(false)
  const bufferRef = useRef('')
  const preRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let disposed = false
    let localId: string | null = null
    let unsubs: Array<() => void> = []
    window.dockerApi.streams.startComposeLogs(project, services, 400).then(({ sessionId }) => {
      if (disposed) { window.dockerApi.streams.stop(sessionId); return }
      localId = sessionId
      setState('Live · Esc to stop')
      unsubs = [
        window.dockerApi.streams.onData(sessionId, (chunk) => {
          if (pausedRef.current) bufferRef.current += chunk
          else setText((old) => trim(old + chunk))
        }),
        window.dockerApi.streams.onError(sessionId, (chunk) => setText((old) => trim(old + `\n[stderr] ${chunk}`))),
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

  useEffect(() => {
    pausedRef.current = paused
    if (!paused && bufferRef.current) {
      setText((old) => trim(old + bufferRef.current))
      bufferRef.current = ''
    }
  }, [paused])

  useEffect(() => { if (autoScroll && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight }, [text, autoScroll])

  const display = useMemo(() => !query ? text : text.split(/\r?\n/).filter((x) => x.toLowerCase().includes(query.toLowerCase())).join('\n'), [text, query])

  return <section className="runtime-panel">
    <div className="runtime-toolbar">
      <input className="runtime-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter aggregated logs…" />
      <Switch checked={autoScroll} onChange={setAutoScroll} label="Auto-scroll" compact />
      <button className="button secondary" onClick={() => setPaused((x) => !x)}>{paused ? 'Resume' : 'Pause'}</button>
      <button className="button secondary" onClick={() => setText('')}>Clear</button>
      <span className="log-color-legend" aria-label="Log color legend">
        <i className="legend-error" /> Error
        <i className="legend-warn" /> Warn
        <i className="legend-info" /> Info
      </span>
      <span className="stream-state">● {state}</span>
    </div>
    <ColoredLogConsole
      ref={preRef}
      value={display}
      emptyText="Waiting for Compose log output…"
      ariaLabel="Live Compose logs output"
      compose
    />
  </section>
}

function trim(value: string) {
  const lines = value.split(/\r?\n/)
  return lines.length > 7000 ? lines.slice(-7000).join('\n') : value
}
