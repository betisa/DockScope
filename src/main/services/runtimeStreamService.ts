import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import type { WebContents } from 'electron'

type RuntimeStreamProcess = ChildProcessByStdio<null, Readable, Readable>

interface StreamSession {
  process: RuntimeStreamProcess
  ownerId: number
}

const sessions = new Map<string, StreamSession>()

function safeKill(child: RuntimeStreamProcess) {
  if (child.killed) return
  try { child.kill() } catch { /* already gone */ }
}

export const runtimeStreamService = {
  start(webContents: WebContents, args: string[]) {
    const sessionId = randomUUID()
    const child = spawn('docker', args, {
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    sessions.set(sessionId, { process: child, ownerId: webContents.id })

    child.stdout.on('data', (chunk) => {
      if (!webContents.isDestroyed()) webContents.send(`stream:data:${sessionId}`, chunk.toString())
    })
    child.stderr.on('data', (chunk) => {
      if (!webContents.isDestroyed()) webContents.send(`stream:error:${sessionId}`, chunk.toString())
    })
    child.on('error', (error) => {
      if (!webContents.isDestroyed()) webContents.send(`stream:error:${sessionId}`, error.message)
    })
    child.on('close', (code) => {
      sessions.delete(sessionId)
      if (!webContents.isDestroyed()) webContents.send(`stream:exit:${sessionId}`, code)
    })

    return { sessionId }
  },

  stop(sessionId: string, ownerId: number) {
    const session = sessions.get(sessionId)
    if (!session || session.ownerId !== ownerId) return
    safeKill(session.process)
    sessions.delete(sessionId)
  },

  stopAllForOwner(ownerId: number) {
    for (const [id, session] of sessions) {
      if (session.ownerId === ownerId) {
        safeKill(session.process)
        sessions.delete(id)
      }
    }
  }
}
