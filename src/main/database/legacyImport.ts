import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { databaseService } from './database'

function corruptStateKey(filename: string) {
  return `legacy.corrupt.${filename.replace(/[^a-zA-Z0-9._-]+/g, '_')}`
}

export async function importLegacyJson<T>(
  filename: string,
  importer: (value: T) => Promise<number>
) {
  await databaseService.initialize()
  if (await databaseService.hasLegacyImport(filename)) return false

  const source = path.join(app.getPath('userData'), filename)

  let raw: string
  try {
    raw = await fs.readFile(source, 'utf8')
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      await databaseService.markLegacyImported(filename, 0)
      return false
    }
    throw error
  }

  let value: T
  try {
    value = JSON.parse(raw) as T
  } catch (error) {
    await databaseService.setState(corruptStateKey(filename), {
      source: filename,
      importedAt: new Date().toISOString(),
      parseError: error instanceof Error ? error.message : String(error),
      raw
    })
    await databaseService.markLegacyImported(filename, 0)
    await fs.unlink(source).catch(() => undefined)
    return false
  }

  const records = await importer(value)
  await databaseService.markLegacyImported(filename, records)
  await fs.unlink(source).catch(() => undefined)
  return true
}
