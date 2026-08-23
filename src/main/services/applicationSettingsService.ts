import { app } from 'electron'
import type { AppSettings, SettingsProfile, SettingsProfileId } from '../../shared/contracts'
import { databaseService } from '../database/database'
import { importLegacyJson } from '../database/legacyImport'

const base: AppSettings = {
  profileId: 'development',
  general: {
    theme: 'dark',
    startWithWindows: false,
    closeToTray: true,
    startMinimized: false
  },
  docker: {
    cliPath: 'docker',
    context: '',
    commandTimeoutSeconds: 120
  },
  monitoring: {
    enabled: true,
    pollIntervalSeconds: 30,
    unhealthyAlerts: true,
    unexpectedExitAlerts: true,
    restartLoopAlerts: true,
    storageAlerts: true,
    buildCacheAlerts: true,
    vhdxWarningGb: 70,
    buildCacheWarningGb: 15
  },
  cleanup: {
    defaultMode: 'safe',
    includeUnusedImages: false,
    buildCacheKeepGb: 10,
    requirePreview: true
  },
  terminal: {
    defaultShell: 'auto',
    logTailLines: 500,
    statsRefreshSeconds: 2,
    maxLogLines: 10000
  },
  notifications: {
    nativeNotifications: true,
    notifyOnSuccess: false,
    notifyOnWarning: true,
    notifyOnCritical: true
  },
  storage: {
    customVhdxPath: '',
    compactAfterCleanup: false,
    warnBeforeWslShutdown: true
  },
  security: {
    maskSecrets: true,
    requireTypedConfirmationForCritical: true,
    allowForceRemove: true,
    auditRetention: 2000,
    recoverySnapshotRetention: 1000
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function profile(
  id: Exclude<SettingsProfileId, 'custom'>,
  name: string,
  description: string,
  patch: Partial<AppSettings>
): SettingsProfile {
  const settings = clone(base)
  Object.assign(settings, patch)
  settings.profileId = id
  for (const key of Object.keys(patch) as Array<keyof AppSettings>) {
    if (typeof patch[key] === 'object' && patch[key] && typeof settings[key] === 'object') {
      ;(settings as any)[key] = { ...(base as any)[key], ...(patch as any)[key] }
    }
  }
  return { id, name, description, settings }
}

const PROFILES: SettingsProfile[] = [
  profile('development', 'Development', 'Balanced defaults for local Docker development.', {}),
  profile('conservative', 'Conservative', 'Fewer destructive defaults and slower background monitoring.', {
    monitoring: { ...base.monitoring, pollIntervalSeconds: 60, buildCacheWarningGb: 25 },
    cleanup: { ...base.cleanup, defaultMode: 'safe', includeUnusedImages: false, buildCacheKeepGb: 20 },
    security: { ...base.security, allowForceRemove: false }
  }),
  profile('ci-build-heavy', 'CI / Build Heavy', 'Keeps more cache and reduces noisy build-cache alerts.', {
    monitoring: { ...base.monitoring, pollIntervalSeconds: 60, buildCacheWarningGb: 40 },
    cleanup: { ...base.cleanup, defaultMode: 'safe', buildCacheKeepGb: 30 },
    terminal: { ...base.terminal, logTailLines: 1000, maxLogLines: 20000 }
  }),
  profile('low-disk-space', 'Low Disk Space', 'Aggressive storage visibility while keeping volumes protected.', {
    monitoring: { ...base.monitoring, pollIntervalSeconds: 20, vhdxWarningGb: 45, buildCacheWarningGb: 5 },
    cleanup: { ...base.cleanup, defaultMode: 'balanced', includeUnusedImages: true, buildCacheKeepGb: 5 },
    storage: { ...base.storage, compactAfterCleanup: false, warnBeforeWslShutdown: true }
  })
]

function mergeSettings(input: Partial<AppSettings>): AppSettings {
  const source = input as any
  return {
    ...clone(base),
    ...source,
    general: { ...base.general, ...(source.general ?? {}) },
    docker: { ...base.docker, ...(source.docker ?? {}) },
    monitoring: { ...base.monitoring, ...(source.monitoring ?? {}) },
    cleanup: { ...base.cleanup, ...(source.cleanup ?? {}) },
    terminal: { ...base.terminal, ...(source.terminal ?? {}) },
    notifications: { ...base.notifications, ...(source.notifications ?? {}) },
    storage: { ...base.storage, ...(source.storage ?? {}) },
    security: { ...base.security, ...(source.security ?? {}) }
  }
}

function normalize(input: AppSettings): AppSettings {
  const next = clone(input)
  next.docker.cliPath = String(next.docker.cliPath || 'docker').trim() || 'docker'
  next.docker.context = String(next.docker.context || '').trim()
  next.docker.commandTimeoutSeconds = Math.max(10, Math.min(3600, Number(next.docker.commandTimeoutSeconds) || 120))
  next.monitoring.pollIntervalSeconds = Math.max(10, Math.min(3600, Number(next.monitoring.pollIntervalSeconds) || 30))
  next.monitoring.vhdxWarningGb = Math.max(1, Number(next.monitoring.vhdxWarningGb) || 70)
  next.monitoring.buildCacheWarningGb = Math.max(1, Number(next.monitoring.buildCacheWarningGb) || 15)
  next.cleanup.buildCacheKeepGb = Math.max(0, Number(next.cleanup.buildCacheKeepGb) || 0)
  next.terminal.logTailLines = Math.max(50, Math.min(5000, Number(next.terminal.logTailLines) || 500))
  next.terminal.statsRefreshSeconds = Math.max(1, Math.min(30, Number(next.terminal.statsRefreshSeconds) || 2))
  next.terminal.maxLogLines = Math.max(1000, Math.min(100000, Number(next.terminal.maxLogLines) || 10000))
  next.security.auditRetention = Math.max(100, Math.min(10000, Number(next.security.auditRetention) || 2000))
  next.security.recoverySnapshotRetention = Math.max(100, Math.min(5000, Number(next.security.recoverySnapshotRetention) || 1000))
  next.storage.customVhdxPath = String(next.storage.customVhdxPath || '').trim()
  return next
}

class ApplicationSettingsService {
  private current: AppSettings = clone(base)
  private loaded = false

  async initialize() {
    if (this.loaded) return this.current
    await databaseService.initialize()

    await importLegacyJson<AppSettings>('application-settings.json', async legacy => {
      const normalized = normalize(mergeSettings(legacy))
      await databaseService.setState('application.settings', normalized)
      return 1
    })

    const stored = await databaseService.getState<AppSettings>('application.settings')
    this.current = stored ? normalize(mergeSettings(stored)) : clone(base)
    if (!stored) await databaseService.setState('application.settings', this.current)

    this.loaded = true
    this.applyRuntimeEnvironment()
    return this.current
  }

  get() {
    return clone(this.current)
  }

  profiles() {
    return clone(PROFILES)
  }

  async save(settings: AppSettings) {
    this.current = normalize(mergeSettings({ ...settings, profileId: settings.profileId ?? 'custom' }))
    await databaseService.setState('application.settings', this.current)
    this.applyRuntimeEnvironment()
    this.applyLoginItem()
    return this.get()
  }

  async applyProfile(profileId: Exclude<SettingsProfileId, 'custom'>) {
    const selected = PROFILES.find(x => x.id === profileId)
    if (!selected) throw new Error(`Unknown settings profile: ${profileId}`)
    return this.save(clone(selected.settings))
  }

  async reset() {
    this.current = clone(base)
    await databaseService.setState('application.settings', this.current)
    this.applyRuntimeEnvironment()
    this.applyLoginItem()
    return this.get()
  }

  private applyRuntimeEnvironment() {
    process.env.DSM_DOCKER_CLI = this.current.docker.cliPath || 'docker'
    if (this.current.docker.context) process.env.DOCKER_CONTEXT = this.current.docker.context
    else delete process.env.DOCKER_CONTEXT
    process.env.DSM_COMMAND_TIMEOUT_MS = String(this.current.docker.commandTimeoutSeconds * 1000)
    process.env.DSM_CUSTOM_VHDX_PATH = this.current.storage.customVhdxPath || ''
    process.env.DSM_AUDIT_RETENTION = String(this.current.security.auditRetention)
    process.env.DSM_SNAPSHOT_RETENTION = String(this.current.security.recoverySnapshotRetention)
    process.env.DSM_MASK_SECRETS = this.current.security.maskSecrets ? '1' : '0'
  }

  private applyLoginItem() {
    if (!app.isPackaged) return
    app.setLoginItemSettings({
      openAtLogin: this.current.general.startWithWindows,
      args: this.current.general.startMinimized ? ['--minimized'] : []
    })
  }
}

export const applicationSettingsService = new ApplicationSettingsService()
