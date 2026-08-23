import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.06 Operation Task Center', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/taskCenterService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/TaskCenterPage.tsx', 'utf8')
  const nav = readFileSync('src/renderer/src/navigation.ts', 'utf8')
  const compose = readFileSync('src/renderer/src/components/ComposeWorkspace.tsx', 'utf8')
  const buildkit = readFileSync('src/renderer/src/pages/BuildKitPage.tsx', 'utf8')
  const cleanup = readFileSync('src/renderer/src/pages/CleanupPage.tsx', 'utf8')
  const storage = readFileSync('src/renderer/src/pages/StoragePage.tsx', 'utf8')

  it('defines typed task requests, statuses and persisted task records', () => {
    expect(contracts).toContain('export type OperationTaskKind')
    expect(contracts).toContain("'queued' | 'running' | 'completed' | 'failed' | 'cancelled'")
    expect(contracts).toContain('export type OperationTaskRequest')
    expect(contracts).toContain('export type OperationTask')
  })

  it('runs tasks in Electron Main using an allowlisted operation mapping', () => {
    expect(service).toContain('class TaskCenterService extends EventEmitter')
    expect(service).toContain("if (request.kind === 'image-pull')")
    expect(service).toContain("if (request.kind === 'compose-build'")
    expect(service).toContain("if (request.kind === 'buildkit-prune')")
    expect(service).not.toContain('request.command')
    expect(service).toContain('shell: false')
  })

  it('bounds and redacts output before persistent storage', () => {
    expect(service).toContain('const MAX_OUTPUT = 200_000')
    expect(service).toContain('const MAX_HISTORY = 500')
    expect(service).toContain('function redactTaskOutput')
    expect(service).toContain("authorization")
    expect(service).toContain("connectionstring")
    expect(service).toContain("databaseService.db('operation_tasks')")
    expect(service).toContain(".onConflict('id')")
  })

  it('supports event-driven updates and cancellation through preload IPC', () => {
    expect(ipc).toContain("ipcMain.handle('tasks:enqueue'")
    expect(ipc).toContain("ipcMain.handle('tasks:cancel'")
    expect(ipc).toContain("webContents.send('tasks:changed'")
    expect(preload).toContain("ipcRenderer.on('tasks:changed'")
    expect(service).toContain('active.process?.kill()')
  })

  it('does not make disruptive VHDX compaction cancellable', () => {
    expect(service).toContain("const isVhdx = request.kind === 'vhdx-compact'")
    expect(service).toContain('cancellable: !isVhdx')
    expect(page).toContain('VHDX Compact')
  })

  it('provides task launcher, search, pagination, filters, progress and output', () => {
    expect(page).toContain('Operation launcher')
    expect(page).toContain('<ListControls')
    expect(page).toContain('pageSize: 10')
    expect(page).toContain('Status')
    expect(page).toContain('Task output')
    expect(page).toContain('task-progress-track')
    expect(page).toContain("window.dockerApi.tasks.cancel")
  })

  it('routes long-running resource actions through Task Center', () => {
    expect(compose).toContain("kind:'compose-pull'")
    expect(compose).toContain("kind:'compose-build'")
    expect(compose).toContain("kind:'compose-up'")
    expect(buildkit).toContain("kind:'buildkit-prune'")
    expect(cleanup).toContain("kind: 'smart-cleanup'")
    expect(storage).toMatch(/kind:\s*'vhdx-compact'/)
  })

  it('registers Task Center as an Overview page', () => {
    expect(nav).toContain("id: 'tasks'")
    expect(nav).toContain("label: 'Task Center'")
  })
})
