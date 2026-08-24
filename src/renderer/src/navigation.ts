import {
  Alert02Icon,
  Activity01Icon,
  CleanIcon,
  ContainerIcon,
  Database01Icon,
  Globe02Icon,
  HardDriveIcon,
  Home01Icon,
  Image01Icon,
  Layers01Icon,
  Notification03Icon,
  Search01Icon,
  Settings01Icon
} from '@hugeicons/core-free-icons'

export type PageId =
  | 'dashboard' | 'uptime' | 'notifications' | 'activity' | 'tasks' | 'productivity' | 'audit'
  | 'containers' | 'compose' | 'ports' | 'resource-graph' | 'images' | 'buildkit'
  | 'volumes' | 'networks' | 'cleanup' | 'storage' | 'settings' | 'about'

type NavigationItem = { id: PageId; label: string; icon: any; group: string; hidden?: boolean }

export const NAV_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: Home01Icon, group: 'Overview' },
  { id: 'uptime' as const, label: 'Uptime Reports', icon: Activity01Icon, group: 'Overview' },
  { id: 'notifications' as const, label: 'Notifications', icon: Notification03Icon, group: 'Overview', hidden: true },
  { id: 'activity' as const, label: 'Activity', icon: Alert02Icon, group: 'Overview' },
  { id: 'tasks' as const, label: 'Task Center', icon: Layers01Icon, group: 'Overview' },
  { id: 'productivity' as const, label: 'Productivity', icon: Search01Icon, group: 'Overview' },
  { id: 'audit' as const, label: 'Audit & Recovery', icon: Database01Icon, group: 'Overview' },
  { id: 'containers' as const, label: 'Containers', icon: ContainerIcon, group: 'Resources' },
  { id: 'compose' as const, label: 'Compose', icon: Layers01Icon, group: 'Resources' },
  { id: 'ports' as const, label: 'Port Explorer', icon: Globe02Icon, group: 'Resources' },
  { id: 'resource-graph' as const, label: 'Resource Graph', icon: Layers01Icon, group: 'Resources' },
  { id: 'images' as const, label: 'Images', icon: Image01Icon, group: 'Resources' },
  { id: 'buildkit' as const, label: 'BuildKit', icon: Layers01Icon, group: 'Resources' },
  { id: 'volumes' as const, label: 'Volumes', icon: Database01Icon, group: 'Resources' },
  { id: 'networks' as const, label: 'Networks', icon: Globe02Icon, group: 'Resources' },
  { id: 'cleanup' as const, label: 'Cleanup Advisor', icon: CleanIcon, group: 'Storage' },
  { id: 'storage' as const, label: 'Storage Trends', icon: HardDriveIcon, group: 'Storage' },
  { id: 'settings' as const, label: 'Settings', icon: Settings01Icon, group: 'App' },
  { id: 'about' as const, label: 'About & Updates', icon: Settings01Icon, group: 'App' }
] as const

export function pageMeta(page: PageId) {
  return NAV_ITEMS.find(item => item.id === page)!
}
