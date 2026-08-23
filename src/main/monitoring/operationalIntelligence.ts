import { Notification } from 'electron'
import { randomUUID } from 'node:crypto'
import { dockerService } from '../services/dockerService'
import { windowsStorageService } from '../services/windowsStorageService'
import type { MonitoringSettings, OperationalHealth, OperationalNotification, NotificationSeverity } from '../../shared/contracts'
import { databaseService } from '../database/database'
import { importLegacyJson } from '../database/legacyImport'

const DEFAULT_SETTINGS: MonitoringSettings = {
  enabled: true,
  nativeNotifications: true,
  unhealthyAlerts: true,
  unexpectedExitAlerts: true,
  restartLoopAlerts: true,
  storageAlerts: true,
  buildCacheAlerts: true,
  vhdxWarningGb: 70,
  buildCacheWarningGb: 15,
  pollIntervalSeconds: 30
}

type Snapshot = { id: string; name: string; state: string; status: string }

function bytesFromHuman(input: string): number {
  const m = input.match(/([\d.]+)\s*([kmgt]?i?b)/i)
  if (!m) return 0
  const value = Number(m[1])
  const unit = m[2].toLowerCase()
  const map: Record<string, number> = { b:1, kb:1000, mb:1000**2, gb:1000**3, tb:1000**4, kib:1024, mib:1024**2, gib:1024**3, tib:1024**4 }
  return value * (map[unit] ?? 1)
}

export class OperationalIntelligence {
  private notifications: OperationalNotification[] = []
  private settings: MonitoringSettings = DEFAULT_SETTINGS
  private previous = new Map<string, Snapshot>()
  private restartHistory = new Map<string, number[]>()
  private timer: NodeJS.Timeout | null = null
  private initialized = false
  private lastHealth: OperationalHealth = {
    dockerReachable:false, runningContainers:0, unhealthyContainers:0, stoppedContainers:0,
    recentCritical:0, recentWarnings:0, vhdxSizeBytes:0, vhdxSize:'0 B', buildCacheReclaimable:'0 B'
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    await Promise.all([this.loadSettings(), this.loadNotifications()])
    await this.refresh().catch(() => undefined)
    this.schedule()
  }

  private async loadSettings() {
    await databaseService.initialize()
    await importLegacyJson<MonitoringSettings>('monitoring-settings.json', async legacy => {
      await databaseService.setState('monitoring.settings', { ...DEFAULT_SETTINGS, ...(legacy ?? {}) })
      return 1
    })
    const stored = await databaseService.getState<MonitoringSettings>('monitoring.settings')
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
    if (!stored) await databaseService.setState('monitoring.settings', this.settings)
  }

  private async loadNotifications() {
    await databaseService.initialize()
    await importLegacyJson<OperationalNotification[]>('notifications.json', async legacy => {
      const rows = Array.isArray(legacy) ? legacy.slice(0, 500) : []
      if (rows.length) {
        await databaseService.db.transaction(async trx => {
          for (const item of rows) {
            await trx('operational_notifications').insert({
              id:item.id,
              created_at:item.createdAt,
              severity:item.severity,
              read:Boolean(item.read),
              payload:JSON.stringify(item)
            }).onConflict('id').ignore()
          }
        })
      }
      return rows.length
    })
    const rows = await databaseService.db('operational_notifications')
      .select('payload')
      .orderBy('created_at','desc')
      .limit(500)
    this.notifications = rows.map(row => JSON.parse(row.payload) as OperationalNotification)
  }

  private async persist() {
    const rows = this.notifications.slice(0,500)
    await databaseService.db.transaction(async trx => {
      await trx('operational_notifications').delete()
      for (const item of rows) {
        await trx('operational_notifications').insert({
          id:item.id,
          created_at:item.createdAt,
          severity:item.severity,
          read:Boolean(item.read),
          payload:JSON.stringify(item)
        })
      }
    })
  }

  private schedule() {
    if (this.timer) clearInterval(this.timer)
    if (!this.settings.enabled) return
    const ms = Math.max(10, this.settings.pollIntervalSeconds) * 1000
    this.timer = setInterval(() => void this.refresh().catch(() => undefined), ms)
  }

  getSettings() { return this.settings }
  getHealth() { return this.lastHealth }
  listNotifications() { return [...this.notifications] }

  async saveSettings(settings: MonitoringSettings) {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      pollIntervalSeconds: Math.max(10, Math.min(3600, Number(settings.pollIntervalSeconds) || 30)),
      vhdxWarningGb: Math.max(1, Number(settings.vhdxWarningGb) || 70),
      buildCacheWarningGb: Math.max(1, Number(settings.buildCacheWarningGb) || 15)
    }
    await databaseService.setState('monitoring.settings', this.settings)
    this.schedule()
    return this.settings
  }

  async markRead(ids: string[]) {
    const wanted = new Set(ids)
    this.notifications = this.notifications.map(x => wanted.has(x.id) ? { ...x, read:true } : x)
    await this.persist()
  }

  async clear() { this.notifications = []; await this.persist() }

  private async push(title:string, message:string, severity:NotificationSeverity, source:OperationalNotification['source'], resourceId?:string, resourceName?:string, action?:OperationalNotification['action']) {
    const recentDuplicate = this.notifications.find(x => !x.read && x.title === title && x.resourceId === resourceId && Date.now() - new Date(x.createdAt).getTime() < 5*60_000)
    if (recentDuplicate) return
    const item: OperationalNotification = { id:randomUUID(), title, message, severity, source, resourceId, resourceName, createdAt:new Date().toISOString(), read:false, action }
    this.notifications.unshift(item)
    this.notifications = this.notifications.slice(0,500)
    await this.persist()
    if (this.settings.nativeNotifications && Notification.isSupported()) {
      new Notification({ title, body:message, urgency:severity === 'critical' ? 'critical' : 'normal', silent:severity === 'info' }).show()
    }
  }

  async refresh(): Promise<OperationalHealth> {
    const engine = await dockerService.engineStatus().catch(() => ({reachable:false,serverVersion:'',composeVersion:'',context:''}))
    if (!engine.reachable) {
      if (this.lastHealth.dockerReachable) await this.push('Docker Engine disconnected','Docker Engine is no longer reachable.','critical','docker',undefined,undefined,{label:'Open Dashboard',page:'dashboard'})
      this.lastHealth = { ...this.lastHealth, dockerReachable:false }
      return this.lastHealth
    }

    const containers = await dockerService.containers().catch(() => [])
    let running = 0, stopped = 0, unhealthy = 0
    const now = Date.now()

    for (const c of containers) {
      if (c.state === 'running') running++; else stopped++
      const prev = this.previous.get(c.id)
      const isUnhealthy = /unhealthy/i.test(c.status)
      if (isUnhealthy) {
        unhealthy++
        if (this.settings.unhealthyAlerts && (!prev || !/unhealthy/i.test(prev.status))) {
          await this.push('Container became unhealthy',`${c.name} is reporting an unhealthy status.`,'critical','container',c.id,c.name,{label:'Open Container',page:'containers'})
        }
      }
      if (this.settings.unexpectedExitAlerts && prev?.state === 'running' && c.state !== 'running') {
        await this.push('Container exited',`${c.name} changed from running to ${c.state}. ${c.status}`,'warning','container',c.id,c.name,{label:'Inspect',page:'containers'})
      }
      if (this.settings.restartLoopAlerts && /restarting/i.test(c.status)) {
        const history = (this.restartHistory.get(c.id) ?? []).filter(x => now - x < 5*60_000)
        history.push(now); this.restartHistory.set(c.id, history)
        if (history.length >= 3) await this.push('Possible restart loop',`${c.name} has restarted repeatedly within five minutes.`,'critical','container',c.id,c.name,{label:'View Logs',page:'containers'})
      }
      this.previous.set(c.id, {id:c.id,name:c.name,state:c.state,status:c.status})
    }

    let vhdxSizeBytes = 0, vhdxSize = '0 B'
    if (this.settings.storageAlerts) {
      const disk = (await windowsStorageService.findVhdx().catch(() => []))[0]
      if (disk) {
        vhdxSizeBytes = disk.bytes; vhdxSize = disk.size
        if (disk.bytes >= this.settings.vhdxWarningGb * 1024**3) await this.push('Docker VHDX is large',`Docker disk image is ${disk.size}. Consider Safe Cleanup and VHDX compaction.`,'warning','storage',undefined,disk.path,{label:'Open Storage',page:'storage'})
      }
    }

    let buildCacheReclaimable = '0 B'
    if (this.settings.buildCacheAlerts) {
      const cache = (await dockerService.diskUsage().catch(() => [])).find(x => /build cache/i.test(x.type))
      buildCacheReclaimable = cache?.reclaimable ?? '0 B'
      if (bytesFromHuman(buildCacheReclaimable) >= this.settings.buildCacheWarningGb * 1024**3) await this.push('Build cache cleanup recommended',`${buildCacheReclaimable} of build cache is reclaimable.`,'warning','buildkit',undefined,undefined,{label:'Open BuildKit',page:'buildkit'})
    }

    const recent = this.notifications.filter(x => now - new Date(x.createdAt).getTime() < 24*60*60_000)
    this.lastHealth = {
      dockerReachable:true,
      runningContainers:running,
      unhealthyContainers:unhealthy,
      stoppedContainers:stopped,
      recentCritical:recent.filter(x=>x.severity==='critical').length,
      recentWarnings:recent.filter(x=>x.severity==='warning').length,
      vhdxSizeBytes, vhdxSize, buildCacheReclaimable
    }
    return this.lastHealth
  }

  dispose() { if (this.timer) clearInterval(this.timer); this.timer = null }
}

export const operationalIntelligence = new OperationalIntelligence()
