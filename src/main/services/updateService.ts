import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import electronUpdater from 'electron-updater'
import type {
  AppRuntimeInfo,
  ReleaseChannel,
  ReleaseNotesDocument,
  UpdateState
} from '../../shared/contracts'
import { databaseService } from '../database/database'
import { dockerService } from './dockerService'

const { autoUpdater } = electronUpdater

const DEFAULT_NOTES: ReleaseNotesDocument = {
  version: '1.0.0',
  date: '2026-08-22',
  channel: 'stable',
  title: 'DockScope 1.0.0',
  highlights: [
    'Advanced Docker diagnostics, Storage Trends and a customizable operational Dashboard.',
    'Target-based Smart Cleanup Planning with persistent Volumes excluded.',
    'Guarded Container File Browser with audited upload and text writes.',
    'Unified SQLite persistence through Knex.js.'
  ],
  security: [
    'Renderer remains sandboxed and privileged operations stay in Electron Main.'
  ]
}

function normalizeChannel(value: unknown): ReleaseChannel {
  return value === 'preview' ? 'preview' : 'stable'
}

function updaterChannel(channel: ReleaseChannel) {
  return channel === 'preview' ? 'beta' : 'latest'
}

function notesToText(value: unknown) {
  if (typeof value === 'string') return value.slice(0, 20_000)
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item : String((item as any)?.note ?? ''))
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20_000)
  }
  return ''
}

export class UpdateService extends EventEmitter {
  private initialized = false
  private channel: ReleaseChannel = 'stable'
  private state: UpdateState = {
    status:'idle',
    channel:'stable',
    currentVersion:'0.0.0',
    availableVersion:'',
    releaseName:'',
    releaseDate:'',
    releaseNotes:'',
    percent:0,
    transferred:0,
    total:0,
    bytesPerSecond:0,
    error:'',
    updateBaseUrlConfigured:false,
    canCheck:false,
    canDownload:false,
    canInstall:false,
    portable:false,
    packaged:false
  }

  async initialize() {
    if (this.initialized) return this.getState()
    await databaseService.initialize()

    this.channel = normalizeChannel(
      await databaseService.getState<ReleaseChannel>('application.releaseChannel')
    )
    await databaseService.setState('application.releaseChannel', this.channel)

    const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)
    const supported = app.isPackaged && !portable

    this.configureUpdater()
    this.bindUpdaterEvents()

    this.state = {
      ...this.state,
      status:supported ? 'idle' : 'unsupported',
      channel:this.channel,
      currentVersion:app.getVersion(),
      // Kept for contract compatibility: true means the packaged GitHub update provider is embedded.
      updateBaseUrlConfigured:app.isPackaged,
      canCheck:supported,
      canDownload:false,
      canInstall:false,
      portable,
      packaged:app.isPackaged,
      error:!app.isPackaged
        ? 'Auto-update is available only in packaged builds.'
        : portable
          ? 'Portable builds cannot self-update. Install the NSIS build to enable GitHub Release updates.'
          : ''
    }

    this.initialized = true
    return this.getState()
  }

  private configureUpdater() {
    // electron-builder writes resources/app-update.yml with the GitHub provider.
    // Do not call setFeedURL here; only the release channel is user-selectable.
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = this.channel === 'preview'
    autoUpdater.channel = updaterChannel(this.channel)
  }

  private bindUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.patch({ status:'checking', error:'', percent:0, transferred:0, total:0, canDownload:false, canInstall:false })
    })

    autoUpdater.on('update-available', info => {
      this.patch({
        status:'available',
        availableVersion:String(info.version ?? ''),
        releaseName:String(info.releaseName ?? ''),
        releaseDate:String(info.releaseDate ?? ''),
        releaseNotes:notesToText(info.releaseNotes),
        canDownload:true,
        canInstall:false,
        error:''
      })
    })

    autoUpdater.on('update-not-available', info => {
      this.patch({
        status:'not-available',
        availableVersion:String(info.version ?? ''),
        releaseName:String(info.releaseName ?? ''),
        releaseDate:String(info.releaseDate ?? ''),
        releaseNotes:notesToText(info.releaseNotes),
        canDownload:false,
        canInstall:false,
        error:''
      })
    })

    autoUpdater.on('download-progress', progress => {
      this.patch({
        status:'downloading',
        percent:Number(progress.percent ?? 0),
        transferred:Number(progress.transferred ?? 0),
        total:Number(progress.total ?? 0),
        bytesPerSecond:Number(progress.bytesPerSecond ?? 0),
        canDownload:false,
        canInstall:false,
        error:''
      })
    })

    autoUpdater.on('update-downloaded', info => {
      this.patch({
        status:'downloaded',
        availableVersion:String(info.version ?? this.state.availableVersion),
        releaseName:String(info.releaseName ?? this.state.releaseName),
        releaseDate:String(info.releaseDate ?? this.state.releaseDate),
        releaseNotes:notesToText(info.releaseNotes) || this.state.releaseNotes,
        percent:100,
        canDownload:false,
        canInstall:true,
        error:''
      })
    })

    autoUpdater.on('error', error => {
      this.patch({
        status:'error',
        error:error instanceof Error ? error.message : String(error),
        canDownload:this.state.status === 'available',
        canInstall:false
      })
    })
  }

  private patch(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch, channel:this.channel, currentVersion:app.getVersion() }
    this.emit('changed', this.getState())
  }

  getState() {
    return structuredClone(this.state)
  }

  async setChannel(channel: ReleaseChannel) {
    await this.initialize()
    this.channel = normalizeChannel(channel)
    await databaseService.setState('application.releaseChannel', this.channel)
    this.configureUpdater()

    const supported = app.isPackaged && !this.state.portable
    this.patch({
      status:supported ? 'idle' : 'unsupported',
      availableVersion:'',
      releaseName:'',
      releaseDate:'',
      releaseNotes:'',
      percent:0,
      transferred:0,
      total:0,
      bytesPerSecond:0,
      canCheck:supported,
      canDownload:false,
      canInstall:false,
      error:supported ? '' : this.state.error
    })
    return this.getState()
  }

  async check() {
    await this.initialize()
    if (!this.state.canCheck) return this.getState()
    this.patch({ status:'checking', error:'', canDownload:false, canInstall:false })
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.patch({ status:'error', error:error instanceof Error ? error.message : String(error) })
    }
    return this.getState()
  }

  async download() {
    await this.initialize()
    if (this.state.status !== 'available' || !this.state.canDownload) {
      throw new Error('No downloadable update is currently available.')
    }
    this.patch({ status:'downloading', error:'', canDownload:false })
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      this.patch({ status:'error', error:error instanceof Error ? error.message : String(error) })
    }
    return this.getState()
  }

  async install() {
    await this.initialize()
    if (this.state.status !== 'downloaded' || !this.state.canInstall) {
      throw new Error('No downloaded update is ready to install.')
    }
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  }

  async runtimeInfo(): Promise<AppRuntimeInfo> {
    const engine = await dockerService.engineStatus().catch(() => ({
      reachable:false, serverVersion:'', composeVersion:'', context:''
    }))
    return {
      appVersion:app.getVersion(),
      electronVersion:String(process.versions.electron ?? ''),
      nodeVersion:String(process.versions.node ?? ''),
      chromeVersion:String(process.versions.chrome ?? ''),
      dockerVersion:engine.serverVersion || 'Unavailable',
      dockerComposeVersion:engine.composeVersion || 'Unavailable',
      dockerContext:engine.context || 'Unavailable',
      platform:process.platform,
      arch:process.arch,
      packaged:app.isPackaged,
      portable:Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)
    }
  }

  async releaseNotes(): Promise<ReleaseNotesDocument> {
    const file = app.isPackaged
      ? path.join(process.resourcesPath,'release-notes.json')
      : path.join(app.getAppPath(),'build','release-notes.json')
    try {
      const parsed = JSON.parse(await fs.readFile(file,'utf8'))
      return {
        version:String(parsed.version ?? app.getVersion()),
        date:String(parsed.date ?? ''),
        channel:normalizeChannel(parsed.channel),
        title:String(parsed.title ?? `DockScope ${app.getVersion()}`),
        highlights:Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
        security:Array.isArray(parsed.security) ? parsed.security.map(String) : []
      }
    } catch {
      return { ...DEFAULT_NOTES, version:app.getVersion() }
    }
  }
}

export const updateService = new UpdateService()
