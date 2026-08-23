import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from './Icon'
import { Switch } from './ui'
import { Search01Icon, PauseIcon, PlayIcon, Delete02Icon } from '@hugeicons/core-free-icons'
import { ColoredLogConsole } from './ColoredLogConsole'

export function LiveLogsPanel({ containerId }: { containerId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [regex, setRegex] = useState(false)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const maxLinesRef = useRef(5000)
  const pausedBuffer = useRef('')
  const incomingBuffer = useRef('')
  const pre = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let disposed = false
    let localId: string | null = null
    let unsubs: Array<() => void> = []

    const flush = window.setInterval(() => {
      if (disposed || pausedRef.current || !incomingBuffer.current) return
      const chunk = incomingBuffer.current
      incomingBuffer.current = ''
      setText(old => trimLog(old + chunk, maxLinesRef.current))
    }, 100)

    void window.dockerApi.settings.get().then(settings => {
      if (disposed) return
      maxLinesRef.current = settings.terminal.maxLogLines
      return window.dockerApi.streams.startContainerLogs(containerId, settings.terminal.logTailLines)
    }).then(started => {
      if (!started) return
      const { sessionId } = started

      if (disposed) {
        void window.dockerApi.streams.stop(sessionId)
        return
      }

      localId = sessionId
      setSessionId(sessionId)

      unsubs = [
        window.dockerApi.streams.onData(sessionId, chunk => {
          if (pausedRef.current) pausedBuffer.current += chunk
          else incomingBuffer.current += chunk
        }),
        window.dockerApi.streams.onError(sessionId, chunk => {
          incomingBuffer.current += `\n[stderr] ${chunk}`
        }),
        window.dockerApi.streams.onExit(sessionId, code => {
          incomingBuffer.current += `\n[stream closed: ${code ?? 'unknown'}]`
          setSessionId(null)
        })
      ]
    }).catch(error => {
      incomingBuffer.current += `\n[stream error] ${error instanceof Error ? error.message : String(error)}`
    })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && localId) void window.dockerApi.streams.stop(localId)
    }
    window.addEventListener('keydown', onKey)

    return () => {
      disposed = true
      window.clearInterval(flush)
      window.removeEventListener('keydown', onKey)
      unsubs.forEach(unsub => unsub())
      if (localId) void window.dockerApi.streams.stop(localId)
    }
  }, [containerId])

  useEffect(() => {
    pausedRef.current = paused
    if (!paused) {
      const buffered = pausedBuffer.current + incomingBuffer.current
      pausedBuffer.current = ''
      incomingBuffer.current = ''
      if (buffered) setText(old => trimLog(old + buffered, maxLinesRef.current))
    }
  }, [paused])

  useEffect(() => {
    if (autoScroll && pre.current) pre.current.scrollTop = pre.current.scrollHeight
  }, [text, autoScroll])

  const display = useMemo(() => {
    if (!deferredQuery) return text
    try {
      const matcher = regex ? new RegExp(deferredQuery, 'i') : null
      const lowered = deferredQuery.toLowerCase()
      return text
        .split(/\r?\n/)
        .filter(line => matcher ? matcher.test(line) : line.toLowerCase().includes(lowered))
        .join('\n')
    } catch {
      return text
    }
  }, [text, deferredQuery, regex])

  return (
    <section className="runtime-panel" aria-label="Live container logs">
      <div className="runtime-toolbar">
        <label className="runtime-search-wrap">
          <AppIcon icon={Search01Icon} />
          <span className="sr-only">Filter logs</span>
          <input
            className="runtime-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Filter logs…"
          />
        </label>
        <Switch checked={regex} onChange={setRegex} label="Regex" compact />
        <Switch checked={autoScroll} onChange={setAutoScroll} label="Auto-scroll" compact />
        <button className="button secondary" onClick={() => setPaused(value => !value)}>
          <AppIcon icon={paused ? PlayIcon : PauseIcon} />
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button className="button secondary" onClick={() => setText('')}>
          <AppIcon icon={Delete02Icon} />
          Clear
        </button>
        <span className="log-color-legend" aria-label="Log color legend">
          <i className="legend-error" /> Error
          <i className="legend-warn" /> Warn
          <i className="legend-info" /> Info
        </span>
        <span className="stream-state" role="status">
          {sessionId ? '● Live · Esc to stop' : 'Connecting / stopped'}
        </span>
      </div>
      <ColoredLogConsole
        ref={pre}
        value={display}
        emptyText="Waiting for log output…"
        ariaLabel="Live container logs output"
      />
    </section>
  )
}

function trimLog(value: string, maxLines: number) {
  const lines = value.split(/\r?\n/)
  return lines.length > maxLines ? lines.slice(-maxLines).join('\n') : value
}
