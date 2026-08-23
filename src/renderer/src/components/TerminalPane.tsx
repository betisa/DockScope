import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const shells = ['/bin/bash', '/bin/sh', 'pwsh', 'powershell', 'cmd']

export function TerminalPane({ containerId, running }: { containerId: string; running: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef<string | null>(null)
  const [shell, setShell] = useState('/bin/sh')
  const [connected, setConnected] = useState(false)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    window.dockerApi.settings.get().then(settings => {
      const configured = settings.terminal.defaultShell
      const resolved = configured === 'auto'
        ? '/bin/sh'
        : configured === 'bash' ? '/bin/bash'
        : configured === 'sh' ? '/bin/sh'
        : configured
      setShell(resolved)
    }).catch(() => undefined)
  }, [containerId])

  useEffect(() => {
    if (!running || !hostRef.current) return
    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
      fontSize: 12,
      scrollback: 5000,
      theme: { background: '#080a0f', foreground: '#d7e0ef', cursor: '#6aa9ff' }
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(hostRef.current)
    fit.fit()
    terminal.writeln(`\x1b[90mOpening ${shell} in container…\x1b[0m`)

    let disposed = false
    let unsubs: Array<() => void> = []
    let resizeTimer: number | undefined

    window.dockerApi.terminal.open(containerId, shell, terminal.cols, terminal.rows).then(({ sessionId }) => {
      if (disposed) { window.dockerApi.terminal.close(sessionId); return }
      sessionRef.current = sessionId
      setConnected(true)
      unsubs = [
        window.dockerApi.terminal.onData(sessionId, (data) => terminal.write(data)),
        window.dockerApi.terminal.onExit(sessionId, (code) => { terminal.writeln(`\r\n\x1b[90m[terminal exited ${code}]\x1b[0m`); setConnected(false) })
      ]
      terminal.onData((data) => window.dockerApi.terminal.write(sessionId, data))
      terminal.onResize(({ cols, rows }) => window.dockerApi.terminal.resize(sessionId, cols, rows))
    }).catch((error) => terminal.writeln(`\r\n\x1b[31m${String(error)}\x1b[0m`))

    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => { try { fit.fit() } catch {} }, 40)
    })
    ro.observe(hostRef.current)

    return () => {
      disposed = true
      ro.disconnect()
      unsubs.forEach((u) => u())
      if (sessionRef.current) window.dockerApi.terminal.close(sessionRef.current)
      sessionRef.current = null
      setConnected(false)
      terminal.dispose()
    }
  }, [containerId, shell, running, generation])

  if (!running) return <div className="empty"><div className="empty-title">Container is stopped</div><div className="muted">Start the container before opening an interactive terminal.</div></div>

  return (
    <section className="terminal-wrap">
      <div className="runtime-toolbar">
        <select value={shell} onChange={(e) => setShell(e.target.value)}>{shells.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="button secondary" onClick={() => setGeneration((x) => x + 1)}>Reconnect</button>
        <span className="stream-state">{connected ? '● Connected' : '○ Connecting / exited'}</span>
      </div>
      <div ref={hostRef} className="xterm-host" />
    </section>
  )
}
