import type { ProductivityHistoryEntry, ProductivityItem, RecentResource } from './model'

const FAVORITES = 'ui.productivity.favorites'
const RECENTS = 'ui.productivity.recents'
const HISTORY = 'ui.productivity.history'

const LEGACY = {
  [FAVORITES]: 'dsm.m08.favorites',
  [RECENTS]: 'dsm.m08.recents',
  [HISTORY]: 'dsm.m08.history'
} as const

async function read<T>(key: keyof typeof LEGACY, fallback: T): Promise<T> {
  const stored = await window.dockerApi.preferences.get<T>(key)
  if (stored != null) return stored

  try {
    const legacyKey = LEGACY[key]
    const raw = localStorage.getItem(legacyKey)
    if (raw) {
      const migrated = JSON.parse(raw) as T
      await window.dockerApi.preferences.set(key, migrated)
      localStorage.removeItem(legacyKey)
      return migrated
    }
  } catch {
    // Ignore malformed legacy renderer storage.
  }

  await window.dockerApi.preferences.set(key, fallback)
  return fallback
}

async function write<T>(key: string, value: T) {
  await window.dockerApi.preferences.set(key, value)
}

export const productivityStorage = {
  favorites(): Promise<string[]> {
    return read<string[]>(FAVORITES, [])
  },

  async toggleFavorite(itemId: string) {
    const current = new Set(await this.favorites())
    current.has(itemId) ? current.delete(itemId) : current.add(itemId)
    const result = [...current]
    await write(FAVORITES, result)
    return result
  },

  recents(): Promise<RecentResource[]> {
    return read<RecentResource[]>(RECENTS, [])
  },

  async addRecent(item: ProductivityItem) {
    if (item.kind === 'action') return
    const next: RecentResource = {
      id:item.id,
      title:item.title,
      subtitle:item.subtitle,
      kind:item.kind,
      page:item.page,
      resourceId:item.resourceId,
      resourceName:item.resourceName,
      openedAt:new Date().toISOString()
    }
    const current = await this.recents()
    const rows = [next, ...current.filter(x => x.id !== item.id)].slice(0, 20)
    await write(RECENTS, rows)
  },

  history(): Promise<ProductivityHistoryEntry[]> {
    return read<ProductivityHistoryEntry[]>(HISTORY, [])
  },

  async addHistory(entry: ProductivityHistoryEntry) {
    await write(HISTORY, [entry, ...await this.history()].slice(0, 100))
  },

  clearHistory() {
    return write(HISTORY, [])
  }
}
