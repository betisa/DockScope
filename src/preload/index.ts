import { contextBridge, ipcRenderer } from 'electron'
import type { DockerApi, OperationTask } from '../shared/contracts'

function subscribe(channel: string, callback: (value: any) => void) {
  const handler = (_event: Electron.IpcRendererEvent, value: any) => callback(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: DockerApi = {
  engine: { status: () => ipcRenderer.invoke('engine:status') },
  disk: { usage: () => ipcRenderer.invoke('disk:usage') },
  containers: {
    list: () => ipcRenderer.invoke('containers:list'),
    start: (ids) => ipcRenderer.invoke('containers:start', ids),
    stop: (ids, timeout) => ipcRenderer.invoke('containers:stop', ids, timeout),
    restart: (ids) => ipcRenderer.invoke('containers:restart', ids),
    remove: (ids, force) => ipcRenderer.invoke('containers:remove', ids, force),
    logs: (id, tail) => ipcRenderer.invoke('containers:logs', id, tail),
    inspect: (id) => ipcRenderer.invoke('containers:inspect', id),
    diagnostics: (id) => ipcRenderer.invoke('containers:diagnostics', id),
    advisor: (id) => ipcRenderer.invoke('containers:advisor', id),
    processes: (id) => ipcRenderer.invoke('containers:processes', id),
    stats: (id) => ipcRenderer.invoke('containers:stats', id),
    exec: (id, command) => ipcRenderer.invoke('containers:exec', id, command),
    files: {
      list: (id, path) => ipcRenderer.invoke('containers:files:list', id, path),
      readText: (id, path) => ipcRenderer.invoke('containers:files:read-text', id, path),
      download: (id, path) => ipcRenderer.invoke('containers:files:download', id, path),
      upload: (id, destinationDirectory) => ipcRenderer.invoke('containers:files:upload', id, destinationDirectory),
      writeText: (id, path, content) => ipcRenderer.invoke('containers:files:write-text', id, path, content)
    }
  },
  ports: {
    list: () => ipcRenderer.invoke('ports:list'),
    open: (url) => ipcRenderer.invoke('ports:open', url)
  },
  graph: {
    dependencies: () => ipcRenderer.invoke('graph:dependencies')
  },
  diagnosticsBundle: {
    export: () => ipcRenderer.invoke('diagnostics:export-bundle')
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    summary: () => ipcRenderer.invoke('tasks:summary'),
    enqueue: (request) => ipcRenderer.invoke('tasks:enqueue', request),
    cancel: (id) => ipcRenderer.invoke('tasks:cancel', id),
    clearCompleted: () => ipcRenderer.invoke('tasks:clear-completed'),
    onChanged: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, task: OperationTask) => callback(task)
      ipcRenderer.on('tasks:changed', handler)
      return () => ipcRenderer.removeListener('tasks:changed', handler)
    }
  },
  streams: {
    startContainerLogs: (id, tail) => ipcRenderer.invoke('streams:container-logs', id, tail),
    startContainerStats: (id) => ipcRenderer.invoke('streams:container-stats', id),
    startDockerEvents: (type) => ipcRenderer.invoke('streams:docker-events', type),
    startComposeLogs: (project, services, tail) => ipcRenderer.invoke('streams:compose-logs', project, services, tail),
    startComposeStats: (project, services) => ipcRenderer.invoke('streams:compose-stats', project, services),
    stop: (sessionId) => ipcRenderer.invoke('streams:stop', sessionId),
    onData: (sessionId, callback) => subscribe(`stream:data:${sessionId}`, callback),
    onError: (sessionId, callback) => subscribe(`stream:error:${sessionId}`, callback),
    onExit: (sessionId, callback) => subscribe(`stream:exit:${sessionId}`, callback)
  },
  terminal: {
    open: (containerId, shell, cols, rows) => ipcRenderer.invoke('terminal:open', containerId, shell, cols, rows),
    write: (sessionId, data) => ipcRenderer.invoke('terminal:write', sessionId, data),
    resize: (sessionId, cols, rows) => ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
    close: (sessionId) => ipcRenderer.invoke('terminal:close', sessionId),
    onData: (sessionId, callback) => subscribe(`terminal:data:${sessionId}`, callback),
    onExit: (sessionId, callback) => subscribe(`terminal:exit:${sessionId}`, callback)
  },
  compose: {
    list: () => ipcRenderer.invoke('compose:list'),
    start: (p) => ipcRenderer.invoke('compose:start', p),
    stop: (p) => ipcRenderer.invoke('compose:stop', p),
    restart: (p) => ipcRenderer.invoke('compose:restart', p),
    down: (p, volumes) => ipcRenderer.invoke('compose:down', p, volumes),
    logs: (p, tail) => ipcRenderer.invoke('compose:logs', p, tail),
    services: (p) => ipcRenderer.invoke('compose:services', p),
    workspace: (p) => ipcRenderer.invoke('compose:workspace', p),
    serviceStart: (p, service) => ipcRenderer.invoke('compose:service-start', p, service),
    serviceStop: (p, service) => ipcRenderer.invoke('compose:service-stop', p, service),
    serviceRestart: (p, service) => ipcRenderer.invoke('compose:service-restart', p, service),
    pull: (p) => ipcRenderer.invoke('compose:pull', p),
    build: (p, noCache) => ipcRenderer.invoke('compose:build', p, noCache),
    up: (p, build) => ipcRenderer.invoke('compose:up', p, build),
    configValidate: (p, content, filePath) => ipcRenderer.invoke('compose:config-validate', p, content, filePath),
    readFile: (p, filePath) => ipcRenderer.invoke('compose:read-file', p, filePath),
    saveFile: (p, filePath, content, expectedOriginal) => ipcRenderer.invoke('compose:save-file', p, filePath, content, expectedOriginal)
  },
  images: {
    list: () => ipcRenderer.invoke('images:list'),
    remove: (ids, force) => ipcRenderer.invoke('images:remove', ids, force),
    prune: (all) => ipcRenderer.invoke('images:prune', all)
  },
  volumes: {
    list: () => ipcRenderer.invoke('volumes:list'),
    intelligence: () => ipcRenderer.invoke('volumes:intelligence'),
    remove: (names, force) => ipcRenderer.invoke('volumes:remove', names, force),
    prune: (all) => ipcRenderer.invoke('volumes:prune', all)
  },
  networks: {
    list: () => ipcRenderer.invoke('networks:list'),
    prune: () => ipcRenderer.invoke('networks:prune')
  },
  cleanup: {
    advisor: () => ipcRenderer.invoke('cleanup:advisor'),
    plan: (targetBytes) => ipcRenderer.invoke('cleanup:plan', targetBytes),
    safe: (includeUnusedImages) => ipcRenderer.invoke('cleanup:safe', includeUnusedImages)
  },
  buildkit: {
    builders: () => ipcRenderer.invoke('buildkit:builders'),
    history: () => ipcRenderer.invoke('buildkit:history'),
    diagnostics: (ref) => ipcRenderer.invoke('buildkit:diagnostics', ref),
    open: (ref) => ipcRenderer.invoke('buildkit:open', ref),
    diskUsage: () => ipcRenderer.invoke('buildkit:du'),
    prune: (all, keepStorageGb) => ipcRenderer.invoke('buildkit:prune', all, keepStorageGb)
  },
  ai: {
    settings: () => ipcRenderer.invoke('ai:settings'),
    saveSettings: (settings) => ipcRenderer.invoke('ai:save-settings', settings),
    testConnection: (settings) => ipcRenderer.invoke('ai:test-connection', settings),
    analyzeBuildError: (ref) => ipcRenderer.invoke('ai:build-error-analysis', ref),
    analyzeContainerFailure: (containerId) => ipcRenderer.invoke('ai:container-failure-analysis', containerId)
  },
  imageInsights: {
    history: (imageId) => ipcRenderer.invoke('image-insights:history', imageId),
    analyze: (imageId) => ipcRenderer.invoke('image-insights:analyze', imageId)
  },
  monitoring: {
    health: () => ipcRenderer.invoke('monitoring:health'),
    notifications: () => ipcRenderer.invoke('monitoring:notifications'),
    markRead: (ids) => ipcRenderer.invoke('monitoring:mark-read', ids),
    clear: () => ipcRenderer.invoke('monitoring:clear'),
    refresh: () => ipcRenderer.invoke('monitoring:refresh')
  },
  audit: {
    list: () => ipcRenderer.invoke('audit:list'),
    summary: () => ipcRenderer.invoke('audit:summary'),
    snapshots: () => ipcRenderer.invoke('audit:snapshots'),
    snapshot: (id) => ipcRenderer.invoke('audit:snapshot', id),
    clear: () => ipcRenderer.invoke('audit:clear'),
    export: () => ipcRenderer.invoke('audit:export')
  },
  about: {
    runtime: () => ipcRenderer.invoke('about:runtime'),
    releaseNotes: () => ipcRenderer.invoke('about:release-notes')
  },
  updates: {
    state: () => ipcRenderer.invoke('updates:state'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    setChannel: (channel) => ipcRenderer.invoke('updates:set-channel', channel),
    onChanged: (callback) => subscribe('updates:changed', callback)
  },
  preferences: {
    get: (key) => ipcRenderer.invoke('preferences:get', key),
    set: (key, value) => ipcRenderer.invoke('preferences:set', key, value),
    remove: (key) => ipcRenderer.invoke('preferences:remove', key)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
    profiles: () => ipcRenderer.invoke('settings:profiles'),
    applyProfile: (profileId) => ipcRenderer.invoke('settings:apply-profile', profileId),
    reset: () => ipcRenderer.invoke('settings:reset')
  },
  storage: {
    findVhdx: () => ipcRenderer.invoke('storage:find-vhdx'),
    compact: (path) => ipcRenderer.invoke('storage:compact', path),
    trends: (range) => ipcRenderer.invoke('storage:trends', range),
    sampleNow: () => ipcRenderer.invoke('storage:sample-now')
  }
}

contextBridge.exposeInMainWorld('dockerApi', api)


contextBridge.exposeInMainWorld('electron', {
  onNavigate(callback: (target: string) => void) {
    const listener = (_event: Electron.IpcRendererEvent, target: string) => callback(target)
    ipcRenderer.on('app:navigate', listener)
    return () => ipcRenderer.removeListener('app:navigate', listener)
  }
})
