export type DashboardWidgetId =
  | 'runtime'
  | 'uptime'
  | 'storage-chart'
  | 'storage-trend'
  | 'container-states'
  | 'storage-details'
  | 'unhealthy'
  | 'recent-builds'
  | 'top-volumes'
  | 'recent-alerts'
  | 'quick-actions'

export type DashboardDensity = 'compact' | 'comfortable'

export type DashboardLayout = {
  schemaVersion: 1
  density: DashboardDensity
  order: DashboardWidgetId[]
  hidden: DashboardWidgetId[]
}

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId
  label: string
  description: string
  essential?: boolean
}

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  { id:'runtime', label:'Runtime summary', description:'Engine, Docker, Compose and active context.', essential:true },
  { id:'uptime', label:'Runtime uptime', description:'Live uptime for running Docker containers and Compose services.' },
  { id:'storage-chart', label:'Storage chart', description:'Allocated versus reclaimable Docker storage.' },
  { id:'storage-trend', label:'Storage trends', description:'Historical Docker allocation and storage composition over time.' },
  { id:'container-states', label:'Container states', description:'Running, stopped and unhealthy container distribution.' },
  { id:'storage-details', label:'Storage details', description:'Per-category Docker disk usage and reclaimable values.' },
  { id:'unhealthy', label:'Unhealthy containers', description:'Containers currently reporting an unhealthy status.' },
  { id:'recent-builds', label:'Recent builds', description:'Latest Buildx history records and statuses.' },
  { id:'top-volumes', label:'Top volumes', description:'Largest Docker volumes with intelligence risk.' },
  { id:'recent-alerts', label:'Recent alerts', description:'Latest operational warnings and critical notifications.' },
  { id:'quick-actions', label:'Quick actions', description:'Shortcuts to Containers, Compose, Cleanup and Storage.' }
]

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  schemaVersion: 1,
  density: 'comfortable',
  order: [
    'runtime',
    'container-states',
    'storage-chart',
    'storage-trend',
    'unhealthy',
    'uptime',
    'recent-alerts',
    'storage-details',
    'top-volumes',
    'recent-builds',
    'quick-actions'
  ],
  hidden: []
}

const DB_KEY = 'ui.dashboard.layout.v1'
const LEGACY_STORAGE_KEY = 'dsm.dashboard.layout.v1'

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return DASHBOARD_WIDGETS.some(widget => widget.id === value)
}

export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  const source = value && typeof value === 'object' ? value as Partial<DashboardLayout> : {}
  const requestedOrder = Array.isArray(source.order) ? source.order.filter(isWidgetId) : []
  const uniqueOrder = Array.from(new Set(requestedOrder))
  const missing = DEFAULT_DASHBOARD_LAYOUT.order.filter(id => !uniqueOrder.includes(id))
  const hidden = Array.isArray(source.hidden)
    ? Array.from(new Set(source.hidden.filter(isWidgetId))).filter(id => id !== 'runtime')
    : []

  return {
    schemaVersion: 1,
    density: source.density === 'compact' ? 'compact' : 'comfortable',
    order: [...uniqueOrder, ...missing],
    hidden
  }
}

function defaultLayout(): DashboardLayout {
  return { ...DEFAULT_DASHBOARD_LAYOUT, order:[...DEFAULT_DASHBOARD_LAYOUT.order], hidden:[] }
}

export async function loadDashboardLayout() {
  const stored = await window.dockerApi.preferences.get<DashboardLayout>(DB_KEY)
  if (stored) return normalizeDashboardLayout(stored)

  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const migrated = normalizeDashboardLayout(JSON.parse(legacyRaw))
      await window.dockerApi.preferences.set(DB_KEY, migrated)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return migrated
    }
  } catch {
    // Ignore malformed legacy renderer storage.
  }

  const initial = defaultLayout()
  await window.dockerApi.preferences.set(DB_KEY, initial)
  return initial
}

export async function saveDashboardLayout(layout: DashboardLayout) {
  await window.dockerApi.preferences.set(DB_KEY, normalizeDashboardLayout(layout))
}

export async function resetDashboardLayout() {
  await window.dockerApi.preferences.remove(DB_KEY)
  const initial = defaultLayout()
  await window.dockerApi.preferences.set(DB_KEY, initial)
  return initial
}
