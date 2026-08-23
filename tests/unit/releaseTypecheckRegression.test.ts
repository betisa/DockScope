import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('release strict TypeScript regressions', () => {
  const docker = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const streams = readFileSync('src/main/services/runtimeStreamService.ts', 'utf8')
  const tasks = readFileSync('src/main/services/taskCenterService.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const taskPage = readFileSync('src/renderer/src/pages/TaskCenterPage.tsx', 'utf8')
  const assets = readFileSync('src/renderer/src/assets.d.ts', 'utf8')

  it('types container health log callbacks explicitly', () => {
    expect(docker).toContain('(item: HealthLogEntry)')
  })

  it('models docker streams with ignored stdin and piped stdout/stderr', () => {
    expect(streams).toContain('ChildProcessByStdio<null, Readable, Readable>')
    expect(streams).toContain("stdio: ['ignore', 'pipe', 'pipe']")
  })

  it('keeps Smart Cleanup keys strongly typed', () => {
    expect(tasks).toContain('Record<SmartCleanupStepKey, string[]>')
    expect(tasks).not.toContain("entry is { step: string; args: string[] }")
  })

  it('types Task Center IPC change events', () => {
    expect(preload).toContain('_event: Electron.IpcRendererEvent')
    expect(preload).toContain('task: OperationTask')
  })

  it('handles VHDX discovery as a collection', () => {
    expect(taskPage).toContain('const first = info[0]')
    expect(taskPage).toContain("if (!first) throw new Error('Docker Desktop VHDX was not found.')")
  })

  it('declares renderer graphic asset modules', () => {
    expect(existsSync('src/renderer/src/assets.d.ts')).toBe(true)
    expect(assets).toContain("declare module '*.png'")
    expect(assets).toContain("declare module '*.svg'")
  })
})
