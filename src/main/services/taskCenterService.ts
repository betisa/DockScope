import { EventEmitter } from 'node:events'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type {
  OperationTask,
  OperationTaskRequest,
  OperationTaskSummary,
  ComposeProject,
  SmartCleanupStepKey
} from '../../shared/contracts'
import { resolveCommand } from './processRunner'
import { windowsStorageService } from './windowsStorageService'
import { databaseService } from '../database/database'
import { importLegacyJson } from '../database/legacyImport'

const MAX_OUTPUT = 200_000
const MAX_HISTORY = 500

type ActiveTask = {
  process?: ChildProcessWithoutNullStreams
  cancelled?: boolean
}

function composeArgs(project: ComposeProject) {
  const args = ['compose', '-p', project.name]
  for (const file of project.configFiles.split(',').map(value => value.trim()).filter(Boolean)) {
    args.push('-f', file)
  }
  return args
}

function redactTaskOutput(value: string) {
  return value
    .replace(/((?:password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\s*[=:]\s*)([^\s"'`]+)/gi, '$1***')
    .replace(/(authorization\s*:\s*bearer\s+)([^\s"'`]+)/gi, '$1***')
    .replace(/((?:connectionstring|connection_string)\s*[=:]\s*)([^\r\n]+)/gi, '$1***')
    .replace(/((?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi, '$1***$3')
}

function boundedAppend(current: string, next: string) {
  const combined = current + redactTaskOutput(next)
  return combined.length <= MAX_OUTPUT ? combined : combined.slice(combined.length - MAX_OUTPUT)
}

function duration(task: OperationTask) {
  const start = Date.parse(task.startedAt || task.createdAt)
  const end = Date.parse(task.completedAt || new Date().toISOString())
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0
}

function inferProgress(task: OperationTask, chunk: string) {
  const text = chunk.trim()
  if (!text) return

  const buildMatch = text.match(/#(\d+)\s+(?:DONE|CACHED|ERROR|\[)/)
  if (buildMatch) {
    const step = Number(buildMatch[1])
    if (Number.isFinite(step)) {
      task.progressText = `Build step #${step}`
      task.progress = task.progress == null ? null : task.progress
      return
    }
  }

  const pullMatch = text.match(/(?:Pull complete|Download complete|Already exists|Extracting|Downloading)/i)
  if (pullMatch) {
    task.progressText = pullMatch[0]
    return
  }

  const percentage = text.match(/(\d{1,3}(?:\.\d+)?)%/)
  if (percentage) {
    const value = Math.min(100, Math.max(0, Number(percentage[1])))
    if (Number.isFinite(value)) task.progress = value
    task.progressText = text.split(/\r?\n/).at(-1)?.slice(0, 140) || task.progressText
    return
  }

  task.progressText = text.split(/\r?\n/).at(-1)?.slice(0, 140) || task.progressText
}

function formatTargetBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

function titleFor(request: OperationTaskRequest) {
  if (request.title?.trim()) return request.title.trim().slice(0, 120)
  if (request.kind === 'image-pull') return `Pull ${request.imageRef}`
  if (request.kind === 'compose-pull') return `Compose pull — ${request.project?.name ?? ''}`.trim()
  if (request.kind === 'compose-build') return `Compose build — ${request.project?.name ?? ''}`.trim()
  if (request.kind === 'compose-up') return `Compose up — ${request.project?.name ?? ''}`.trim()
  if (request.kind === 'buildkit-prune') return request.pruneAll ? 'Prune all BuildKit cache' : 'Prune BuildKit cache'
  if (request.kind === 'safe-cleanup') return request.includeUnusedImages ? 'Balanced cleanup' : 'Safe cleanup'
  if (request.kind === 'smart-cleanup') return `Smart cleanup — target ${formatTargetBytes(request.targetBytes ?? 0)}`
  if (request.kind === 'vhdx-compact') return 'Compact Docker VHDX'
  return 'Docker operation'
}

function commandFor(request: OperationTaskRequest) {
  if (request.kind === 'image-pull') {
    return { command: 'docker', args: ['image', 'pull', String(request.imageRef)], summary: `docker image pull ${request.imageRef}` }
  }

  if (request.kind === 'compose-pull' && request.project) {
    const args = [...composeArgs(request.project), 'pull']
    return { command: 'docker', args, summary: `docker ${args.join(' ')}` }
  }

  if (request.kind === 'compose-build' && request.project) {
    const args = [...composeArgs(request.project), 'build', ...(request.noCache ? ['--no-cache'] : [])]
    return { command: 'docker', args, summary: `docker ${args.join(' ')}` }
  }

  if (request.kind === 'compose-up' && request.project) {
    const args = [...composeArgs(request.project), 'up', '-d', ...(request.build ? ['--build'] : [])]
    return { command: 'docker', args, summary: `docker ${args.join(' ')}` }
  }

  if (request.kind === 'buildkit-prune') {
    const args = ['builder', 'prune', '--force']
    if (request.pruneAll) args.push('--all')
    if ((request.keepStorageGb ?? 0) > 0) args.push('--keep-storage', `${request.keepStorageGb}GB`)
    return { command: 'docker', args, summary: `docker ${args.join(' ')}` }
  }

  return null
}

class TaskCenterService extends EventEmitter {
  private tasks: OperationTask[] = []
  private active = new Map<string, ActiveTask>()
  private initialized = false

  private async ensureLoaded() {
    if (this.initialized) return
    await databaseService.initialize()

    await importLegacyJson<OperationTask[]>('operation-tasks.json', async legacy => {
      const rows = Array.isArray(legacy) ? legacy : []
      if (rows.length) {
        await databaseService.db.transaction(async trx => {
          for (const task of rows.slice(0, MAX_HISTORY)) {
            await trx('operation_tasks').insert({
              id: task.id,
              created_at: task.createdAt,
              status: task.status,
              kind: task.kind,
              payload: JSON.stringify(task)
            }).onConflict('id').ignore()
          }
        })
      }
      return rows.length
    })

    const rows = await databaseService.db('operation_tasks')
      .select('payload')
      .orderBy('created_at','desc')
      .limit(MAX_HISTORY)
    this.tasks = rows.map(row => JSON.parse(row.payload) as OperationTask)

    for (const task of this.tasks) {
      if (task.status === 'queued' || task.status === 'running') {
        task.status = 'failed'
        task.completedAt = new Date().toISOString()
        task.progressText = 'Interrupted because the application restarted.'
        task.output = boundedAppend(task.output || '', '\nTask interrupted by application restart.\n')
        task.durationMs = duration(task)
        task.cancellable = false
      }
    }

    this.initialized = true
    await this.persist()
  }

  private async persist() {
    const tasks = this.tasks.slice(0, MAX_HISTORY)
    await databaseService.db.transaction(async trx => {
      await trx('operation_tasks').delete()
      for (const task of tasks) {
        await trx('operation_tasks').insert({
          id: task.id,
          created_at: task.createdAt,
          status: task.status,
          kind: task.kind,
          payload: JSON.stringify(task)
        })
      }
    })
  }

  private notify(task: OperationTask) {
    this.emit('changed', structuredClone(task))
    void this.persistTask(task)
  }

  private async persistTask(task: OperationTask) {
    await databaseService.initialize()
    const row = {
      id: task.id,
      created_at: task.createdAt,
      status: task.status,
      kind: task.kind,
      payload: JSON.stringify(task)
    }
    await databaseService.db('operation_tasks')
      .insert(row)
      .onConflict('id')
      .merge({
        created_at: row.created_at,
        status: row.status,
        kind: row.kind,
        payload: row.payload
      })

    const stale = await databaseService.db('operation_tasks')
      .select('id')
      .orderBy('created_at','desc')
      .offset(MAX_HISTORY)

    if (stale.length) {
      await databaseService.db('operation_tasks').whereIn('id', stale.map(row => row.id)).delete()
    }
  }

  async list() {
    await this.ensureLoaded()
    return structuredClone(this.tasks)
  }

  async summary(): Promise<OperationTaskSummary> {
    await this.ensureLoaded()
    const count = (status: OperationTask['status']) => this.tasks.filter(task => task.status === status).length
    return {
      queued: count('queued'),
      running: count('running'),
      completed: count('completed'),
      failed: count('failed'),
      cancelled: count('cancelled'),
      total: this.tasks.length
    }
  }

  async enqueue(request: OperationTaskRequest) {
    await this.ensureLoaded()

    const command = commandFor(request)
    const isCleanup = request.kind === 'safe-cleanup' || request.kind === 'smart-cleanup'
    const isVhdx = request.kind === 'vhdx-compact'
    if (!command && !isCleanup && !isVhdx) throw new Error('Unsupported Task Center operation.')

    const task: OperationTask = {
      id: randomUUID(),
      kind: request.kind,
      title: titleFor(request),
      status: 'queued',
      createdAt: new Date().toISOString(),
      startedAt: '',
      completedAt: '',
      durationMs: 0,
      progress: 0,
      progressText: 'Queued',
      output: '',
      exitCode: null,
      cancellable: !isVhdx,
      cancelRequested: false,
      sourcePage: String(request.sourcePage ?? ''),
      resourceId: String(request.resourceId ?? ''),
      resourceName: String(request.resourceName ?? ''),
      commandSummary: command?.summary ?? (request.kind === 'smart-cleanup' ? `Smart cleanup plan: ${(request.cleanupSteps ?? []).join(', ')}` : isCleanup ? 'Docker safe cleanup plan' : 'Docker VHDX compaction')
    }

    this.tasks.unshift(task)
    this.tasks = this.tasks.slice(0, MAX_HISTORY)
    this.notify(task)

    queueMicrotask(() => {
      if (command) void this.runCommand(task, command.command, command.args)
      else if (request.kind === 'smart-cleanup') void this.runSmartCleanup(task, request.cleanupSteps ?? [])
      else if (isCleanup) void this.runCleanup(task, Boolean(request.includeUnusedImages))
      else void this.runVhdx(task, String(request.vhdxPath ?? ''))
    })

    return structuredClone(task)
  }

  private begin(task: OperationTask) {
    task.status = 'running'
    task.startedAt = new Date().toISOString()
    task.progressText = 'Starting…'
    task.progress = 0
    this.active.set(task.id, {})
    this.notify(task)
  }

  private finish(task: OperationTask, status: OperationTask['status'], exitCode: number | null, message?: string) {
    task.status = status
    task.exitCode = exitCode
    task.completedAt = new Date().toISOString()
    task.durationMs = duration(task)
    task.cancellable = false
    task.progress = status === 'completed' ? 100 : task.progress
    task.progressText = message || (status === 'completed' ? 'Completed' : status === 'cancelled' ? 'Cancelled' : 'Failed')
    this.active.delete(task.id)
    this.notify(task)
  }

  private async runCommand(task: OperationTask, command: string, args: string[]) {
    this.begin(task)
    const resolved = resolveCommand(command, args)
    const child = spawn(resolved.command, resolved.args, { windowsHide: true, shell: false })
    const active = this.active.get(task.id)
    if (active) active.process = child

    const onData = (chunk: Buffer | string) => {
      const text = chunk.toString()
      task.output = boundedAppend(task.output, text)
      inferProgress(task, text)
      task.durationMs = duration(task)
      this.notify(task)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)

    child.on('error', error => {
      task.output = boundedAppend(task.output, `\n${error.message}\n`)
      this.finish(task, task.cancelRequested ? 'cancelled' : 'failed', -1, task.cancelRequested ? 'Cancelled' : 'Process failed to start')
    })

    child.on('close', code => {
      if (!this.active.has(task.id)) return
      const cancelled = task.cancelRequested || this.active.get(task.id)?.cancelled
      this.finish(task, cancelled ? 'cancelled' : code === 0 ? 'completed' : 'failed', code ?? -1)
    })
  }

  private async runSmartCleanup(task: OperationTask, steps: NonNullable<OperationTaskRequest['cleanupSteps']>) {
    this.begin(task)

    const commandMap: Record<SmartCleanupStepKey, string[]> = {
      'build-cache': ['builder', 'prune', '--force'],
      'dangling-images': ['image', 'prune', '--force'],
      'stopped-containers': ['container', 'prune', '--force'],
      'unused-networks': ['network', 'prune', '--force'],
      'unused-images': ['image', 'prune', '--all', '--force']
    }
    const commands = steps.map(step => ({ step, args: commandMap[step] }))

    if (!commands.length) {
      this.finish(task, 'failed', -1, 'Smart Cleanup plan contains no executable steps.')
      return
    }

    for (let index = 0; index < commands.length; index++) {
      if (task.cancelRequested) {
        this.finish(task, 'cancelled', null)
        return
      }

      const entry = commands[index]
      task.progress = Math.round((index / commands.length) * 100)
      task.progressText = `Smart Cleanup ${index + 1}/${commands.length}: ${entry.step}`
      task.output = boundedAppend(task.output, `\n> docker ${entry.args.join(' ')}\n`)
      this.notify(task)

      const result = await this.runOne(task, 'docker', entry.args)
      if (result.cancelled) {
        this.finish(task, 'cancelled', result.exitCode)
        return
      }
      if (result.exitCode !== 0) {
        this.finish(task, 'failed', result.exitCode, `Smart Cleanup failed at ${entry.step}`)
        return
      }
    }

    this.finish(task, 'completed', 0, 'Smart Cleanup completed. Refresh storage metrics to verify actual reclaimed space.')
  }

  private async runCleanup(task: OperationTask, includeUnusedImages: boolean) {
    this.begin(task)
    const commands: string[][] = [
      ['container', 'prune', '--force'],
      ['image', 'prune', '--force'],
      ['network', 'prune', '--force'],
      ['builder', 'prune', '--force']
    ]
    if (includeUnusedImages) commands.push(['image', 'prune', '--all', '--force'])

    for (let index = 0; index < commands.length; index++) {
      if (task.cancelRequested) {
        this.finish(task, 'cancelled', null)
        return
      }
      task.progress = Math.round((index / commands.length) * 100)
      task.progressText = `Cleanup step ${index + 1} of ${commands.length}: docker ${commands[index].join(' ')}`
      this.notify(task)

      const result = await this.runOne(task, 'docker', commands[index])
      if (result.cancelled) {
        this.finish(task, 'cancelled', result.exitCode)
        return
      }
      if (result.exitCode !== 0) {
        this.finish(task, 'failed', result.exitCode, `Cleanup failed at step ${index + 1}`)
        return
      }
    }
    this.finish(task, 'completed', 0)
  }

  private runOne(task: OperationTask, command: string, args: string[]) {
    return new Promise<{ exitCode: number; cancelled: boolean }>(resolve => {
      const resolved = resolveCommand(command, args)
      const child = spawn(resolved.command, resolved.args, { windowsHide: true, shell: false })
      const active = this.active.get(task.id)
      if (active) active.process = child

      const onData = (chunk: Buffer | string) => {
        const text = chunk.toString()
        task.output = boundedAppend(task.output, text)
        inferProgress(task, text)
        task.durationMs = duration(task)
        this.notify(task)
      }
      child.stdout.on('data', onData)
      child.stderr.on('data', onData)
      child.on('error', error => {
        task.output = boundedAppend(task.output, `\n${error.message}\n`)
        resolve({ exitCode: -1, cancelled: Boolean(task.cancelRequested) })
      })
      child.on('close', code => resolve({ exitCode: code ?? -1, cancelled: Boolean(task.cancelRequested) }))
    })
  }

  private async runVhdx(task: OperationTask, vhdxPath: string) {
    this.begin(task)
    task.cancellable = false
    task.progress = null
    task.progressText = 'Compacting Docker VHDX…'
    this.notify(task)
    try {
      const result = await windowsStorageService.compactVhdx(vhdxPath)
      task.output = boundedAppend(task.output, `${result.stdout || ''}\n${result.stderr || ''}`.trim())
      this.finish(task, result.ok ? 'completed' : 'failed', result.exitCode)
    } catch (error) {
      task.output = boundedAppend(task.output, error instanceof Error ? error.message : String(error))
      this.finish(task, 'failed', -1)
    }
  }

  async cancel(id: string) {
    await this.ensureLoaded()
    const task = this.tasks.find(item => item.id === id)
    if (!task) throw new Error('Task not found.')
    if (!task.cancellable || !['queued', 'running'].includes(task.status)) return structuredClone(task)

    task.cancelRequested = true
    task.progressText = 'Cancelling…'
    const active = this.active.get(id)
    if (active) {
      active.cancelled = true
      active.process?.kill()
    } else if (task.status === 'queued') {
      this.finish(task, 'cancelled', null)
      return structuredClone(task)
    }
    this.notify(task)
    return structuredClone(task)
  }

  async clearCompleted() {
    await this.ensureLoaded()
    this.tasks = this.tasks.filter(task => task.status === 'queued' || task.status === 'running')
    await this.persist()
    this.emit('cleared')
  }
}

export const taskCenterService = new TaskCenterService()
