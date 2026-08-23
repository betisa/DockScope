import type { ComposeProject, ContainerInfo, ImageInfo } from '../../../shared/contracts'
import type { PageId } from '../App'

export type ProductivityResourceKind = 'page' | 'container' | 'compose' | 'image' | 'action'

export type ProductivityItem = {
  id: string
  kind: ProductivityResourceKind
  title: string
  subtitle: string
  keywords: string
  page: PageId
  resourceId?: string
  resourceName?: string
  action?: 'open' | 'start' | 'stop' | 'restart' | 'logs' | 'safe-cleanup' | 'prune-build-cache' | 'refresh-monitoring'
  danger?: boolean
}

export type ProductivityHistoryEntry = {
  id: string
  itemId: string
  title: string
  subtitle: string
  kind: ProductivityResourceKind
  page: PageId
  resourceId?: string
  resourceName?: string
  action?: ProductivityItem['action']
  executedAt: string
  ok: boolean
  message?: string
}

export type RecentResource = {
  id: string
  title: string
  subtitle: string
  kind: ProductivityResourceKind
  page: PageId
  resourceId?: string
  resourceName?: string
  openedAt: string
}

export const PAGE_ITEMS: ProductivityItem[] = [
  ['dashboard','Dashboard','Docker workstation overview','overview home docker'],
  ['notifications','Notifications','Operational alerts and monitoring','alerts health monitoring'],
  ['activity','Activity','Docker daemon event stream','events runtime activity'],
  ['tasks','Task Center','Long-running Docker operation queue','tasks operations queue progress output cancel'],
  ['containers','Containers','Runtime container management','containers runtime logs terminal'],
  ['compose','Compose','Compose project workspace','compose stack services'],
  ['ports','Port Explorer','Published ports and host bindings','ports bindings endpoints tcp udp conflict'],
  ['resource-graph','Resource Graph','Docker dependency and ownership topology','graph dependency topology compose containers images volumes networks ports'],
  ['images','Images','Docker image inventory','images registry'],
  ['buildkit','BuildKit','Builders and build cache','build cache buildx'],
  ['volumes','Volumes','Persistent Docker storage','volumes database persistent'],
  ['networks','Networks','Docker network inventory','network bridge'],
  ['cleanup','Cleanup Advisor','Risk-aware storage cleanup','prune cleanup reclaimable'],
  ['storage','Storage Trends','Docker storage history and VHDX','storage trends history vhdx wsl compact'],
  ['settings','Settings','Profiles and application configuration','settings profile configuration'],
  ['about','About & Updates','Version, release notes and desktop updates','about version electron node docker update release channel']
].map(([page,title,subtitle,keywords]) => ({
  id:`page:${page}`, kind:'page' as const, title, subtitle, keywords, page:page as PageId, action:'open' as const
}))

export function buildResourceItems(containers: ContainerInfo[], compose: ComposeProject[], images: ImageInfo[]): ProductivityItem[] {
  const items: ProductivityItem[] = []
  for (const c of containers) {
    items.push({ id:`container:${c.id}`, kind:'container', title:c.name, subtitle:`${c.state} · ${c.image}`, keywords:`container ${c.name} ${c.image} ${c.state} ${c.status}`, page:'containers', resourceId:c.id, resourceName:c.name, action:'open' })
    items.push({ id:`action:restart:${c.id}`, kind:'action', title:`Restart ${c.name}`, subtitle:'Container quick action', keywords:`restart container ${c.name}`, page:'containers', resourceId:c.id, resourceName:c.name, action:'restart' })
    if (c.state === 'running') {
      items.push({ id:`action:stop:${c.id}`, kind:'action', title:`Stop ${c.name}`, subtitle:'Graceful container stop', keywords:`stop container ${c.name}`, page:'containers', resourceId:c.id, resourceName:c.name, action:'stop' })
      items.push({ id:`action:logs:${c.id}`, kind:'action', title:`Logs: ${c.name}`, subtitle:'Open container diagnostics workspace', keywords:`logs container ${c.name}`, page:'containers', resourceId:c.id, resourceName:c.name, action:'logs' })
    } else {
      items.push({ id:`action:start:${c.id}`, kind:'action', title:`Start ${c.name}`, subtitle:'Start stopped container', keywords:`start container ${c.name}`, page:'containers', resourceId:c.id, resourceName:c.name, action:'start' })
    }
  }
  for (const p of compose) {
    items.push({ id:`compose:${p.name}`, kind:'compose', title:p.name, subtitle:p.status || 'Compose project', keywords:`compose stack project ${p.name} ${p.status}`, page:'compose', resourceName:p.name, action:'open' })
  }
  for (const img of images) {
    items.push({ id:`image:${img.id}:${img.repository}:${img.tag}`, kind:'image', title:`${img.repository}:${img.tag}`, subtitle:`${img.size} · ${img.createdSince}`, keywords:`image ${img.repository} ${img.tag} ${img.id}`, page:'images', resourceId:img.id, resourceName:`${img.repository}:${img.tag}`, action:'open' })
  }
  return items
}

export const QUICK_ACTIONS: ProductivityItem[] = [
  { id:'quick:safe-cleanup', kind:'action', title:'Run Safe Cleanup', subtitle:'Prune stopped containers, dangling images, networks and build cache', keywords:'safe cleanup prune reclaim', page:'cleanup', action:'safe-cleanup' },
  { id:'quick:build-cache', kind:'action', title:'Prune Build Cache', subtitle:'Remove unused build cache', keywords:'build cache prune buildkit', page:'buildkit', action:'prune-build-cache' },
  { id:'quick:monitoring', kind:'action', title:'Refresh Operational Health', subtitle:'Refresh Docker health and alert state now', keywords:'monitoring health notifications refresh', page:'notifications', action:'refresh-monitoring' }
]

export function fuzzyScore(query: string, item: ProductivityItem): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const text = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase()
  if (text.includes(q)) return 100 - text.indexOf(q) / Math.max(text.length, 1)
  let score = 0
  let cursor = 0
  for (const char of q) {
    const found = text.indexOf(char, cursor)
    if (found < 0) return -1
    score += found === cursor ? 4 : 1
    cursor = found + 1
  }
  if (item.title.toLowerCase().startsWith(q[0] ?? '')) score += 10
  return score
}
