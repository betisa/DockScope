import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('SQLite / Knex application persistence', () => {
  const packageJson = readFileSync('package.json', 'utf8')
  const database = readFileSync('src/main/database/database.ts', 'utf8')
  const legacy = readFileSync('src/main/database/legacyImport.ts', 'utf8')
  const settings = readFileSync('src/main/services/applicationSettingsService.ts', 'utf8')
  const audit = readFileSync('src/main/services/auditService.ts', 'utf8')
  const tasks = readFileSync('src/main/services/taskCenterService.ts', 'utf8')
  const trends = readFileSync('src/main/services/storageTrendService.ts', 'utf8')
  const monitoring = readFileSync('src/main/monitoring/operationalIntelligence.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const dashboard = readFileSync('src/renderer/src/dashboardCustomization.ts', 'utf8')
  const productivity = readFileSync('src/renderer/src/productivity/storage.ts', 'utf8')

  it('uses Knex with Better-SQLite3 and packages its native binary outside ASAR', () => {
    expect(packageJson).toContain('"knex": "3.3.0"')
    expect(packageJson).toContain('"better-sqlite3": "13.0.3"')
    expect(packageJson).toContain('node_modules/better-sqlite3/**/*')
    expect(database).toContain("client: 'better-sqlite3'")
  })

  it('stores the database under Electron userData with WAL and foreign keys', () => {
    expect(database).toContain("app.getPath('userData')")
    expect(database).toContain("dockscope.sqlite3")
    expect(database).toContain("journal_mode = WAL")
    expect(database).toContain("foreign_keys = ON")
    expect(database).toContain("busy_timeout = 5000")
  })

  it('creates dedicated persistence tables through Knex schema builder', () => {
    for (const table of [
      'app_state',
      'audit_entries',
      'recovery_snapshots',
      'operation_tasks',
      'storage_trends',
      'operational_notifications',
      'legacy_imports'
    ]) {
      expect(database).toContain(`hasTable('${table}')`)
      expect(database).toContain(`createTable('${table}'`)
    }
  })

  it('migrates legacy JSON once and removes the old state file after import', () => {
    expect(legacy).toContain('hasLegacyImport(filename)')
    expect(legacy).toContain('markLegacyImported(filename')
    expect(legacy).toContain('fs.unlink(source)')
    expect(legacy).toContain('legacy.corrupt.')
    expect(legacy).toContain('parseError')
    expect(settings).toContain("importLegacyJson<AppSettings>('application-settings.json'")
    expect(audit).toContain("importLegacyJson<AuditEntry[]>('audit-history.json'")
    expect(tasks).toContain("importLegacyJson<OperationTask[]>('operation-tasks.json'")
    expect(trends).toContain("importLegacyJson<StorageTrendSample[]>('storage-trends.json'")
    expect(monitoring).toContain("importLegacyJson<OperationalNotification[]>('notifications.json'")
  })

  it('persists settings, audit/recovery, tasks, trends and monitoring data in SQLite', () => {
    expect(settings).toContain("databaseService.setState('application.settings'")
    expect(audit).toContain("databaseService.db('audit_entries')")
    expect(audit).toContain("databaseService.db('recovery_snapshots')")
    expect(tasks).toContain("databaseService.db('operation_tasks')")
    expect(trends).toContain("databaseService.db('storage_trends')")
    expect(monitoring).toContain("databaseService.db('operational_notifications')")
    expect(monitoring).toContain("databaseService.setState('monitoring.settings'")
  })

  it('stores dashboard and productivity persistent UI state through Main SQLite preferences', () => {
    expect(ipc).toContain("ipcMain.handle('preferences:get'")
    expect(ipc).toContain("ipcMain.handle('preferences:set'")
    expect(dashboard).toContain("window.dockerApi.preferences.get<DashboardLayout>(DB_KEY)")
    expect(dashboard).toContain("window.dockerApi.preferences.set(DB_KEY")
    expect(productivity).toContain("window.dockerApi.preferences.get<T>(key)")
    expect(productivity).toContain("window.dockerApi.preferences.set(key, value)")
  })

  it('uses localStorage only for one-time Renderer legacy migration, not new writes', () => {
    expect(dashboard).not.toContain('localStorage.setItem')
    expect(productivity).not.toContain('localStorage.setItem')
    expect(dashboard).toContain('localStorage.removeItem(LEGACY_STORAGE_KEY)')
    expect(productivity).toContain('localStorage.removeItem(legacyKey)')
  })

  it('uses per-task UPSERTs instead of rewriting the complete task history on streamed output', () => {
    expect(tasks).toContain('private async persistTask(task: OperationTask)')
    expect(tasks).toContain(".onConflict('id')")
    expect(tasks).toContain('.merge({')
  })
})
