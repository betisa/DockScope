import { randomUUID } from 'node:crypto'
import * as pty from 'node-pty'
import type { WebContents } from 'electron'

interface TerminalSession {
  terminal: pty.IPty
  ownerId: number
}

const sessions = new Map<string, TerminalSession>()
const allowedShells = new Set(['/bin/sh', '/bin/bash', 'sh', 'bash', 'pwsh', 'powershell', 'cmd'])

export const terminalService = {
  open(webContents: WebContents, containerId: string, shell: string, cols: number, rows: number) {
    if (!allowedShells.has(shell)) throw new Error('Unsupported shell.')

    const sessionId = randomUUID()
    const terminal = pty.spawn('docker', ['container', 'exec', '-it', containerId, shell], {
      name: 'xterm-256color',
      cols: Math.max(20, Math.min(cols, 400)),
      rows: Math.max(5, Math.min(rows, 200)),
      cwd: process.cwd(),
      env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>
    })

    sessions.set(sessionId, { terminal, ownerId: webContents.id })

    terminal.onData((data) => {
      if (!webContents.isDestroyed()) webContents.send(`terminal:data:${sessionId}`, data)
    })
    terminal.onExit(({ exitCode }) => {
      sessions.delete(sessionId)
      if (!webContents.isDestroyed()) webContents.send(`terminal:exit:${sessionId}`, exitCode)
    })

    return { sessionId }
  },

  write(sessionId: string, ownerId: number, data: string) {
    const session = sessions.get(sessionId)
    if (!session || session.ownerId !== ownerId) return
    session.terminal.write(data)
  },

  resize(sessionId: string, ownerId: number, cols: number, rows: number) {
    const session = sessions.get(sessionId)
    if (!session || session.ownerId !== ownerId) return
    session.terminal.resize(Math.max(20, Math.min(cols, 400)), Math.max(5, Math.min(rows, 200)))
  },

  close(sessionId: string, ownerId: number) {
    const session = sessions.get(sessionId)
    if (!session || session.ownerId !== ownerId) return
    try { session.terminal.kill() } catch { /* already exited */ }
    sessions.delete(sessionId)
  },

  closeAllForOwner(ownerId: number) {
    for (const [id, session] of sessions) {
      if (session.ownerId === ownerId) {
        try { session.terminal.kill() } catch { /* noop */ }
        sessions.delete(id)
      }
    }
  }
}
