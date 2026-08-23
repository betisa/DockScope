import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import knex, { type Knex } from 'knex'

const DATABASE_FILENAME = 'dockscope.sqlite3'

class DatabaseService {
  private client: Knex | null = null
  private initialized = false
  private initializing: Promise<Knex> | null = null

  get db() {
    if (!this.client) throw new Error('Database is not initialized.')
    return this.client
  }

  get filename() {
    return path.join(app.getPath('userData'), DATABASE_FILENAME)
  }

  private async migrateLegacyDatabaseFile() {
    const target = this.filename
    try { await fs.access(target); return } catch {}

    const candidates = [
      path.join(app.getPath('userData'), 'docker-space-manager.sqlite3'),
      path.join(app.getPath('appData'), 'Docker Space Manager', 'docker-space-manager.sqlite3'),
      path.join(app.getPath('appData'), 'Docker Space Manager', 'dockscope.sqlite3')
    ]

    for (const legacy of candidates) {
      try {
        await fs.access(legacy)
        await fs.mkdir(path.dirname(target), { recursive:true })
        await fs.copyFile(legacy, target)
        return
      } catch {}
    }
  }

  async initialize() {
    if (this.initialized) return this.db
    if (this.initializing) return this.initializing

    this.initializing = (async () => {
      await this.migrateLegacyDatabaseFile()
      this.client = knex({
        client: 'better-sqlite3',
        connection: {
          filename: this.filename
        },
        useNullAsDefault: true,
        pool: {
          min: 1,
          max: 1,
          afterCreate(connection: any, done: (error: Error | null, connection?: any) => void) {
            try {
              connection.pragma('journal_mode = WAL')
              connection.pragma('foreign_keys = ON')
              connection.pragma('busy_timeout = 5000')
              connection.pragma('synchronous = NORMAL')
              done(null, connection)
            } catch (error) {
              done(error as Error)
            }
          }
        }
      })

      await this.migrate()
      this.initialized = true
      return this.db
    })()

    try {
      return await this.initializing
    } finally {
      this.initializing = null
    }
  }

  private async migrate() {
    const db = this.db

    if (!await db.schema.hasTable('app_state')) {
      await db.schema.createTable('app_state', table => {
        table.string('key', 160).primary()
        table.text('payload').notNullable()
        table.string('updated_at', 40).notNullable()
      })
    }

    if (!await db.schema.hasTable('audit_entries')) {
      await db.schema.createTable('audit_entries', table => {
        table.string('id', 80).primary()
        table.string('completed_at', 40).notNullable().index()
        table.string('severity', 20).notNullable().index()
        table.string('status', 20).notNullable().index()
        table.text('payload').notNullable()
      })
    }

    if (!await db.schema.hasTable('recovery_snapshots')) {
      await db.schema.createTable('recovery_snapshots', table => {
        table.string('id', 80).primary()
        table.string('created_at', 40).notNullable().index()
        table.string('resource_type', 40).notNullable().index()
        table.string('resource_id', 500).notNullable()
        table.text('payload').notNullable()
      })
    }

    if (!await db.schema.hasTable('operation_tasks')) {
      await db.schema.createTable('operation_tasks', table => {
        table.string('id', 80).primary()
        table.string('created_at', 40).notNullable().index()
        table.string('status', 20).notNullable().index()
        table.string('kind', 40).notNullable().index()
        table.text('payload').notNullable()
      })
    }

    if (!await db.schema.hasTable('storage_trends')) {
      await db.schema.createTable('storage_trends', table => {
        table.string('id', 80).primary()
        table.string('captured_at', 40).notNullable().index()
        table.bigInteger('docker_allocated_bytes').notNullable().defaultTo(0)
        table.bigInteger('vhdx_bytes').notNullable().defaultTo(0)
        table.text('payload').notNullable()
      })
    }

    if (!await db.schema.hasTable('operational_notifications')) {
      await db.schema.createTable('operational_notifications', table => {
        table.string('id', 80).primary()
        table.string('created_at', 40).notNullable().index()
        table.string('severity', 20).notNullable().index()
        table.boolean('read').notNullable().defaultTo(false).index()
        table.text('payload').notNullable()
      })
    }

    if (!await db.schema.hasTable('legacy_imports')) {
      await db.schema.createTable('legacy_imports', table => {
        table.string('source', 200).primary()
        table.string('imported_at', 40).notNullable()
        table.integer('records').notNullable().defaultTo(0)
      })
    }
  }

  async close() {
    if (!this.client) return
    await this.client.destroy()
    this.client = null
    this.initialized = false
    this.initializing = null
  }

  async getState<T>(key: string): Promise<T | null> {
    await this.initialize()
    const row = await this.db('app_state').where({ key }).first<{ payload: string }>()
    if (!row) return null
    try { return JSON.parse(row.payload) as T } catch { return null }
  }

  async setState(key: string, value: unknown) {
    await this.initialize()
    const row = {
      key,
      payload: JSON.stringify(value),
      updated_at: new Date().toISOString()
    }
    await this.db('app_state')
      .insert(row)
      .onConflict('key')
      .merge({ payload: row.payload, updated_at: row.updated_at })
  }

  async removeState(key: string) {
    await this.initialize()
    await this.db('app_state').where({ key }).delete()
  }

  async hasLegacyImport(source: string) {
    await this.initialize()
    return Boolean(await this.db('legacy_imports').where({ source }).first())
  }

  async markLegacyImported(source: string, records: number) {
    await this.initialize()
    await this.db('legacy_imports')
      .insert({ source, imported_at: new Date().toISOString(), records })
      .onConflict('source')
      .merge()
  }
}

export const databaseService = new DatabaseService()
