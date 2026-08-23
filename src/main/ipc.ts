import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { isIP } from 'node:net'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import { dockerService } from './services/dockerService'
import { windowsStorageService } from './services/windowsStorageService'
import { operationalIntelligence } from './monitoring/operationalIntelligence'
import { runtimeStreamService } from './services/runtimeStreamService'
import { terminalService } from './services/terminalService'
import { auditService } from './services/auditService'
import { applicationSettingsService } from './services/applicationSettingsService'
import { taskCenterService } from './services/taskCenterService'
import { diagnosticsBundleService } from './services/diagnosticsBundleService'
import { databaseService } from './database/database'
import { updateService } from './services/updateService'
import { aiAnalysisService } from './services/aiAnalysisService'
import { storageTrendService } from './services/storageTrendService'
import type { ComposeProject, OperationTaskRequest } from '../shared/contracts'

function safeIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Expected an array.')
  const ids = value.map(String).filter((x) => /^[a-zA-Z0-9_.:/-]+$/.test(x))
  if (ids.length !== value.length) throw new Error('Invalid Docker resource identifier.')
  return ids
}

function safeBuildRef(value: unknown) {
  const ref = String(value ?? '')
  if (!/^[a-zA-Z0-9_.:/^-]+$/.test(ref) || ref.length > 300) throw new Error('Invalid Buildx history reference.')
  return ref
}

function safePortUrl(value: unknown) {
  const raw = String(value ?? '')
  if (raw.length > 300) throw new Error('Invalid port URL.')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid port URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) endpoints can be opened.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host !== 'localhost' && isIP(host) === 0) throw new Error('Port Explorer can only open localhost or literal IP endpoints.')
  return url.toString()
}

function safeContainerFilePath(value: unknown) {
  const input = String(value ?? '').trim()
  if (!input.startsWith('/')) throw new Error('Container path must be absolute.')
  if (input.includes('\0') || input.length > 2048) throw new Error('Invalid container path.')
  const parts = input.split('/').filter(Boolean)
  if (parts.some(part => part === '..')) throw new Error('Parent traversal is not allowed.')
  return '/' + parts.join('/')
}

function containerPathMountRisk(diagnostics: Awaited<ReturnType<typeof dockerService.diagnostics>>, target: string) {
  const mount = [...diagnostics.mounts]
    .filter(item => target === item.destination || target.startsWith(`${item.destination.replace(/\/+$/, '')}/`))
    .sort((left, right) => right.destination.length - left.destination.length)[0]
  return {
    mount,
    persistent: Boolean(mount),
    writable: mount ? Boolean(mount.rw) : true
  }
}

function safePreferenceKey(value: unknown) {
  const key = String(value ?? '').trim()
  if (!/^ui\.[a-zA-Z0-9._-]{1,150}$/.test(key)) throw new Error('Invalid UI preference key.')
  return key
}

function safePreferenceValue(value: unknown) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined || serialized.length > 500_000) throw new Error('UI preference payload is invalid or too large.')
  return JSON.parse(serialized)
}

function safeSession(value: unknown) {
  const id = String(value ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid session identifier.')
  return id
}

function composeArgs(project: ComposeProject) {
  const args = ['compose', '-p', project.name]
  for (const file of project.configFiles.split(',').map((x) => x.trim()).filter(Boolean)) args.push('-f', file)
  return args
}

function safeService(value: unknown) {
  const name = String(value ?? '')
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Invalid Compose service name.')
  return name
}

function safeProject(value: unknown): ComposeProject {
  const p = value as ComposeProject
  if (!p || typeof p.name !== 'string' || typeof p.configFiles !== 'string') throw new Error('Invalid Compose project.')
  return { name: p.name, status: p.status ?? '', configFiles: p.configFiles }
}

function safeTaskRequest(value: unknown): OperationTaskRequest {
  const request = value as OperationTaskRequest
  if (!request || typeof request !== 'object') throw new Error('Invalid task request.')

  const allowed = new Set([
    'image-pull',
    'compose-pull',
    'compose-build',
    'compose-up',
    'buildkit-prune',
    'safe-cleanup',
    'smart-cleanup',
    'vhdx-compact'
  ])
  if (!allowed.has(String(request.kind))) throw new Error('Unsupported Task Center operation.')

  const safe: OperationTaskRequest = {
    kind: request.kind,
    title: request.title == null ? undefined : String(request.title).slice(0, 120),
    sourcePage: request.sourcePage == null ? undefined : String(request.sourcePage).slice(0, 80),
    resourceId: request.resourceId == null ? undefined : String(request.resourceId).slice(0, 300),
    resourceName: request.resourceName == null ? undefined : String(request.resourceName).slice(0, 300)
  }

  if (request.kind === 'image-pull') {
    const imageRef = String(request.imageRef ?? '')
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/@-]{0,299}$/.test(imageRef)) throw new Error('Invalid image reference.')
    safe.imageRef = imageRef
  }

  if (request.kind.startsWith('compose-')) {
    safe.project = safeProject(request.project)
    safe.noCache = Boolean(request.noCache)
    safe.build = Boolean(request.build)
  }

  if (request.kind === 'buildkit-prune') {
    safe.pruneAll = Boolean(request.pruneAll)
    const keep = Number(request.keepStorageGb ?? 0)
    if (!Number.isFinite(keep) || keep < 0 || keep > 10000) throw new Error('Invalid BuildKit keep-storage value.')
    safe.keepStorageGb = keep
  }

  if (request.kind === 'safe-cleanup') safe.includeUnusedImages = Boolean(request.includeUnusedImages)

  if (request.kind === 'smart-cleanup') {
    const allowedSteps = new Set([
      'stopped-containers',
      'dangling-images',
      'unused-networks',
      'build-cache',
      'unused-images'
    ])
    const steps = Array.isArray(request.cleanupSteps) ? request.cleanupSteps.map(String) : []
    if (!steps.length || steps.some(step => !allowedSteps.has(step))) throw new Error('Invalid Smart Cleanup steps.')
    safe.cleanupSteps = Array.from(new Set(steps)) as any
    const targetBytes = Number(request.targetBytes ?? 0)
    if (!Number.isFinite(targetBytes) || targetBytes <= 0 || targetBytes > 100 * 1000 ** 4) throw new Error('Invalid Smart Cleanup target.')
    safe.targetBytes = targetBytes
  }

  if (request.kind === 'vhdx-compact') {
    const vhdxPath = String(request.vhdxPath ?? '')
    if (!vhdxPath || vhdxPath.length > 1000 || !/\.vhdx$/i.test(vhdxPath)) throw new Error('Invalid VHDX path.')
    safe.vhdxPath = vhdxPath
  }

  return safe
}

export function registerIpc() {
  const broadcastTask = (task: unknown) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('tasks:changed', task)
    }
  }
  const broadcastClear = () => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('tasks:cleared')
    }
  }
  taskCenterService.on('changed', broadcastTask)
  taskCenterService.on('cleared', broadcastClear)
  const broadcastUpdate = (state: unknown) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('updates:changed', state)
    }
  }
  updateService.on('changed', broadcastUpdate)


  ipcMain.handle('diagnostics:export-bundle', async () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    const defaultPath = path.join(app.getPath('downloads'), `DockScope-Diagnostics-${stamp}.zip`)
    const selection = await dialog.showSaveDialog({
      title: 'Export DockScope Diagnostics Bundle',
      defaultPath,
      filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    if (selection.canceled || !selection.filePath) {
      return { ok:false, message:'Diagnostics bundle export cancelled.' }
    }
    const target = selection.filePath.toLowerCase().endsWith('.zip') ? selection.filePath : `${selection.filePath}.zip`
    return diagnosticsBundleService.exportTo(target)
  })

  ipcMain.handle('tasks:list', () => taskCenterService.list())
  ipcMain.handle('tasks:summary', () => taskCenterService.summary())
  ipcMain.handle('tasks:enqueue', (_, request) => taskCenterService.enqueue(safeTaskRequest(request)))
  ipcMain.handle('tasks:cancel', (_, id) => taskCenterService.cancel(safeSession(id)))
  ipcMain.handle('tasks:clear-completed', () => taskCenterService.clearCompleted())
  ipcMain.handle('about:runtime', () => updateService.runtimeInfo())
  ipcMain.handle('about:release-notes', () => updateService.releaseNotes())
  ipcMain.handle('updates:state', () => updateService.getState())
  ipcMain.handle('updates:check', () => updateService.check())
  ipcMain.handle('updates:download', () => updateService.download())
  ipcMain.handle('updates:install', () => updateService.install())
  ipcMain.handle('updates:set-channel', (_, channel) => {
    const value = String(channel)
    if (value !== 'stable' && value !== 'preview') throw new Error('Invalid release channel.')
    return updateService.setChannel(value)
  })
  ipcMain.handle('engine:status', () => dockerService.engineStatus())
  ipcMain.handle('disk:usage', () => dockerService.diskUsage())
  ipcMain.handle('storage:trends', (_, range) => {
    const value = String(range)
    const safeRange = value === '7d' || value === '30d' ? value : '24h'
    return storageTrendService.trends(safeRange)
  })
  ipcMain.handle('storage:sample-now', () => storageTrendService.sampleNow())


  ipcMain.handle('containers:list', () => dockerService.containers())
  ipcMain.handle('ports:list', () => dockerService.portExplorer())
  ipcMain.handle('graph:dependencies', () => dockerService.resourceDependencyGraph())
  ipcMain.handle('ports:open', (_, url) => shell.openExternal(safePortUrl(url)))
  ipcMain.handle('containers:start', (_, ids) => dockerService.containerAction('start', safeIds(ids)))
  ipcMain.handle('containers:stop', (_, ids, timeout) => dockerService.stopContainers(safeIds(ids), Math.min(Math.max(Number(timeout) || 10, 1), 120)))
  ipcMain.handle('containers:restart', (_, ids) => dockerService.containerAction('restart', safeIds(ids)))
  ipcMain.handle('containers:remove', async (_, ids, force) => { const safe=safeIds(ids); const snaps=await Promise.all(safe.map(x=>auditService.containerSnapshot(x))); return auditService.record({operation:'Remove container',category:'container',severity:'critical',resourceType:'container',resourceIds:safe,commandSummary:`docker container rm ${Boolean(force)?'--force ':''}${safe.join(' ')}`,snapshotIds:snaps.map(x=>x.id)},()=>dockerService.removeContainers(safe,Boolean(force))) })
  ipcMain.handle('containers:logs', (_, id, tail) => dockerService.logs(safeIds([id])[0], Number(tail) || 300))
  ipcMain.handle('containers:inspect', (_, id) => dockerService.inspect(safeIds([id])[0]))
  ipcMain.handle('containers:diagnostics', (_, id) => dockerService.diagnostics(safeIds([id])[0]))
  ipcMain.handle('containers:advisor', (_, id) => dockerService.containerAdvisor(safeIds([id])[0]))
  ipcMain.handle('containers:processes', (_, id) => dockerService.processes(safeIds([id])[0]))
  ipcMain.handle('containers:stats', (_, id) => dockerService.stats(safeIds([id])[0]))
  ipcMain.handle('containers:exec', (_, id, command) => {
    if (!Array.isArray(command) || command.length === 0 || command.length > 32) throw new Error('Invalid command.')
    return dockerService.exec(safeIds([id])[0], command.map(String))
  })

  ipcMain.handle('containers:files:list', (_, id, containerPath) =>
    dockerService.listContainerFiles(safeIds([id])[0], safeContainerFilePath(containerPath))
  )
  ipcMain.handle('containers:files:read-text', (_, id, containerPath) =>
    dockerService.readContainerText(safeIds([id])[0], safeContainerFilePath(containerPath))
  )

  ipcMain.handle('containers:files:download', async (_, id, containerPath) => {
    const containerId = safeIds([id])[0]
    const sourcePath = safeContainerFilePath(containerPath)
    const filename = path.posix.basename(sourcePath) || 'container-file'
    const selection = await dialog.showSaveDialog({
      title: 'Download file from container',
      defaultPath: path.join(app.getPath('downloads'), filename),
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    if (selection.canceled || !selection.filePath) return { ok:false, message:'Download cancelled.' }

    const result = await auditService.record({
      operation:'Download container file',
      category:'container',
      severity:'info',
      resourceType:'container-file',
      resourceIds:[containerId],
      commandSummary:`docker cp ${containerId}:${sourcePath} <selected destination>`
    }, () => dockerService.copyFromContainer(containerId, sourcePath, selection.filePath!))
    return {
      ok: result.ok,
      path: result.ok ? selection.filePath : undefined,
      message: result.ok ? `Downloaded ${filename}.` : (result.stderr || 'Download failed.')
    }
  })

  ipcMain.handle('containers:files:upload', async (_, id, destinationDirectory) => {
    const containerId = safeIds([id])[0]
    const targetDirectory = safeContainerFilePath(destinationDirectory)
    const diagnostics = await dockerService.diagnostics(containerId)

    const selection = await dialog.showOpenDialog({
      title: 'Upload file to container',
      properties: ['openFile']
    })
    if (selection.canceled || !selection.filePaths[0]) return { ok:false, message:'Upload cancelled.' }

    const sourcePath = selection.filePaths[0]
    const stat = await fs.stat(sourcePath)
    const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
    if (!stat.isFile()) throw new Error('Only regular files can be uploaded.')
    if (stat.size > MAX_UPLOAD_BYTES) throw new Error('Upload exceeds the 100 MB safety limit.')

    const filename = path.basename(sourcePath)
    const requestedDestination = targetDirectory === '/' ? `/${filename}` : `${targetDirectory}/${filename}`
    const destination = await dockerService.resolveContainerPath(containerId, requestedDestination)
    const risk = containerPathMountRisk(diagnostics, destination)
    if (risk.mount && !risk.writable) throw new Error('Upload is blocked because the resolved destination is inside a read-only mount.')

    const persistence = risk.persistent
      ? `The destination is inside ${risk.mount?.type ?? 'a'} mount ${risk.mount?.destination}. This can modify persistent data.`
      : 'The destination is in the container writable layer. The change may disappear when the container is recreated.'

    const confirmation = await dialog.showMessageBox({
      type:'warning',
      buttons:['Cancel','Upload file'],
      defaultId:0,
      cancelId:0,
      noLink:true,
      title:'Confirm guarded container upload',
      message:`Upload ${filename} to ${destination}?`,
      detail:`${persistence}\n\nSize: ${stat.size.toLocaleString()} bytes\nContainer: ${diagnostics.name || containerId}\n\nExisting files with the same name may be overwritten.`
    })
    if (confirmation.response !== 1) return { ok:false, message:'Upload cancelled.' }

    const result = await auditService.record({
      operation:'Upload container file',
      category:'container',
      severity:risk.persistent ? 'critical' : 'warning',
      resourceType:'container-file',
      resourceIds:[containerId],
      commandSummary:`docker cp <selected source> ${containerId}:${destination}`
    }, () => dockerService.copyToContainer(containerId, sourcePath, destination))
    return {
      ok: result.ok,
      message: result.ok ? `Uploaded ${filename} to ${destination}.` : (result.stderr || 'Upload failed.'),
      bytes: stat.size
    }
  })

  ipcMain.handle('containers:files:write-text', async (_, id, containerPath, content) => {
    const containerId = safeIds([id])[0]
    const requestedTarget = safeContainerFilePath(containerPath)
    const text = String(content ?? '')
    const bytes = Buffer.byteLength(text, 'utf8')
    const MAX_WRITE_BYTES = 1_000_000
    if (bytes > MAX_WRITE_BYTES) throw new Error('Text save exceeds the 1 MB safety limit.')

    const diagnostics = await dockerService.diagnostics(containerId)
    const target = await dockerService.resolveContainerPath(containerId, requestedTarget)
    const risk = containerPathMountRisk(diagnostics, target)
    if (risk.mount && !risk.writable) throw new Error('Text save is blocked because the resolved file is inside a read-only mount.')

    const persistence = risk.persistent
      ? `This file is inside ${risk.mount?.type ?? 'a'} mount ${risk.mount?.destination}; saving can change persistent application data.`
      : 'This file is in the container writable layer and may be lost when the container is recreated.'

    const confirmation = await dialog.showMessageBox({
      type:'warning',
      buttons:['Cancel','Save text'],
      defaultId:0,
      cancelId:0,
      noLink:true,
      title:'Confirm guarded container write',
      message:`Overwrite ${target}?`,
      detail:`${persistence}\n\nUTF-8 size: ${bytes.toLocaleString()} bytes\nContainer: ${diagnostics.name || containerId}\n\nThe existing file will be replaced.`
    })
    if (confirmation.response !== 1) return { ok:false, message:'Text save cancelled.' }

    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsm-container-write-'))
    const tempFile = path.join(tempDirectory, 'content.txt')
    try {
      await fs.writeFile(tempFile, text, 'utf8')
      const result = await auditService.record({
        operation:'Write container text file',
        category:'container',
        severity:risk.persistent ? 'critical' : 'warning',
        resourceType:'container-file',
        resourceIds:[containerId],
        commandSummary:`docker cp <temporary text> ${containerId}:${target}`
      }, () => dockerService.copyToContainer(containerId, tempFile, target))
      return {
        ok: result.ok,
        message: result.ok ? `Saved ${target}.` : (result.stderr || 'Text save failed.'),
        bytes
      }
    } finally {
      await fs.rm(tempDirectory, { recursive:true, force:true }).catch(() => undefined)
    }
  })


  ipcMain.handle('streams:container-logs', (event, id, tail) => runtimeStreamService.start(event.sender, [
    'container', 'logs', '--follow', '--timestamps', '--tail', String(Math.min(Math.max(Number(tail) || 300, 0), 5000)), safeIds([id])[0]
  ]))
  ipcMain.handle('streams:container-stats', (event, id) => runtimeStreamService.start(event.sender, [
    'stats', '--format', '{{json .}}', safeIds([id])[0]
  ]))
  ipcMain.handle('streams:compose-logs', (event, p, services, tail) => {
    const project = safeProject(p)
    const selected = Array.isArray(services) ? services.map((x) => String(x)).filter((x) => /^[a-zA-Z0-9_.-]+$/.test(x)) : []
    return runtimeStreamService.start(event.sender, [...composeArgs(project), 'logs', '--follow', '--timestamps', '--tail', String(Math.min(Math.max(Number(tail) || 300, 0), 5000)), ...selected])
  })
  ipcMain.handle('streams:compose-stats', (event, p, services) => {
    const project = safeProject(p)
    const selected = Array.isArray(services) ? services.map((x) => String(x)).filter((x) => /^[a-zA-Z0-9_.-]+$/.test(x)) : []
    return runtimeStreamService.start(event.sender, [...composeArgs(project), 'stats', '--format', 'json', ...selected])
  })
  ipcMain.handle('streams:docker-events', (event, type) => {
    const args = ['events', '--format', '{{json .}}']
    const allowed = new Set(['container', 'image', 'volume', 'network', 'daemon', 'service'])
    if (type && allowed.has(String(type))) args.push('--filter', `type=${String(type)}`)
    return runtimeStreamService.start(event.sender, args)
  })
  ipcMain.handle('streams:stop', (event, sessionId) => runtimeStreamService.stop(safeSession(sessionId), event.sender.id))

  ipcMain.handle('terminal:open', (event, id, shell, cols, rows) => terminalService.open(
    event.sender, safeIds([id])[0], String(shell), Number(cols) || 100, Number(rows) || 30
  ))
  ipcMain.handle('terminal:write', (event, sessionId, data) => terminalService.write(safeSession(sessionId), event.sender.id, String(data)))
  ipcMain.handle('terminal:resize', (event, sessionId, cols, rows) => terminalService.resize(safeSession(sessionId), event.sender.id, Number(cols), Number(rows)))
  ipcMain.handle('terminal:close', (event, sessionId) => terminalService.close(safeSession(sessionId), event.sender.id))

  ipcMain.handle('compose:list', () => dockerService.composeProjects())
  ipcMain.handle('compose:start', (_, p) => dockerService.composeAction(safeProject(p), 'start'))
  ipcMain.handle('compose:stop', (_, p) => dockerService.composeAction(safeProject(p), 'stop'))
  ipcMain.handle('compose:restart', (_, p) => dockerService.composeAction(safeProject(p), 'restart'))
  ipcMain.handle('compose:down', async (_, p, volumes) => { const project=safeProject(p); const snap=await auditService.composeSnapshot(project); return auditService.record({operation:Boolean(volumes)?'Compose down + volumes':'Compose down',category:'compose',severity:Boolean(volumes)?'critical':'warning',resourceType:'compose',resourceIds:[project.name],resourceNames:[project.name],commandSummary:`docker compose down${Boolean(volumes)?' --volumes':''}`,snapshotIds:[snap.id]},()=>dockerService.composeDown(project,Boolean(volumes))) })
  ipcMain.handle('compose:logs', (_, p, tail) => dockerService.composeLogs(safeProject(p), Number(tail) || 500))
  ipcMain.handle('compose:services', (_, p) => dockerService.composeServices(safeProject(p)))
  ipcMain.handle('compose:workspace', (_, p) => dockerService.composeWorkspace(safeProject(p)))
  ipcMain.handle('compose:service-start', (_, p, service) => dockerService.composeServiceAction(safeProject(p), safeService(service), 'start'))
  ipcMain.handle('compose:service-stop', (_, p, service) => dockerService.composeServiceAction(safeProject(p), safeService(service), 'stop'))
  ipcMain.handle('compose:service-restart', (_, p, service) => dockerService.composeServiceAction(safeProject(p), safeService(service), 'restart'))
  ipcMain.handle('compose:pull', (_, p) => dockerService.composePull(safeProject(p)))
  ipcMain.handle('compose:build', (_, p, noCache) => dockerService.composeBuild(safeProject(p), Boolean(noCache)))
  ipcMain.handle('compose:up', (_, p, build) => dockerService.composeUp(safeProject(p), Boolean(build)))
  ipcMain.handle('compose:config-validate', (_, p, content, filePath) => dockerService.composeValidate(safeProject(p), content == null ? undefined : String(content), filePath == null ? undefined : String(filePath)))
  ipcMain.handle('compose:read-file', (_, p, filePath) => dockerService.composeReadFile(safeProject(p), filePath == null ? undefined : String(filePath)))
  ipcMain.handle('compose:save-file', (_, p, filePath, content, expected) => dockerService.composeSaveFile(safeProject(p), String(filePath), String(content), String(expected)))

  ipcMain.handle('images:list', () => dockerService.images())
  ipcMain.handle('images:remove', async (_, ids, force) => { const safe=safeIds(ids); const snaps=await Promise.all(safe.map(x=>auditService.imageSnapshot(x))); return auditService.record({operation:'Remove image',category:'image',severity:'critical',resourceType:'image',resourceIds:safe,commandSummary:`docker image rm ${Boolean(force)?'--force ':''}${safe.join(' ')}`,snapshotIds:snaps.map(x=>x.id)},()=>dockerService.removeImages(safe,Boolean(force))) })
  ipcMain.handle('images:prune', async (_, all) => auditService.record({operation:Boolean(all)?'Prune all unused images':'Prune dangling images',category:'cleanup',severity:Boolean(all)?'critical':'warning',resourceType:'image',resourceIds:[],commandSummary:`docker image prune ${Boolean(all)?'--all ':''}--force`,beforeReclaimable:(await dockerService.diskUsage()).find(x=>/images/i.test(x.type))?.reclaimable},()=>dockerService.pruneImages(Boolean(all))))

  ipcMain.handle('volumes:list', () => dockerService.volumes())
  ipcMain.handle('volumes:intelligence', () => dockerService.volumeIntelligence())
  ipcMain.handle('volumes:remove', async (_, names, force) => { const safe=safeIds(names); const snaps=await Promise.all(safe.map(x=>auditService.volumeSnapshot(x))); return auditService.record({operation:'Remove volume',category:'volume',severity:'critical',resourceType:'volume',resourceIds:safe,commandSummary:`docker volume rm ${Boolean(force)?'--force ':''}${safe.join(' ')}`,snapshotIds:snaps.map(x=>x.id)},()=>dockerService.removeVolumes(safe,Boolean(force))) })
  ipcMain.handle('volumes:prune', async (_, all) => auditService.record({operation:Boolean(all)?'Prune all unused volumes':'Prune anonymous volumes',category:'volume',severity:'critical',resourceType:'volume',resourceIds:[],commandSummary:`docker volume prune ${Boolean(all)?'--all ':''}--force`,beforeReclaimable:(await dockerService.diskUsage()).find(x=>/volume/i.test(x.type))?.reclaimable},()=>dockerService.pruneVolumes(Boolean(all))))

  ipcMain.handle('networks:list', () => dockerService.networks())
  ipcMain.handle('networks:prune', () => auditService.record({operation:'Prune unused networks',category:'network',severity:'warning',resourceType:'network',resourceIds:[],commandSummary:'docker network prune --force'},()=>dockerService.pruneNetworks()))

  ipcMain.handle('cleanup:advisor', () => dockerService.cleanupAdvisor())
  ipcMain.handle('cleanup:plan', (_, targetBytes) => {
    const value = Number(targetBytes)
    if (!Number.isFinite(value) || value <= 0 || value > 100 * 1000 ** 4) throw new Error('Invalid cleanup target.')
    return dockerService.smartCleanupPlan(value)
  })
  ipcMain.handle('cleanup:safe', async (_, includeUnusedImages) => auditService.record({operation:Boolean(includeUnusedImages)?'Balanced cleanup':'Safe cleanup',category:'cleanup',severity:Boolean(includeUnusedImages)?'critical':'warning',resourceType:'cleanup',resourceIds:[],commandSummary:Boolean(includeUnusedImages)?'safe cleanup + unused images':'safe cleanup (volumes excluded)',beforeReclaimable:(await dockerService.diskUsage()).map(x=>`${x.type}:${x.reclaimable}`).join(' | ')},()=>dockerService.safeCleanup(Boolean(includeUnusedImages))))


  ipcMain.handle('buildkit:builders', () => dockerService.builders())
  ipcMain.handle('buildkit:history', () => dockerService.buildHistory())
  ipcMain.handle('buildkit:diagnostics', (_, ref) => dockerService.buildDiagnostics(safeBuildRef(ref)))
  ipcMain.handle('buildkit:open', (_, ref) => dockerService.openBuildHistory(safeBuildRef(ref)))
  ipcMain.handle('ai:settings', () => aiAnalysisService.getSettings())
  ipcMain.handle('ai:save-settings', (_, settings) => aiAnalysisService.saveSettings(settings))
  ipcMain.handle('ai:test-connection', (_, settings) => aiAnalysisService.testConnection(settings))
  ipcMain.handle('ai:build-error-analysis', (_, ref) => aiAnalysisService.analyzeBuildError(safeBuildRef(ref)))
  ipcMain.handle('ai:container-failure-analysis', (_, id) => aiAnalysisService.analyzeContainerFailure(safeIds([id])[0]))

  ipcMain.handle('buildkit:du', () => dockerService.buildCacheDiskUsage())
  ipcMain.handle('buildkit:prune', async (_, all, keepStorageGb) => auditService.record({operation:Boolean(all)?'Prune all build cache':'Prune build cache',category:'buildkit',severity:Boolean(all)?'critical':'warning',resourceType:'buildkit',resourceIds:[],commandSummary:`docker builder prune ${Boolean(all)?'--all ':''}--force`,beforeReclaimable:(await dockerService.diskUsage()).find(x=>/build cache/i.test(x.type))?.reclaimable},()=>dockerService.pruneBuildCache(Boolean(all),Math.max(0,Number(keepStorageGb)||0))))
  ipcMain.handle('image-insights:history', (_, imageId) => dockerService.imageHistory(safeIds([imageId])[0]))
  ipcMain.handle('image-insights:analyze', (_, imageId) => dockerService.analyzeImage(safeIds([imageId])[0]))

  ipcMain.handle('monitoring:health', () => operationalIntelligence.getHealth())
  ipcMain.handle('monitoring:notifications', () => operationalIntelligence.listNotifications())
  ipcMain.handle('monitoring:mark-read', (_, ids) => operationalIntelligence.markRead(safeIds(ids)))
  ipcMain.handle('monitoring:clear', () => operationalIntelligence.clear())
  ipcMain.handle('monitoring:settings', () => operationalIntelligence.getSettings())
  ipcMain.handle('monitoring:save-settings', (_, settings) => operationalIntelligence.saveSettings(settings))
  ipcMain.handle('monitoring:refresh', () => operationalIntelligence.refresh())

  ipcMain.handle('audit:list', () => auditService.list())
  ipcMain.handle('audit:summary', () => auditService.summary())
  ipcMain.handle('audit:snapshots', () => auditService.snapshots())
  ipcMain.handle('audit:snapshot', (_, id) => auditService.snapshot(String(id)))
  ipcMain.handle('audit:clear', () => auditService.clear())
  ipcMain.handle('audit:export', () => auditService.exportReport())


  ipcMain.handle('preferences:get', (_, key) =>
    databaseService.getState(safePreferenceKey(key))
  )
  ipcMain.handle('preferences:set', (_, key, value) =>
    databaseService.setState(safePreferenceKey(key), safePreferenceValue(value))
  )
  ipcMain.handle('preferences:remove', (_, key) =>
    databaseService.removeState(safePreferenceKey(key))
  )

  ipcMain.handle('settings:get', () => applicationSettingsService.get())
  ipcMain.handle('settings:profiles', () => applicationSettingsService.profiles())
  ipcMain.handle('settings:save', async (_, settings) => {
    const saved = await applicationSettingsService.save(settings)
    await operationalIntelligence.saveSettings({
      ...operationalIntelligence.getSettings(),
      enabled: saved.monitoring.enabled,
      nativeNotifications: saved.notifications.nativeNotifications,
      unhealthyAlerts: saved.monitoring.unhealthyAlerts,
      unexpectedExitAlerts: saved.monitoring.unexpectedExitAlerts,
      restartLoopAlerts: saved.monitoring.restartLoopAlerts,
      storageAlerts: saved.monitoring.storageAlerts,
      buildCacheAlerts: saved.monitoring.buildCacheAlerts,
      vhdxWarningGb: saved.monitoring.vhdxWarningGb,
      buildCacheWarningGb: saved.monitoring.buildCacheWarningGb,
      pollIntervalSeconds: saved.monitoring.pollIntervalSeconds
    })
    return saved
  })
  ipcMain.handle('settings:apply-profile', async (_, profileId) => {
    const saved = await applicationSettingsService.applyProfile(String(profileId) as any)
    await operationalIntelligence.saveSettings({
      ...operationalIntelligence.getSettings(),
      enabled: saved.monitoring.enabled,
      nativeNotifications: saved.notifications.nativeNotifications,
      unhealthyAlerts: saved.monitoring.unhealthyAlerts,
      unexpectedExitAlerts: saved.monitoring.unexpectedExitAlerts,
      restartLoopAlerts: saved.monitoring.restartLoopAlerts,
      storageAlerts: saved.monitoring.storageAlerts,
      buildCacheAlerts: saved.monitoring.buildCacheAlerts,
      vhdxWarningGb: saved.monitoring.vhdxWarningGb,
      buildCacheWarningGb: saved.monitoring.buildCacheWarningGb,
      pollIntervalSeconds: saved.monitoring.pollIntervalSeconds
    })
    return saved
  })
  ipcMain.handle('settings:reset', async () => {
    const saved = await applicationSettingsService.reset()
    await operationalIntelligence.saveSettings({
      ...operationalIntelligence.getSettings(),
      enabled: saved.monitoring.enabled,
      nativeNotifications: saved.notifications.nativeNotifications,
      unhealthyAlerts: saved.monitoring.unhealthyAlerts,
      unexpectedExitAlerts: saved.monitoring.unexpectedExitAlerts,
      restartLoopAlerts: saved.monitoring.restartLoopAlerts,
      storageAlerts: saved.monitoring.storageAlerts,
      buildCacheAlerts: saved.monitoring.buildCacheAlerts,
      vhdxWarningGb: saved.monitoring.vhdxWarningGb,
      buildCacheWarningGb: saved.monitoring.buildCacheWarningGb,
      pollIntervalSeconds: saved.monitoring.pollIntervalSeconds
    })
    return saved
  })

  ipcMain.handle('storage:find-vhdx', () => windowsStorageService.findVhdx())
  ipcMain.handle('storage:compact', async (_, vhdxPath) => auditService.record({operation:'Compact Docker VHDX',category:'storage',severity:'critical',resourceType:'storage',resourceIds:[String(vhdxPath)],resourceNames:[String(vhdxPath)],commandSummary:'Stop Docker + wsl --shutdown + Optimize-VHD/diskpart'},()=>windowsStorageService.compactVhdx(String(vhdxPath))))
}

export function cleanupOwnerSessions(ownerId: number) {
  runtimeStreamService.stopAllForOwner(ownerId)
  terminalService.closeAllForOwner(ownerId)
}
