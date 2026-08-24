import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AppIcon } from './components/Icon'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { DashboardPage } from './pages/DashboardPage'
import { CommandPalette } from './components/CommandPalette'
import { LoadingState, LiveRegion } from './components/ui'
import { buildResourceItems, PAGE_ITEMS, QUICK_ACTIONS, type ProductivityItem } from './productivity/model'
import { productivityStorage } from './productivity/storage'
import appIconUrl from './assets/app-icon.png'

const ContainersPage = lazy(() => import('./pages/ContainersPage').then(module => ({ default: module.ContainersPage })))
const ComposePage = lazy(() => import('./pages/ComposePage').then(module => ({ default: module.ComposePage })))
const PortExplorerPage = lazy(() => import('./pages/PortExplorerPage').then(module => ({ default: module.PortExplorerPage })))
const ResourceGraphPage = lazy(() => import('./pages/ResourceGraphPage').then(module => ({ default: module.ResourceGraphPage })))
const ImagesPage = lazy(() => import('./pages/ImagesPage').then(module => ({ default: module.ImagesPage })))
const VolumesPage = lazy(() => import('./pages/VolumesPage').then(module => ({ default: module.VolumesPage })))
const NetworksPage = lazy(() => import('./pages/NetworksPage').then(module => ({ default: module.NetworksPage })))
const CleanupPage = lazy(() => import('./pages/CleanupPage').then(module => ({ default: module.CleanupPage })))
const StoragePage = lazy(() => import('./pages/StoragePage').then(module => ({ default: module.StoragePage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })))
const ActivityPage = lazy(() => import('./pages/ActivityPage').then(module => ({ default: module.ActivityPage })))
const TaskCenterPage = lazy(() => import('./pages/TaskCenterPage').then(module => ({ default: module.TaskCenterPage })))
const BuildKitPage = lazy(() => import('./pages/BuildKitPage').then(module => ({ default: module.BuildKitPage })))
const ProductivityPage = lazy(() => import('./pages/ProductivityPage').then(module => ({ default: module.ProductivityPage })))
const AuditPage = lazy(() => import('./pages/AuditPage').then(module => ({ default: module.AuditPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const AboutPage = lazy(() => import('./pages/AboutPage').then(module => ({ default: module.AboutPage })))

export type { PageId } from './navigation'
import type { PageId } from './navigation'
import { NAV_ITEMS } from './navigation'

export function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('dark')
  const [engineUp, setEngineUp] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteItems, setPaletteItems] = useState<ProductivityItem[]>([...PAGE_ITEMS, ...QUICK_ACTIONS])
  const [announcement, setAnnouncement] = useState('Dashboard opened')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    window.dockerApi.settings.get().then(settings => setTheme(settings.general.theme)).catch(() => undefined)
  }, [])

  useEffect(() => window.electron.onNavigate(target => navigate(target as PageId)), [])

  useEffect(() => {
    let alive = true
    void window.dockerApi.engine.status()
      .then(status => { if (alive) setEngineUp(status.reachable) })
      .catch(() => { if (alive) setEngineUp(false) })
    return () => { alive = false }
  }, [page])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const palette =
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'k' || (event.shiftKey && event.key.toLowerCase() === 'p'))

      if (palette) {
        event.preventDefault()
        void openPalette()
      }
      if (event.key === 'Escape') setPaletteOpen(false)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function navigate(target: PageId) {
    setPage(target)
    const label = NAV_ITEMS.find(item => item.id === target)?.label ?? target
    setAnnouncement(`${label} opened`)
  }

  async function openPalette() {
    setPaletteOpen(true)
    try {
      const [containers, compose, images] = await Promise.all([
        window.dockerApi.containers.list().catch(() => []),
        window.dockerApi.compose.list().catch(() => []),
        window.dockerApi.images.list().catch(() => [])
      ])
      setPaletteItems([...PAGE_ITEMS, ...QUICK_ACTIONS, ...buildResourceItems(containers, compose, images)])
    } catch {
      setPaletteItems([...PAGE_ITEMS, ...QUICK_ACTIONS])
    }
  }

  function rememberIntent(item: ProductivityItem) {
    sessionStorage.setItem('dsm.m08.intent', JSON.stringify({
      page: item.page,
      kind: item.kind,
      resourceId: item.resourceId,
      resourceName: item.resourceName,
      tab: item.action === 'logs' ? 'logs' : undefined,
      createdAt: Date.now()
    }))
    void productivityStorage.addRecent(item)
  }

  async function executePaletteItem(item: ProductivityItem) {
    if (!item.action || item.action === 'open' || item.action === 'logs') {
      rememberIntent(item)
      navigate(item.page)
      return
    }

    const started = new Date().toISOString()
    let ok = false
    let message = ''

    try {
      let result: any

      if (item.action === 'start' && item.resourceId) {
        result = await window.dockerApi.containers.start([item.resourceId])
      }

      if (item.action === 'stop' && item.resourceId) {
        if (!window.confirm(`Gracefully stop ${item.resourceName ?? 'this container'}?`)) return
        result = await window.dockerApi.containers.stop([item.resourceId], 10)
      }

      if (item.action === 'restart' && item.resourceId) {
        result = await window.dockerApi.containers.restart([item.resourceId])
      }

      if (item.action === 'safe-cleanup') {
        if (!window.confirm('Run Safe Cleanup? Volumes are excluded.')) return
        const rows = await window.dockerApi.cleanup.safe(false)
        ok = rows.every(row => row.ok)
        message = rows.map(row => row.stdout || row.stderr).filter(Boolean).join(' · ')
      } else if (item.action === 'prune-build-cache') {
        if (!window.confirm('Prune unused Build Cache?')) return
        result = await window.dockerApi.buildkit.prune(false, 0)
      } else if (item.action === 'refresh-monitoring') {
        await window.dockerApi.monitoring.refresh()
        ok = true
        message = 'Operational health refreshed.'
      }

      if (result) {
        ok = Boolean(result.ok)
        message = result.stdout || result.stderr || 'Operation completed.'
      }
    } catch (error) {
      ok = false
      message = error instanceof Error ? error.message : String(error)
    }

    await productivityStorage.addHistory({
      id: crypto.randomUUID(),
      itemId: item.id,
      title: item.title,
      subtitle: item.subtitle,
      kind: item.kind,
      page: item.page,
      resourceId: item.resourceId,
      resourceName: item.resourceName,
      action: item.action,
      executedAt: started,
      ok,
      message: message.slice(0, 500)
    })

    setAnnouncement(`${item.title}: ${ok ? 'completed' : 'failed'}`)
    navigate(item.page)
  }

  const content = useMemo(() => {
    switch (page) {
      case 'activity': return <ActivityPage />
      case 'tasks': return <TaskCenterPage onNavigate={navigate} />
      case 'notifications': return <NotificationsPage onNavigate={target => navigate(target as PageId)} />
      case 'productivity': return <ProductivityPage onOpen={target => navigate(target as PageId)} />
      case 'audit': return <AuditPage />
      case 'containers': return <ContainersPage filter="" />
      case 'compose': return <ComposePage filter="" />
      case 'ports': return <PortExplorerPage onNavigate={navigate} />
      case 'resource-graph': return <ResourceGraphPage onNavigate={navigate} />
      case 'images': return <ImagesPage filter="" />
      case 'buildkit': return <BuildKitPage />
      case 'volumes': return <VolumesPage filter="" onNavigate={navigate} />
      case 'networks': return <NetworksPage filter="" />
      case 'cleanup': return <CleanupPage />
      case 'storage': return <StoragePage />
      case 'settings': return <SettingsPage onThemeChange={setTheme} />
      case 'about': return <AboutPage />
      default: return <DashboardPage onNavigate={navigate} />
    }
  }, [page])

  let lastGroup = ''

  return (
    <div className="app-shell">
      <div className="window-drag-region" aria-hidden="true" />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <LiveRegion message={announcement} />

      <aside className="sidebar" aria-label="DockScope sidebar">
        <div className="brand">
          <div className="brand-mark"><img src={appIconUrl} alt="" aria-hidden="true" /></div>
          <div><strong>DockScope</strong><span>Docker Operations & Intelligence</span></div>
        </div>

        <nav className="nav" aria-label="Primary navigation">
          {NAV_ITEMS.map(item => {
            const group = item.group !== lastGroup ? item.group : ''
            lastGroup = item.group

            return (
              <div key={item.id}>
                {group && <div className="nav-group">{group}</div>}
                <button
                  className={`nav-item ${page === item.id ? 'active' : ''}`}
                  aria-current={page === item.id ? 'page' : undefined}
                  title={item.label}
                  onClick={() => navigate(item.id)}
                >
                  <AppIcon icon={item.icon} />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            className="search global-search-trigger"
            onClick={() => void openPalette()}
            aria-label="Open global command palette"
          >
            <AppIcon icon={Search01Icon} />
            <span>Search resources or run a command…</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="engine-pill" role="status" aria-live="polite">
            <span className={`status-dot ${engineUp ? 'ok' : 'bad'}`} />
            <span>Docker Engine {engineUp ? 'Running' : 'Unavailable'}</span>
          </div>
        </header>

        <div className="workspace">
          <Suspense fallback={<LoadingState label="Loading workspace" rows={8} />}>
            {content}
          </Suspense>
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        onClose={() => setPaletteOpen(false)}
        onExecute={executePaletteItem}
      />
    </div>
  )
}
