import { run } from './processRunner'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CleanupAdvisorItem,
  SmartCleanupPlan,
  SmartCleanupPlanStep,
  ComposeProject,
  ComposeServiceInfo,
  ComposeWorkspaceModel,
  ComposeValidation,
  ContainerInfo,
  ContainerDirectoryListing,
  ContainerFileEntry,
  ContainerTextFile,
  ContainerAdvisorResult,
  ContainerDiagnosticFinding,
  ContainerStatsSnapshot,
  DiskUsage,
  EngineStatus,
  ImageInfo,
  NetworkInfo,
  PortBindingInfo,
  PortExplorerResult,
  ResourceDependencyGraph,
  ResourceGraphEdge,
  ResourceGraphNode,
  VolumeInfo,
  VolumeIntelligence,
  VolumeReference,
  VolumeWorkload,
  BuilderInfo,
  BuildHistoryRecord,
  BuildHistoryDetails,
  BuildDiagnosticFinding,
  BuildDiagnostics,
  BuildCacheRecord,
  ImageHistoryLayer,
  ImageInsight,
  HealthLogEntry
} from '../../shared/contracts'

function parseJsonLines<T>(raw: string): T[] {
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

type ContainerRuntimeMetadata = {
  startedAt: string
}

async function inspectContainerRuntime(ids: string[]): Promise<Map<string, ContainerRuntimeMetadata>> {
  const metadata = new Map<string, ContainerRuntimeMetadata>()
  if (!ids.length) return metadata

  const result = await run('docker', ['container', 'inspect', ...ids])
  if (!result.ok) return metadata

  let rows: any[]
  try {
    const parsed = JSON.parse(result.stdout || '[]')
    rows = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return metadata
  }

  for (const row of rows) {
    const id = String(row?.Id ?? row?.ID ?? '')
    if (!id) continue
    metadata.set(id, { startedAt: String(row?.State?.StartedAt ?? '') })
  }

  return metadata
}

function projectArgs(project: ComposeProject): string[] {
  const files = project.configFiles
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  const args = ['compose', '-p', project.name]
  for (const file of files) args.push('-f', file)
  return args
}


function projectFiles(project: ComposeProject): string[] {
  return project.configFiles.split(',').map((x) => x.trim()).filter(Boolean).map((x) => path.resolve(x))
}

function ensureProjectFile(project: ComposeProject, requested?: string): string {
  const files = projectFiles(project)
  if (!files.length) throw new Error('Compose project does not expose a configuration file.')
  const target = path.resolve(requested || files[0])
  if (!files.some((x) => x.toLowerCase() === target.toLowerCase())) throw new Error('Requested file is outside the Compose project configuration set.')
  return target
}

function serviceName(value: string): string {
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) throw new Error('Invalid Compose service name.')
  return value
}

function normalizeDependsOn(value: any): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value && typeof value === 'object') return Object.keys(value)
  return []
}

function normalizeEnvironment(value: any): Record<string,string> {
  if (!value) return {}
  if (Array.isArray(value)) return Object.fromEntries(value.map((x:any) => { const text=String(x); const i=text.indexOf('='); return i < 0 ? [text,''] : [text.slice(0,i),text.slice(i+1)] }))
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, v == null ? '' : String(v)]))
  return {}
}


function parseVolumeSizesFromSystemDf(raw: string): Map<string, string> {
  const sizes = new Map<string, string>()
  const lines = raw.split(/\r?\n/)
  const sectionIndex = lines.findIndex(line => /Local Volumes space usage:/i.test(line))
  if (sectionIndex < 0) return sizes

  for (let index = sectionIndex + 1; index < lines.length; index++) {
    const line = lines[index].trim()
    if (!line) continue
    if (/^NAME\s+LINKS\s+SIZE$/i.test(line)) continue
    if (/^[A-Za-z ]+space usage:/i.test(line) || /^Build cache usage:/i.test(line)) break

    const match = line.match(/^(\S+)\s+(\d+)\s+(.+)$/)
    if (match) sizes.set(match[1], match[3].trim())
  }

  return sizes
}

function firstValue(source: any, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function buildIdFromRef(ref: string) {
  const parts = ref.split('/').filter(Boolean)
  return parts.at(-1) ?? ref
}

function humanDurationBetween(startValue: string, endValue: string) {
  if (!startValue || !endValue) return ''
  const start = Date.parse(startValue)
  const end = Date.parse(endValue)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return ''

  const milliseconds = end - start
  if (milliseconds < 1000) return `${milliseconds}ms`

  const totalSeconds = milliseconds / 1000
  if (totalSeconds < 60) {
    const rounded = totalSeconds < 10
      ? Math.round(totalSeconds * 10) / 10
      : Math.round(totalSeconds)
    return `${rounded}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds - minutes * 60)
  if (minutes < 60) return `${minutes}m ${seconds}s`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function humanDurationMs(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds}ms`
  const totalSeconds = milliseconds / 1000
  if (totalSeconds < 60) return `${Math.round(totalSeconds * 10) / 10}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds - minutes * 60)
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function analyzeBuildFailure(details: BuildHistoryDetails, logs: string): BuildDiagnosticFinding[] {
  const findings: BuildDiagnosticFinding[] = []
  const text = logs.replace(/\x1b\[[0-9;]*m/g, '')
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const evidence = (pattern: RegExp) => lines.find(line => pattern.test(line))?.slice(0, 420) ?? ''
  const add = (severity: BuildDiagnosticFinding['severity'], title: string, pattern: RegExp, recommendation: string) => {
    const hit = evidence(pattern)
    if (hit) findings.push({ severity, title, evidence: hit, recommendation })
  }

  add('critical', 'Build step failed', /(^|\s)(ERROR|error):|failed to solve|executor failed|process .* did not complete successfully/i,
    'Open the Logs tab, locate the first failing step, and fix that command before rebuilding.')
  add('critical', 'Out of disk space', /no space left on device|ENOSPC/i,
    'Reclaim BuildKit cache or Docker storage, then retry the build.')
  add('critical', 'Permission problem', /permission denied|EACCES|operation not permitted/i,
    'Review file ownership, executable bits, USER directives, bind-mount permissions, and credentials used by the failing step.')
  add('warning', 'Network or DNS failure', /temporary failure in name resolution|could not resolve host|network is unreachable|connection timed out|ECONNRESET|ENOTFOUND/i,
    'Verify Docker/BuildKit network access, DNS, proxy configuration, registry reachability, and corporate VPN/firewall rules.')
  add('warning', 'Package restore/install failure', /(npm ERR!|pnpm ERR|yarn error|NU1301|Unable to load the service index|apt-get.*(failed|error)|apk.*(failed|error))/i,
    'Inspect the package-manager output, lockfile, registry credentials, proxy settings, and package source availability.')
  add('warning', 'Missing file or path', /no such file or directory|cannot find the file|not found in build context|COPY failed/i,
    'Check build context, .dockerignore, Dockerfile COPY/ADD paths, and generated files required before the failing step.')
  add('warning', 'Command exited non-zero', /exit code: [1-9]\d*|exited with code [1-9]\d*/i,
    'Inspect the command immediately above this error and reproduce it in the same build stage when possible.')

  if (/error|failed|canceled/i.test(details.status) && !findings.length) {
    const tail = lines.slice(-1)[0] ?? 'Buildx reports a non-success status without a recognized error signature.'
    findings.push({
      severity: 'warning',
      title: 'Build did not complete successfully',
      evidence: tail.slice(0, 420),
      recommendation: 'Review the final log lines and the failed build step. The rule-based analyzer did not match a known failure pattern.'
    })
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: 'No known failure pattern detected',
      evidence: details.status ? `Build status: ${details.status}` : 'No failure signature was detected in the available logs.',
      recommendation: 'Use Logs, Timing, and Cache tabs for manual analysis. This advisor intentionally avoids guessing without evidence.'
    })
  }

  return findings.slice(0, 8)
}

function portExposure(hostIp: string, hostPort: string) {
  if (!hostPort) return 'routed' as const
  if (hostIp === '::') return 'ipv6-all' as const
  if (!hostIp || hostIp === '0.0.0.0') return 'all-interfaces' as const
  if (hostIp === '127.0.0.1' || hostIp === '::1' || hostIp.toLowerCase() === 'localhost') return 'loopback' as const
  return 'specific-interface' as const
}

function normalizedEndpointHost(hostIp: string) {
  if (!hostIp || hostIp === '0.0.0.0' || hostIp === '::') return 'localhost'
  if (hostIp === '::1') return '[::1]'
  return hostIp.includes(':') ? `[${hostIp}]` : hostIp
}

function browserScheme(containerPort: number, hostPort: number | null) {
  const port = hostPort ?? containerPort
  if ([443, 8443, 9443].includes(port) || [443, 8443, 9443].includes(containerPort)) return 'https'
  return 'http'
}

function isLikelyHttpPort(containerPort: number, hostPort: number | null) {
  const candidates = new Set([80, 443, 3000, 3001, 4200, 5000, 5001, 5173, 5174, 8000, 8001, 8080, 8081, 8088, 8443, 8888, 9000, 9001, 9443])
  return candidates.has(containerPort) || (hostPort != null && candidates.has(hostPort))
}

function ipv4Wildcard(hostIp: string) {
  return !hostIp || hostIp === '0.0.0.0'
}

function ipv6Wildcard(hostIp: string) {
  return hostIp === '::'
}

function bindingsOverlap(a: PortBindingInfo, b: PortBindingInfo) {
  if (!a.published || !b.published || a.hostPort == null || b.hostPort == null) return false
  if (a.protocol.toLowerCase() !== b.protocol.toLowerCase()) return false
  if (a.hostPort !== b.hostPort) return false

  const aIp = a.hostIp || '0.0.0.0'
  const bIp = b.hostIp || '0.0.0.0'
  if (aIp === bIp) return true

  const aV6 = aIp.includes(':')
  const bV6 = bIp.includes(':')
  if (aV6 !== bV6) return false

  if (!aV6 && (ipv4Wildcard(aIp) || ipv4Wildcard(bIp))) return true
  if (aV6 && (ipv6Wildcard(aIp) || ipv6Wildcard(bIp))) return true
  return false
}

function stringRecord(value: any): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item == null ? '' : String(item)]))
}

function detectVolumeWorkloads(name: string, references: VolumeReference[], labels: Record<string, string>): VolumeWorkload[] {
  const corpus = [
    name,
    ...Object.entries(labels).flatMap(([key, value]) => [key, value]),
    ...references.flatMap(reference => [
      reference.containerName,
      reference.image,
      reference.composeProject,
      reference.composeService,
      reference.destination
    ])
  ].join(' ').toLowerCase()

  const rules: Array<{ kind: VolumeWorkload['kind']; label: string; patterns: RegExp[]; destinations: RegExp[] }> = [
    { kind:'postgresql', label:'PostgreSQL', patterns:[/\bpostgres(?:ql)?\b/], destinations:[/\/var\/lib\/postgresql\/data/i] },
    { kind:'mysql-mariadb', label:'MySQL / MariaDB', patterns:[/\bmysql\b/,/\bmariadb\b/], destinations:[/\/var\/lib\/mysql/i] },
    { kind:'sql-server', label:'SQL Server', patterns:[/\bmssql\b/,/\bsql[- ]?server\b/,/mcr\.microsoft\.com\/mssql/i], destinations:[/\/var\/opt\/mssql/i] },
    { kind:'mongodb', label:'MongoDB', patterns:[/\bmongo(?:db)?\b/], destinations:[/\/data\/db/i] },
    { kind:'redis', label:'Redis', patterns:[/\bredis\b/], destinations:[/^\/data$/i,/\/data\/?$/i] },
    { kind:'minio', label:'MinIO / Object Storage', patterns:[/\bminio\b/], destinations:[/^\/data$/i,/\/data\/?$/i] },
    { kind:'elasticsearch', label:'Elasticsearch', patterns:[/\belasticsearch\b/], destinations:[/\/usr\/share\/elasticsearch\/data/i] }
  ]

  const findings: VolumeWorkload[] = []
  for (const rule of rules) {
    const evidence: string[] = []
    for (const pattern of rule.patterns) {
      const match = corpus.match(pattern)
      if (match) evidence.push(`Matched workload identifier: ${match[0]}`)
    }
    for (const reference of references) {
      if (rule.destinations.some(pattern => pattern.test(reference.destination))) {
        evidence.push(`Mounted at ${reference.destination} in ${reference.containerName}`)
      }
      if (rule.patterns.some(pattern => pattern.test(reference.image.toLowerCase()))) {
        evidence.push(`Container image: ${reference.image}`)
      }
    }
    if (evidence.length) {
      findings.push({
        kind: rule.kind,
        label: rule.label,
        confidence: evidence.some(item => item.startsWith('Mounted at') || item.startsWith('Container image')) ? 'high' : 'medium',
        evidence: Array.from(new Set(evidence)).slice(0, 5)
      })
    }
  }

  if (!findings.length && references.length) {
    findings.push({
      kind: 'generic',
      label: 'Application data',
      confidence: 'low',
      evidence: [`Referenced by ${references.length} container${references.length === 1 ? '' : 's'}`]
    })
  }
  return findings
}

function volumeRisk(
  size: string,
  references: VolumeReference[],
  workloads: VolumeWorkload[],
  labels: Record<string, string>,
  composeProjects: string[]
) {
  const reasons: string[] = []
  let score = 35

  if (references.length) {
    score += 30
    reasons.push(`Referenced by ${references.length} container${references.length === 1 ? '' : 's'}.`)
  } else {
    reasons.push('No current container reference was found; this does not prove the data is disposable.')
  }

  const persistentWorkloads = workloads.filter(item => item.kind !== 'generic')
  if (persistentWorkloads.length) {
    score += 30
    reasons.push(`Detected persistent workload: ${persistentWorkloads.map(item => item.label).join(', ')}.`)
  }

  if (composeProjects.length) {
    score += 12
    reasons.push(`Owned by Compose project(s): ${composeProjects.join(', ')}.`)
  }

  if (Object.keys(labels).length) {
    score += 8
    reasons.push('Volume has labels that may encode application ownership or lifecycle intent.')
  }

  const bytes = parseSizeToBytes(size)
  if (bytes >= 10 * 1024 ** 3) {
    score += 10
    reasons.push('Volume is at least 10 GiB.')
  } else if (bytes >= 1024 ** 3) {
    score += 5
    reasons.push('Volume is at least 1 GiB.')
  }

  score = Math.min(100, score)
  const level = score >= 80 ? 'critical' as const : score >= 55 ? 'high' as const : 'medium' as const
  const deletionAssessment = references.length
    ? 'blocked' as const
    : persistentWorkloads.length || composeProjects.length || Object.keys(labels).length
      ? 'high-risk' as const
      : 'review-required' as const

  const backupHints = persistentWorkloads.length
    ? persistentWorkloads.flatMap(workload => {
        if (workload.kind === 'postgresql') return ['Prefer a PostgreSQL logical backup (pg_dump/pg_dumpall) or a verified storage snapshot before deletion.']
        if (workload.kind === 'mysql-mariadb') return ['Prefer mysqldump/mariadb-dump or a verified storage snapshot before deletion.']
        if (workload.kind === 'sql-server') return ['Create and verify a SQL Server database backup before deleting the volume.']
        if (workload.kind === 'mongodb') return ['Prefer mongodump or a verified storage snapshot before deletion.']
        if (workload.kind === 'redis') return ['Confirm RDB/AOF persistence requirements and copy verified persistence data before deletion.']
        if (workload.kind === 'minio') return ['Verify object replication/export or another tested backup before deleting object-storage data.']
        if (workload.kind === 'elasticsearch') return ['Use a verified Elasticsearch snapshot repository before deleting data volumes.']
        return []
      })
    : ['Inspect the owning application and create a verified backup/export before deletion when the data may be valuable.']

  return { score, level, deletionAssessment, reasons, backupHints: Array.from(new Set(backupHints)) }
}

function parseSizeToBytes(input: string): number {
  const m = input.trim().match(/^([\d.]+)\s*([kmgt]?i?b)?$/i)
  if (!m) return 0
  const value = Number(m[1])
  const unit = (m[2] ?? 'b').toLowerCase()
  const map: Record<string, number> = {
    b: 1, kb: 1000, mb: 1000**2, gb: 1000**3, tb: 1000**4,
    kib: 1024, mib: 1024**2, gib: 1024**3, tib: 1024**4
  }
  return value * (map[unit] ?? 1)
}

function parseCleanupEstimate(input: string) {
  const match = String(input ?? '').trim().match(/([\d.]+)\s*([kmgt]?i?b)/i)
  if (!match) return 0
  return parseSizeToBytes(`${match[1]}${match[2]}`)
}

function formatCleanupBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

function safeContainerPath(value: string) {
  const input = String(value ?? '').trim()
  if (!input.startsWith('/')) throw new Error('Container path must be absolute.')
  if (input.includes('\0')) throw new Error('Container path contains an invalid null character.')
  if (input.length > 2048) throw new Error('Container path is too long.')
  const parts = input.split('/').filter(Boolean)
  if (parts.some(part => part === '..')) throw new Error('Parent traversal is not allowed.')
  return '/' + parts.join('/')
}

function parentContainerPath(value: string) {
  const safe = safeContainerPath(value)
  if (safe === '/') return '/'
  const index = safe.lastIndexOf('/')
  return index <= 0 ? '/' : safe.slice(0, index)
}

function formatFilePermissions(mode: number, type: ContainerFileEntry['type']) {
  const bits = mode & 0o777
  const flags = ['r', 'w', 'x']
  let permissions = type === 'directory' ? 'd' : type === 'symlink' ? 'l' : '-'
  for (let index = 0; index < 9; index++) {
    permissions += (bits & (1 << (8 - index))) ? flags[index % 3] : '-'
  }
  return permissions
}

function fileEntryType(stat: Awaited<ReturnType<typeof fs.lstat>>): ContainerFileEntry['type'] {
  if (stat.isSymbolicLink()) return 'symlink'
  if (stat.isDirectory()) return 'directory'
  if (stat.isFile()) return 'file'
  return 'other'
}

async function stageContainerPath(id: string, target: string) {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsm-container-files-'))
  const payloadPath = path.join(temporaryDirectory, 'payload')
  const result = await run('docker', ['cp', `${id}:${target}`, payloadPath])
  if (!result.ok) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
    throw new Error(result.stderr || 'Unable to read container filesystem.')
  }
  return { temporaryDirectory, payloadPath }
}

function redactDiagnosticEvidence(value: string) {
  return value
    .replace(/\b(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/ig, '$1••••••••')
    .replace(/\b(password|passwd|secret|token|api[_-]?key|connectionstring|credential)\s*[:=]\s*([^\s,;]+)/ig, '$1=••••••••')
}

function parseContainerStatsSnapshot(raw: string): ContainerStatsSnapshot | null {
  const text = raw.trim()
  if (!text) return null
  let row: any
  try { row = JSON.parse(text.split(/\r?\n/).filter(Boolean).at(-1) ?? text) } catch { return null }
  const percent = (value: unknown) => {
    const parsed = Number(String(value ?? '').replace('%','').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  const pids = Number(row.PIDs ?? row.Pids ?? 0)
  return {
    cpuPercent: percent(row.CPUPerc ?? row.CPUPercent),
    memoryPercent: percent(row.MemPerc ?? row.MemoryPercent),
    memoryUsage: String(row.MemUsage ?? row.MemoryUsage ?? ''),
    networkIo: String(row.NetIO ?? row.NetworkIO ?? ''),
    blockIo: String(row.BlockIO ?? ''),
    pids: Number.isFinite(pids) ? pids : 0
  }
}

export const dockerService = {
  async engineStatus(): Promise<EngineStatus> {
    const [version, compose, context] = await Promise.all([
      run('docker', ['version', '--format', '{{.Server.Version}}']),
      run('docker', ['compose', 'version', '--short']),
      run('docker', ['context', 'show'])
    ])

    return {
      reachable: version.ok,
      serverVersion: version.stdout.trim(),
      composeVersion: compose.stdout.trim(),
      context: context.stdout.trim()
    }
  },

  async diskUsage(): Promise<DiskUsage[]> {
    const result = await run('docker', ['system', 'df', '--format', 'json'])
    if (!result.ok) throw new Error(result.stderr || 'Unable to read Docker disk usage')

    return parseJsonLines<any>(result.stdout).map((x) => ({
      type: x.Type ?? '',
      totalCount: Number(x.TotalCount ?? 0),
      active: Number(x.Active ?? 0),
      size: x.Size ?? '0B',
      reclaimable: x.Reclaimable ?? '0B'
    }))
  },

  async containers(): Promise<ContainerInfo[]> {
    const result = await run('docker', [
      'container', 'ls', '-a', '--size', '--no-trunc', '--format', 'json'
    ])
    if (!result.ok) throw new Error(result.stderr)

    const inventory = parseJsonLines<any>(result.stdout)
    const metadata = await inspectContainerRuntime(inventory.map((x) => String(x.ID ?? '')).filter(Boolean))

    return inventory.map((x) => ({
      id: x.ID ?? '',
      name: x.Names ?? '',
      image: x.Image ?? '',
      state: x.State ?? '',
      startedAt: metadata.get(String(x.ID ?? ''))?.startedAt ?? '',
      status: x.Status ?? '',
      ports: x.Ports ?? '',
      size: x.Size ?? ''
    }))
  },


  async resourceDependencyGraph(): Promise<ResourceDependencyGraph> {
    const containerResult = await run('docker', [
      'container', 'ls', '-a', '--no-trunc', '--format', 'json'
    ])
    if (!containerResult.ok) throw new Error(containerResult.stderr || 'Unable to list Docker containers for dependency graph.')

    const inventory = parseJsonLines<any>(containerResult.stdout)
    const ids = inventory.map((row: any) => String(row.ID ?? '')).filter(Boolean)

    let inspected: any[] = []
    if (ids.length) {
      const inspectResult = await run('docker', ['container', 'inspect', ...ids])
      if (!inspectResult.ok) throw new Error(inspectResult.stderr || 'Unable to inspect Docker containers for dependency graph.')
      try {
        const parsed = JSON.parse(inspectResult.stdout)
        inspected = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        inspected = []
      }
    }

    const nodes = new Map<string, ResourceGraphNode>()
    const edges = new Map<string, ResourceGraphEdge>()
    const addNode = (node: ResourceGraphNode) => {
      const current = nodes.get(node.id)
      if (!current) nodes.set(node.id, node)
      else nodes.set(node.id, {
        ...current,
        metadata: { ...current.metadata, ...node.metadata },
        state: current.state || node.state,
        subtitle: current.subtitle || node.subtitle
      })
    }
    const addEdge = (edge: ResourceGraphEdge) => {
      if (!edges.has(edge.id)) edges.set(edge.id, edge)
    }

    for (const container of inspected) {
      const containerId = String(container.Id ?? container.ID ?? '')
      const containerName = String(container.Name ?? '').replace(/^\//, '') || containerId.slice(0, 12)
      const labels = stringRecord(container.Config?.Labels)
      const project = labels['com.docker.compose.project'] ?? ''
      const service = labels['com.docker.compose.service'] ?? ''
      const state = String(container.State?.Status ?? '')
      const imageName = String(container.Config?.Image ?? '')
      const imageId = String(container.Image ?? imageName)
      const containerNodeId = `container:${containerId}`

      addNode({
        id: containerNodeId,
        kind: 'container',
        label: containerName,
        subtitle: imageName || 'Container',
        state,
        resourceId: containerId,
        resourceName: containerName,
        parentProject: project,
        parentService: service,
        metadata: {
          image: imageName,
          createdAt: String(container.Created ?? ''),
          restartCount: String(container.RestartCount ?? 0),
          health: String(container.State?.Health?.Status ?? ''),
          platform: String(container.Platform ?? '')
        }
      })

      if (project) {
        const projectNodeId = `compose-project:${project}`
        addNode({
          id: projectNodeId,
          kind: 'compose-project',
          label: project,
          subtitle: 'Compose project',
          state: '',
          resourceId: project,
          resourceName: project,
          parentProject: project,
          parentService: '',
          metadata: {}
        })

        if (service) {
          const serviceNodeId = `compose-service:${project}:${service}`
          addNode({
            id: serviceNodeId,
            kind: 'compose-service',
            label: service,
            subtitle: project,
            state,
            resourceId: service,
            resourceName: service,
            parentProject: project,
            parentService: service,
            metadata: { project }
          })
          addEdge({
            id: `${projectNodeId}->${serviceNodeId}`,
            source: projectNodeId,
            target: serviceNodeId,
            kind: 'contains',
            label: 'contains'
          })
          addEdge({
            id: `${serviceNodeId}->${containerNodeId}`,
            source: serviceNodeId,
            target: containerNodeId,
            kind: 'runs',
            label: 'runs'
          })
        } else {
          addEdge({
            id: `${projectNodeId}->${containerNodeId}`,
            source: projectNodeId,
            target: containerNodeId,
            kind: 'runs',
            label: 'runs'
          })
        }
      }

      if (imageName || imageId) {
        const imageKey = imageId || imageName
        const imageNodeId = `image:${imageKey}`
        addNode({
          id: imageNodeId,
          kind: 'image',
          label: imageName || imageId.slice(0, 18),
          subtitle: imageId && imageId !== imageName ? imageId.replace('sha256:', '').slice(0, 12) : 'Image',
          state: '',
          resourceId: imageId,
          resourceName: imageName,
          parentProject: '',
          parentService: '',
          metadata: { imageId }
        })
        addEdge({
          id: `${containerNodeId}->${imageNodeId}`,
          source: containerNodeId,
          target: imageNodeId,
          kind: 'uses-image',
          label: 'uses'
        })
      }

      for (const mount of Array.isArray(container.Mounts) ? container.Mounts : []) {
        if (String(mount.Type ?? '').toLowerCase() !== 'volume') continue
        const volumeName = String(mount.Name ?? '')
        if (!volumeName) continue
        const volumeNodeId = `volume:${volumeName}`
        addNode({
          id: volumeNodeId,
          kind: 'volume',
          label: volumeName,
          subtitle: String(mount.Destination ?? 'Docker volume'),
          state: '',
          resourceId: volumeName,
          resourceName: volumeName,
          parentProject: '',
          parentService: '',
          metadata: {
            destination: String(mount.Destination ?? ''),
            mode: Boolean(mount.RW) ? 'read/write' : 'read-only',
            driver: String(mount.Driver ?? '')
          }
        })
        addEdge({
          id: `${containerNodeId}->${volumeNodeId}:${String(mount.Destination ?? '')}`,
          source: containerNodeId,
          target: volumeNodeId,
          kind: 'mounts',
          label: String(mount.Destination ?? 'mounts')
        })
      }

      const networks = container.NetworkSettings?.Networks ?? {}
      for (const [networkName, networkValue] of Object.entries<any>(networks)) {
        const networkId = String(networkValue?.NetworkID ?? networkName)
        const networkNodeId = `network:${networkId || networkName}`
        addNode({
          id: networkNodeId,
          kind: 'network',
          label: networkName,
          subtitle: String(networkValue?.IPAddress ?? '') || 'Docker network',
          state: '',
          resourceId: networkId,
          resourceName: networkName,
          parentProject: '',
          parentService: '',
          metadata: {
            ipv4: String(networkValue?.IPAddress ?? ''),
            ipv6: String(networkValue?.GlobalIPv6Address ?? ''),
            gateway: String(networkValue?.Gateway ?? ''),
            macAddress: String(networkValue?.MacAddress ?? '')
          }
        })
        addEdge({
          id: `${containerNodeId}->${networkNodeId}`,
          source: containerNodeId,
          target: networkNodeId,
          kind: 'connected-to',
          label: 'network'
        })
      }

      const ports = container.NetworkSettings?.Ports ?? {}
      for (const [privateSpec, bindings] of Object.entries<any>(ports)) {
        if (!Array.isArray(bindings) || !bindings.length) continue
        const [containerPort, protocol = 'tcp'] = privateSpec.split('/')
        for (const binding of bindings) {
          const hostIp = String(binding?.HostIp ?? '')
          const hostPort = String(binding?.HostPort ?? '')
          if (!hostPort) continue
          const normalizedHost = !hostIp || hostIp === '0.0.0.0' || hostIp === '::' ? 'localhost' : hostIp
          const portNodeId = `port:${hostIp}:${hostPort}:${protocol}`
          addNode({
            id: portNodeId,
            kind: 'port',
            label: `${normalizedHost}:${hostPort}/${protocol}`,
            subtitle: `→ ${containerPort}/${protocol}`,
            state,
            resourceId: `${hostIp}:${hostPort}:${protocol}`,
            resourceName: `${normalizedHost}:${hostPort}/${protocol}`,
            parentProject: project,
            parentService: service,
            metadata: {
              hostIp,
              hostPort,
              containerPort,
              protocol,
              exposure: portExposure(hostIp, hostPort)
            }
          })
          addEdge({
            id: `${containerNodeId}->${portNodeId}:${containerPort}`,
            source: containerNodeId,
            target: portNodeId,
            kind: 'publishes',
            label: `${containerPort}/${protocol}`
          })
        }
      }
    }

    const nodeList = Array.from(nodes.values())
    const edgeList = Array.from(edges.values())
    const sharedKinds = new Set(['image', 'volume', 'network', 'port'])
    const sharedResources = nodeList.filter(node =>
      sharedKinds.has(node.kind) &&
      edgeList.filter(edge => edge.target === node.id).length > 1
    ).length

    const count = (kind: ResourceGraphNode['kind']) => nodeList.filter(node => node.kind === kind).length

    return {
      nodes: nodeList.sort((left, right) =>
        left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label)
      ),
      edges: edgeList.sort((left, right) => left.id.localeCompare(right.id)),
      summary: {
        composeProjects: count('compose-project'),
        services: count('compose-service'),
        containers: count('container'),
        images: count('image'),
        volumes: count('volume'),
        networks: count('network'),
        ports: count('port'),
        sharedResources
      }
    }
  },

  async portExplorer(): Promise<PortExplorerResult> {
    const containerResult = await run('docker', [
      'container', 'ls', '-a', '--no-trunc', '--format', 'json'
    ])
    if (!containerResult.ok) throw new Error(containerResult.stderr || 'Unable to list containers for Port Explorer.')

    const inventory = parseJsonLines<any>(containerResult.stdout)
    const ids = inventory.map((row: any) => String(row.ID ?? '')).filter(Boolean)
    if (!ids.length) {
      return {
        bindings: [],
        summary: {
          totalBindings: 0,
          publishedBindings: 0,
          runningBindings: 0,
          conflictBindings: 0,
          httpCandidates: 0,
          loopbackBindings: 0,
          allInterfaceBindings: 0
        }
      }
    }

    const inspectResult = await run('docker', ['container', 'inspect', ...ids])
    if (!inspectResult.ok) throw new Error(inspectResult.stderr || 'Unable to inspect container port bindings.')

    const inspected = JSON.parse(inspectResult.stdout)
    const byId = new Map(inventory.map((row: any) => [String(row.ID ?? ''), row]))
    const bindings: PortBindingInfo[] = []

    for (const container of Array.isArray(inspected) ? inspected : [inspected]) {
      const containerId = String(container.Id ?? container.ID ?? '')
      const row = byId.get(containerId) ?? inventory.find((item: any) => String(item.ID ?? '').startsWith(containerId.slice(0, 12)))
      const containerName = String(container.Name ?? row?.Names ?? '').replace(/^\//, '')
      const containerState = String(container.State?.Status ?? row?.State ?? '')
      const labels = container.Config?.Labels ?? {}
      const image = String(container.Config?.Image ?? row?.Image ?? '')
      const ports = container.NetworkSettings?.Ports ?? {}

      for (const [privateSpec, rawBindings] of Object.entries<any>(ports)) {
        const [containerPortRaw, protocol = 'tcp'] = privateSpec.split('/')
        const containerPort = Number(containerPortRaw)
        if (!Number.isFinite(containerPort)) continue

        const values = Array.isArray(rawBindings) && rawBindings.length ? rawBindings : [{ HostIp: '', HostPort: '' }]
        for (const binding of values) {
          const hostIp = String(binding?.HostIp ?? '')
          const hostPortRaw = String(binding?.HostPort ?? '')
          const hostPortValue = hostPortRaw ? Number(hostPortRaw) : null
          const hostPort = hostPortValue != null && Number.isFinite(hostPortValue) ? hostPortValue : null
          const published = hostPort != null
          const exposure = portExposure(hostIp, hostPortRaw)
          const host = normalizedEndpointHost(hostIp)
          const endpoint = published ? `${host}:${hostPort}/${protocol}` : `${containerPort}/${protocol} (routed/no host port)`
          const likelyHttp = protocol.toLowerCase() === 'tcp' && published && isLikelyHttpPort(containerPort, hostPort)
          const suggestedUrl = likelyHttp ? `${browserScheme(containerPort, hostPort)}://${host}:${hostPort}` : ''

          bindings.push({
            id: `${containerId}:${privateSpec}:${hostIp}:${hostPortRaw}`,
            containerId,
            containerName,
            containerState,
            image,
            composeProject: String(labels['com.docker.compose.project'] ?? ''),
            composeService: String(labels['com.docker.compose.service'] ?? ''),
            hostIp,
            hostPort,
            containerPort,
            protocol: protocol.toLowerCase(),
            published,
            exposure,
            endpoint,
            suggestedUrl,
            canOpenInBrowser: Boolean(suggestedUrl),
            conflict: false,
            conflictWith: []
          })
        }
      }
    }

    const running = bindings.filter(binding => binding.containerState.toLowerCase() === 'running')
    for (let index = 0; index < running.length; index++) {
      for (let otherIndex = index + 1; otherIndex < running.length; otherIndex++) {
        const left = running[index]
        const right = running[otherIndex]
        if (left.containerId === right.containerId) continue
        if (!bindingsOverlap(left, right)) continue

        left.conflict = true
        right.conflict = true
        if (!left.conflictWith.includes(right.containerName)) left.conflictWith.push(right.containerName)
        if (!right.conflictWith.includes(left.containerName)) right.conflictWith.push(left.containerName)
      }
    }

    bindings.sort((left, right) =>
      Number(right.conflict) - Number(left.conflict) ||
      Number(right.containerState.toLowerCase() === 'running') - Number(left.containerState.toLowerCase() === 'running') ||
      (left.hostPort ?? Number.MAX_SAFE_INTEGER) - (right.hostPort ?? Number.MAX_SAFE_INTEGER) ||
      left.containerName.localeCompare(right.containerName)
    )

    return {
      bindings,
      summary: {
        totalBindings: bindings.length,
        publishedBindings: bindings.filter(binding => binding.published).length,
        runningBindings: bindings.filter(binding => binding.containerState.toLowerCase() === 'running' && binding.published).length,
        conflictBindings: bindings.filter(binding => binding.conflict).length,
        httpCandidates: bindings.filter(binding => binding.canOpenInBrowser).length,
        loopbackBindings: bindings.filter(binding => binding.exposure === 'loopback').length,
        allInterfaceBindings: bindings.filter(binding => binding.exposure === 'all-interfaces' || binding.exposure === 'ipv6-all').length
      }
    }
  },

  containerAction(action: 'start' | 'restart', ids: string[]) {
    return run('docker', ['container', action, ...ids])
  },

  stopContainers(ids: string[], timeout: number) {
    return run('docker', ['container', 'stop', '--timeout', String(timeout), ...ids])
  },

  removeContainers(ids: string[], force = false) {
    return run('docker', ['container', 'rm', ...(force ? ['--force'] : []), ...ids])
  },

  logs(id: string, tail = 300) {
    return run('docker', ['container', 'logs', '--timestamps', '--tail', String(tail), id])
  },

  inspect(id: string) {
    return run('docker', ['container', 'inspect', '--size', id])
  },

  stats(id: string) {
    return run('docker', [
      'stats', '--no-stream',
      '--format', 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}',
      id
    ])
  },

  exec(id: string, command: string[]) {
    return run('docker', ['container', 'exec', id, ...command])
  },

  async resolveContainerPath(id: string, requestedPath: string) {
    const target = safeContainerPath(requestedPath)
    const script = 'resolved="$(readlink -f "$DSM_PATH" 2>/dev/null || true)"; [ -n "$resolved" ] || exit 46; printf "%s" "$resolved"'
    const result = await run('docker', [
      'container', 'exec',
      '-e', `DSM_PATH=${target}`,
      id,
      'sh', '-c', script
    ])
    if (!result.ok || !result.stdout.trim()) throw new Error(result.stderr || 'Unable to resolve container path.')
    return safeContainerPath(result.stdout.trim())
  },

  copyFromContainer(id: string, containerPath: string, hostPath: string) {
    const target = safeContainerPath(containerPath)
    return run('docker', ['cp', `${id}:${target}`, hostPath])
  },

  copyToContainer(id: string, hostPath: string, containerPath: string) {
    const target = safeContainerPath(containerPath)
    return run('docker', ['cp', hostPath, `${id}:${target}`])
  },

  async listContainerFiles(id: string, requestedPath: string): Promise<ContainerDirectoryListing> {
    const target = safeContainerPath(requestedPath || '/')
    const inspect = await this.diagnostics(id)
    const mount = [...inspect.mounts]
      .filter(item => target === item.destination || target.startsWith(`${item.destination.replace(/\/+$/, '')}/`))
      .sort((left, right) => right.destination.length - left.destination.length)[0]

    const staged = await stageContainerPath(id, target)
    let entries: ContainerFileEntry[]
    try {
      const rootStat = await fs.lstat(staged.payloadPath)
      if (!rootStat.isDirectory()) throw new Error('The selected container path is not a directory.')

      const names = await fs.readdir(staged.payloadPath)
      entries = await Promise.all(names.map(async name => {
        const localPath = path.join(staged.payloadPath, name)
        const stat = await fs.lstat(localPath)
        const type = fileEntryType(stat)
        return {
          name,
          path: target === '/' ? `/${name}` : `${target}/${name}`,
          type,
          sizeBytes: stat.isFile() ? stat.size : 0,
          permissions: formatFilePermissions(stat.mode, type),
          owner: '',
          group: '',
          modifiedAt: stat.mtime.toISOString(),
          symlinkTarget: type === 'symlink' ? await fs.readlink(localPath).catch(() => '') : ''
        }
      }))
    } finally {
      await fs.rm(staged.temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
    }

    entries.sort((left, right) => {
      if (left.type === 'directory' && right.type !== 'directory') return -1
      if (left.type !== 'directory' && right.type === 'directory') return 1
      return left.name.localeCompare(right.name)
    })

    return {
      path: target,
      parentPath: parentContainerPath(target),
      entries,
      writableMount: Boolean(mount?.rw),
      mountDestination: mount?.destination ?? '',
      warning: mount
        ? mount.rw
          ? 'This path is inside a read/write mount. Upload or text-save changes persistent mounted data.'
          : 'This path is inside a read-only mount.'
        : 'This path is in the container writable layer. Changes may disappear when the container is recreated.'
    }
  },

  async readContainerText(id: string, requestedPath: string): Promise<ContainerTextFile> {
    const target = safeContainerPath(requestedPath)
    const inspect = await this.diagnostics(id)
    const mount = [...inspect.mounts]
      .filter(item => target === item.destination || target.startsWith(`${item.destination.replace(/\/+$/, '')}/`))
      .sort((left, right) => right.destination.length - left.destination.length)[0]

    const MAX_TEXT_BYTES = 1_000_000
    const staged = await stageContainerPath(id, target)
    let stat: Awaited<ReturnType<typeof fs.lstat>>
    let content = ''
    try {
      stat = await fs.lstat(staged.payloadPath)
      if (!stat.isFile()) throw new Error('The selected container path is not a regular file.')
      const handle = await fs.open(staged.payloadPath, 'r')
      try {
        const buffer = Buffer.alloc(Math.min(stat.size, MAX_TEXT_BYTES + 1))
        const result = await handle.read(buffer, 0, buffer.length, 0)
        content = buffer.subarray(0, result.bytesRead).toString('utf8')
      } finally {
        await handle.close()
      }
    } finally {
      await fs.rm(staged.temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
    }

    const sizeBytes = stat!.size
    const truncated = sizeBytes > MAX_TEXT_BYTES

    return {
      path: target,
      content: truncated ? Buffer.from(content, 'utf8').subarray(0, MAX_TEXT_BYTES).toString('utf8') : content,
      sizeBytes,
      truncated,
      encoding: 'utf-8',
      writableMount: Boolean(mount?.rw),
      mountDestination: mount?.destination ?? ''
    }
  },


  async diagnostics(id: string) {
    const result = await run('docker', ['container', 'inspect', id])
    if (!result.ok) throw new Error(result.stderr || 'Unable to inspect container')
    const raw = JSON.parse(result.stdout)?.[0]
    if (!raw) throw new Error('Container inspect returned no data.')

    const health = raw.State?.Health
    const portRows: any[] = []
    for (const [privateSpec, bindings] of Object.entries<any>(raw.NetworkSettings?.Ports ?? {})) {
      const [privatePort, protocol = 'tcp'] = privateSpec.split('/')
      if (!bindings?.length) {
        portRows.push({ privatePort, publicHost: '', publicPort: '', protocol })
      } else {
        for (const binding of bindings) {
          portRows.push({
            privatePort,
            publicHost: binding.HostIp ?? '',
            publicPort: binding.HostPort ?? '',
            protocol
          })
        }
      }
    }

    const networks = Object.entries<any>(raw.NetworkSettings?.Networks ?? {}).map(([name, n]) => ({
      name,
      ipAddress: n.IPAddress ?? '',
      gateway: n.Gateway ?? '',
      macAddress: n.MacAddress ?? '',
      aliases: Array.isArray(n.Aliases) ? n.Aliases.filter(Boolean) : []
    }))

    return {
      id: raw.Id ?? id,
      name: String(raw.Name ?? '').replace(/^\//, ''),
      image: raw.Config?.Image ?? '',
      platform: raw.Platform ?? '',
      created: raw.Created ?? '',
      startedAt: raw.State?.StartedAt ?? '',
      finishedAt: raw.State?.FinishedAt ?? '',
      state: raw.State?.Status ?? '',
      status: raw.State?.Running ? 'Running' : raw.State?.Status ?? '',
      exitCode: Number(raw.State?.ExitCode ?? 0),
      oomKilled: Boolean(raw.State?.OOMKilled),
      restartCount: Number(raw.RestartCount ?? 0),
      stateError: String(raw.State?.Error ?? ''),
      restartPolicy: raw.HostConfig?.RestartPolicy?.Name ?? 'no',
      command: Array.isArray(raw.Config?.Cmd) ? raw.Config.Cmd : [],
      entrypoint: Array.isArray(raw.Config?.Entrypoint) ? raw.Config.Entrypoint : raw.Config?.Entrypoint ? [String(raw.Config.Entrypoint)] : [],
      workingDir: raw.Config?.WorkingDir ?? '',
      health: {
        configured: Boolean(raw.Config?.Healthcheck),
        status: health?.Status ?? (raw.Config?.Healthcheck ? 'unknown' : 'not-configured'),
        failingStreak: Number(health?.FailingStreak ?? 0),
        test: Array.isArray(raw.Config?.Healthcheck?.Test) ? raw.Config.Healthcheck.Test : [],
        interval: raw.Config?.Healthcheck?.Interval,
        timeout: raw.Config?.Healthcheck?.Timeout,
        retries: raw.Config?.Healthcheck?.Retries,
        startPeriod: raw.Config?.Healthcheck?.StartPeriod,
        logs: Array.isArray(health?.Log) ? health.Log.slice(-10).map((x: any) => ({
          start: x.Start ?? '', end: x.End ?? '', exitCode: Number(x.ExitCode ?? 0), output: x.Output ?? ''
        })) : []
      },
      ports: portRows,
      mounts: Array.isArray(raw.Mounts) ? raw.Mounts.map((m: any) => ({
        type: m.Type ?? '', name: m.Name ?? '', source: m.Source ?? '', destination: m.Destination ?? '', mode: m.Mode ?? '', rw: Boolean(m.RW)
      })) : [],
      networks,
      environment: Array.isArray(raw.Config?.Env) ? raw.Config.Env : [],
      labels: raw.Config?.Labels ?? {}
    }
  },

  async containerAdvisor(id: string): Promise<ContainerAdvisorResult> {
    const diagnostics = await this.diagnostics(id)
    const [logsResult, statsResult] = await Promise.all([
      run('docker', ['container', 'logs', '--timestamps', '--tail', '400', id]),
      diagnostics.state === 'running'
        ? run('docker', ['stats', '--no-stream', '--format', 'json', id])
        : Promise.resolve({ ok: false, stdout: '', stderr: '', exitCode: 0, durationMs: 0 })
    ])

    const logText = [logsResult.stdout, logsResult.stderr].filter(Boolean).join('\n')
    const logLines = logText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    const stats = statsResult.ok ? parseContainerStatsSnapshot(statsResult.stdout) : null
    const findings: ContainerDiagnosticFinding[] = []

    const add = (finding: ContainerDiagnosticFinding) => findings.push(finding)
    const evidenceLines = (pattern: RegExp, limit = 3) => logLines.filter(line => pattern.test(line)).slice(-limit).map(redactDiagnosticEvidence)

    if (diagnostics.oomKilled) {
      add({
        id: 'oom-killed', severity: 'critical', category: 'memory',
        symptom: 'Container was killed by the OOM killer.',
        likelyCause: 'The container exceeded its memory limit or the Docker/WSL host experienced severe memory pressure.',
        evidence: [`OOMKilled=true`, `Exit code ${diagnostics.exitCode}`],
        actions: ['Review the container memory limit and peak workload.', 'Inspect the Stats tab and application memory usage.', 'Increase the memory limit only after confirming the workload genuinely needs it.']
      })
    } else if (diagnostics.exitCode === 137) {
      add({
        id: 'exit-137', severity: 'warning', category: 'exit',
        symptom: 'Container exited with code 137.',
        likelyCause: 'The main process received SIGKILL. Memory pressure is one possibility, but Docker does not report OOMKilled for this record.',
        evidence: ['ExitCode=137', 'OOMKilled=false'],
        actions: ['Check host and container memory pressure around the exit time.', 'Check whether the container was force-stopped or killed externally.', 'Review application logs immediately before termination.']
      })
    } else if (diagnostics.state !== 'running' && diagnostics.exitCode !== 0) {
      add({
        id: 'nonzero-exit', severity: 'warning', category: 'exit',
        symptom: `Container stopped with exit code ${diagnostics.exitCode}.`,
        likelyCause: 'The container main process terminated unsuccessfully.',
        evidence: [`State=${diagnostics.state}`, `ExitCode=${diagnostics.exitCode}`, ...(diagnostics.stateError ? [`State.Error=${diagnostics.stateError}`] : [])],
        actions: ['Review the Logs tab around the final timestamp.', 'Verify the configured entrypoint/command and required runtime configuration.', 'Reproduce the command interactively only if it is safe to do so.']
      })
    }

    if (diagnostics.restartCount >= 3) {
      add({
        id: 'restart-loop', severity: diagnostics.restartCount >= 10 ? 'critical' : 'warning', category: 'restart',
        symptom: `Container has restarted ${diagnostics.restartCount} times.`,
        likelyCause: 'The main process may be repeatedly failing while the configured restart policy brings it back up.',
        evidence: [`RestartCount=${diagnostics.restartCount}`, `RestartPolicy=${diagnostics.restartPolicy}`],
        actions: ['Inspect recent logs for the first failure in each restart cycle.', 'Check health checks and runtime dependencies.', 'Temporarily stop automatic restarts during diagnosis if doing so is safe for this workload.']
      })
    }

    if (diagnostics.health.status === 'unhealthy') {
      const healthEvidence = diagnostics.health.logs.slice(-3).map((item: HealthLogEntry) => `Health exit ${item.exitCode}: ${item.output.trim() || 'no output'}`)
      add({
        id: 'unhealthy', severity: 'critical', category: 'health',
        symptom: 'Docker reports the container as unhealthy.',
        likelyCause: 'The configured health-check command is failing or timing out.',
        evidence: [`FailingStreak=${diagnostics.health.failingStreak}`, `Healthcheck=${diagnostics.health.test.join(' ') || 'configured'}`, ...healthEvidence],
        actions: ['Run or reproduce the health-check command inside the container.', 'Verify health-check dependencies such as ports, URLs, DNS, and credentials.', 'Review timeout, retries, interval, and start-period settings.']
      })
    }

    if (diagnostics.health.configured && diagnostics.health.status === 'unknown') {
      const healthEvidence = diagnostics.health.logs.slice(-3).map((item: HealthLogEntry) => `Health exit ${item.exitCode}: ${redactDiagnosticEvidence(item.output.trim() || 'no output')}`)
      add({
        id: 'health-unavailable', severity: 'warning', category: 'health',
        symptom: 'The configured container health check cannot currently be evaluated.',
        likelyCause: 'Docker has a health check definition but no assessable health status. The check may not have executed yet, its state may be unavailable, or runtime/inspection evidence may be incomplete.',
        evidence: [`HealthStatus=unknown`, `Healthcheck=${diagnostics.health.test.join(' ') || 'configured'}`, `FailingStreak=${diagnostics.health.failingStreak}`, ...healthEvidence],
        actions: ['Inspect the Health tab and recent health-check output.', 'Verify that the container is running long enough for start-period/interval semantics to produce a result.', 'Reproduce the health-check command only if it is safe and does not mutate application state.']
      })
    }

    const patterns: Array<{ id:string; severity:'critical'|'warning'; category:ContainerDiagnosticFinding['category']; regex:RegExp; symptom:string; cause:string; actions:string[] }> = [
      { id:'port-conflict', severity:'warning', category:'port', regex:/(address already in use|bind:.*already in use|port is already allocated)/i, symptom:'A port binding or listener conflict appears in the logs.', cause:'Another process/container may already own the required host or container port.', actions:['Review the Ports tab and published host ports.', 'Identify the process or container already listening on the conflicting port.', 'Change the published port or stop the conflicting owner.'] },
      { id:'permission-denied', severity:'warning', category:'permission', regex:/(permission denied|EACCES|operation not permitted)/i, symptom:'Permission errors appear in the logs.', cause:'The container process may not have access to a file, bind mount, socket, device, or privileged operation.', actions:['Review the user running inside the container.', 'Check bind-mount ownership/permissions and read-only flags.', 'Avoid broad privilege escalation until the required permission is understood.'] },
      { id:'no-space', severity:'critical', category:'storage', regex:/(no space left on device|ENOSPC)/i, symptom:'The application reports no space left on device.', cause:'Docker storage, a mounted filesystem, inode capacity, or the host VHDX may be exhausted.', actions:['Open Dashboard and Cleanup Advisor to review reclaimable Docker storage.', 'Check mounted volume/filesystem capacity.', 'After Docker cleanup, use VHDX Manager only if Windows host space remains occupied.'] },
      { id:'dns-network', severity:'warning', category:'network', regex:/(temporary failure in name resolution|no such host|ENOTFOUND|getaddrinfo.*failed|name or service not known)/i, symptom:'DNS/name-resolution failures appear in the logs.', cause:'The container may not be resolving a dependency hostname through its attached Docker network/DNS configuration.', actions:['Review the Networks tab and Compose service names/aliases.', 'Verify the dependency hostname exists on a shared Docker network.', 'Check whether the upstream DNS/network dependency is reachable.'] },
      { id:'connection-refused', severity:'warning', category:'network', regex:/(connection refused|ECONNREFUSED)/i, symptom:'A dependency connection is being refused.', cause:'The target service may be stopped, listening on a different interface/port, or not yet ready.', actions:['Verify the target container/service is running and healthy.', 'Check the destination port and Docker network attachment.', 'For startup races, prefer readiness/health semantics over arbitrary sleep delays.'] },
      { id:'missing-config', severity:'warning', category:'configuration', regex:/(environment variable .* (is )?(not set|required|missing)|missing required .*environment|undefined environment variable|configuration .* missing)/i, symptom:'The logs indicate missing runtime configuration.', cause:'A required environment variable or application configuration value may not have been provided.', actions:['Review the Environment tab for the expected variable name.', 'Compare Compose/environment configuration with application requirements.', 'Keep secret values masked while verifying presence and source.'] }
    ]

    for (const pattern of patterns) {
      const evidence = evidenceLines(pattern.regex)
      if (evidence.length) add({ id: pattern.id, severity: pattern.severity, category: pattern.category, symptom: pattern.symptom, likelyCause: pattern.cause, evidence, actions: pattern.actions })
    }

    if (stats && stats.memoryPercent >= 90) {
      add({
        id:'memory-pressure', severity: stats.memoryPercent >= 97 ? 'critical' : 'warning', category:'memory',
        symptom:`Memory usage is ${stats.memoryPercent.toFixed(1)}% of the configured limit.`,
        likelyCause:'The workload is close to its Docker memory limit and may become unstable under additional load.',
        evidence:[`Memory=${stats.memoryUsage}`, `MemoryPercent=${stats.memoryPercent.toFixed(1)}%`],
        actions:['Inspect application heap/cache growth.', 'Confirm the configured memory limit matches expected peak usage.', 'Correlate with logs before increasing limits.']
      })
    }

    if (stats && stats.cpuPercent >= 95) {
      add({
        id:'cpu-saturation', severity:'warning', category:'runtime',
        symptom:`CPU usage snapshot is ${stats.cpuPercent.toFixed(1)}%.`,
        likelyCause:'The container was CPU-saturated at the sampled moment.',
        evidence:[`CPU=${stats.cpuPercent.toFixed(1)}%`, `PIDs=${stats.pids}`],
        actions:['Use Live Stats to determine whether high CPU is sustained.', 'Inspect Processes to identify the expensive process/thread pattern.', 'Correlate CPU saturation with request/build/job load before changing resource limits.']
      })
    }

    const critical = findings.filter(item => item.severity === 'critical').length
    const warnings = findings.filter(item => item.severity === 'warning').length
    const status: ContainerAdvisorResult['status'] = critical ? 'critical' : warnings ? 'warning' : 'healthy'
    const summary = critical
      ? `${critical} critical and ${warnings} warning diagnostic finding${critical + warnings === 1 ? '' : 's'} detected.`
      : warnings
        ? `${warnings} warning diagnostic finding${warnings === 1 ? '' : 's'} detected.`
        : 'No known failure patterns were detected in the sampled Docker evidence.'

    return { containerId:id, generatedAt:new Date().toISOString(), status, summary, diagnostics, stats, findings, logsSampled:logLines.length }
  },

  async processes(id: string) {
    let result = await run('docker', ['top', id, '-eo', 'pid,user,pcpu,pmem,args'])
    if (!result.ok) result = await run('docker', ['top', id])
    if (!result.ok) throw new Error(result.stderr || 'Unable to read container processes')

    const lines = result.stdout.split(/\r?\n/).filter(Boolean)
    if (lines.length <= 1) return []
    return lines.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/)
      return {
        pid: parts[0] ?? '',
        user: parts[1] ?? '',
        cpu: parts[2] ?? '—',
        memory: parts[3] ?? '—',
        command: parts.slice(4).join(' ') || parts.slice(2).join(' ')
      }
    })
  },

  async composeProjects(): Promise<ComposeProject[]> {
    const result = await run('docker', ['compose', 'ls', '--all', '--format', 'json'])
    if (!result.ok) return []
    const raw = result.stdout.trim()
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const rows = Array.isArray(parsed) ? parsed : [parsed]

    return rows.map((x: any) => ({
      name: x.Name ?? '',
      status: x.Status ?? '',
      configFiles: Array.isArray(x.ConfigFiles)
        ? x.ConfigFiles.map(String).join(',')
        : String(x.ConfigFiles ?? '')
    }))
  },

  composeAction(project: ComposeProject, action: 'start' | 'stop' | 'restart') {
    return run('docker', [...projectArgs(project), action])
  },

  composeDown(project: ComposeProject, removeVolumes = false) {
    return run('docker', [
      ...projectArgs(project), 'down', '--remove-orphans',
      ...(removeVolumes ? ['--volumes'] : [])
    ])
  },

  composeLogs(project: ComposeProject, tail = 500) {
    return run('docker', [
      ...projectArgs(project), 'logs', '--timestamps', '--tail', String(tail)
    ])
  },

  async composeServices(project: ComposeProject): Promise<ComposeServiceInfo[]> {
    const result = await run('docker', [...projectArgs(project), 'ps', '--all', '--no-trunc', '--format', 'json'])
    if (!result.ok) throw new Error(result.stderr || 'Unable to list Compose services')
    const inventory = parseJsonLines<any>(result.stdout)
    const metadata = await inspectContainerRuntime(inventory.map((x) => String(x.ID ?? '')).filter(Boolean))

    return inventory.map((x) => ({
      id: x.ID ?? '',
      name: x.Name ?? '',
      service: x.Service ?? '',
      image: x.Image ?? '',
      state: x.State ?? '',
      startedAt: metadata.get(String(x.ID ?? ''))?.startedAt ?? '',
      health: x.Health ?? '',
      exitCode: Number(x.ExitCode ?? 0),
      publishers: Array.isArray(x.Publishers) ? x.Publishers.map((p: any) => ({
        url: p.URL ?? '', targetPort: Number(p.TargetPort ?? 0), publishedPort: Number(p.PublishedPort ?? 0), protocol: p.Protocol ?? 'tcp'
      })) : []
    }))
  },

  async composeWorkspace(project: ComposeProject): Promise<ComposeWorkspaceModel> {
    const result = await run('docker', [...projectArgs(project), 'config', '--format', 'json'])
    if (!result.ok) throw new Error(result.stderr || 'Unable to resolve Compose configuration')
    const model = JSON.parse(result.stdout || '{}')
    const services = Object.entries<any>(model.services ?? {}).map(([name, svc]) => ({
      name,
      image: svc.image ?? '',
      command: Array.isArray(svc.command) ? svc.command.map(String) : svc.command ? [String(svc.command)] : [],
      dependsOn: normalizeDependsOn(svc.depends_on),
      profiles: Array.isArray(svc.profiles) ? svc.profiles.map(String) : [],
      ports: Array.isArray(svc.ports) ? svc.ports.map((p: any) => typeof p === 'string' ? p : `${p.published ?? ''}:${p.target ?? ''}/${p.protocol ?? 'tcp'}`) : [],
      networks: Array.isArray(svc.networks) ? svc.networks.map(String) : svc.networks && typeof svc.networks === 'object' ? Object.keys(svc.networks) : [],
      volumes: Array.isArray(svc.volumes) ? svc.volumes.map((v: any) => typeof v === 'string' ? v : `${v.source ?? ''}:${v.target ?? ''}`) : [],
      environment: normalizeEnvironment(svc.environment)
    }))
    return {
      project: project.name,
      services,
      networks: Object.keys(model.networks ?? {}),
      volumes: Object.keys(model.volumes ?? {}),
      configs: Object.keys(model.configs ?? {}),
      secrets: Object.keys(model.secrets ?? {}),
      rawJson: JSON.stringify(model, null, 2)
    }
  },

  composeServiceAction(project: ComposeProject, service: string, action: 'start' | 'stop' | 'restart') {
    return run('docker', [...projectArgs(project), action, serviceName(service)])
  },

  composePull(project: ComposeProject) {
    return run('docker', [...projectArgs(project), 'pull'], 30 * 60_000)
  },

  composeBuild(project: ComposeProject, noCache = false) {
    return run('docker', [...projectArgs(project), 'build', ...(noCache ? ['--no-cache'] : [])], 60 * 60_000)
  },

  composeUp(project: ComposeProject, build = false) {
    return run('docker', [...projectArgs(project), 'up', '-d', ...(build ? ['--build'] : [])], 60 * 60_000)
  },

  async composeReadFile(project: ComposeProject, requested?: string) {
    const target = ensureProjectFile(project, requested)
    const timeoutMs = 10_000

    const bounded = async <T>(operation: Promise<T>, label: string): Promise<T> => {
      let timer: NodeJS.Timeout | undefined
      try {
        return await Promise.race([
          operation,
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs / 1000} seconds.`)), timeoutMs)
          })
        ])
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    try {
      const stat = await bounded(fs.stat(target), 'Compose file stat')
      if (!stat.isFile()) throw new Error('Docker-reported Compose source is not a regular file.')
      const content = await bounded(fs.readFile(target, 'utf8'), 'Compose file read')
      return { path: target, content, modifiedMs: stat.mtimeMs }
    } catch (error: any) {
      const code = String(error?.code ?? '')
      if (code === 'ENOENT') {
        throw new Error(`Compose source file no longer exists: ${target}`)
      }
      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(`Compose source file is not readable by DockScope: ${target}`)
      }
      throw error
    }
  },

  async composeValidate(project: ComposeProject, content?: string, requested?: string): Promise<ComposeValidation> {
    if (content == null) {
      const result = await run('docker', [...projectArgs(project), 'config', '--quiet'])
      return { valid: result.ok, stdout: result.stdout, stderr: result.stderr }
    }
    const target = ensureProjectFile(project, requested)
    const files = projectFiles(project)
    const temp = path.join(path.dirname(target), `.dsm-validate-${randomUUID()}.yaml`)
    await fs.writeFile(temp, content, 'utf8')
    try {
      const args = ['compose', '-p', project.name]
      for (const file of files) args.push('-f', file.toLowerCase() === target.toLowerCase() ? temp : file)
      args.push('config', '--quiet')
      const result = await run('docker', args)
      return { valid: result.ok, stdout: result.stdout, stderr: result.stderr }
    } finally {
      await fs.unlink(temp).catch(() => undefined)
    }
  },

  async composeSaveFile(project: ComposeProject, requested: string, content: string, expectedOriginal: string) {
    const target = ensureProjectFile(project, requested)
    const current = await fs.readFile(target, 'utf8')
    if (current !== expectedOriginal) {
      return { exitCode: 9, stdout: '', stderr: 'Compose file changed on disk after it was opened. Reload before saving to avoid overwriting external changes.', ok: false }
    }
    const validation = await this.composeValidate(project, content, target)
    if (!validation.valid) return { exitCode: 8, stdout: validation.stdout, stderr: validation.stderr || 'Compose validation failed.', ok: false }
    const backup = `${target}.dsm.bak`
    const temp = `${target}.dsm.${randomUUID()}.tmp`
    await fs.copyFile(target, backup)
    await fs.writeFile(temp, content, 'utf8')
    await fs.rename(temp, target)
    return { exitCode: 0, stdout: `Saved ${target}\nBackup: ${backup}`, stderr: '', ok: true }
  },


  async builders(): Promise<BuilderInfo[]> {
    const result = await run('docker', ['buildx', 'ls', '--format', 'json'])
    if (!result.ok) return []
    return parseJsonLines<any>(result.stdout).map((x) => ({
      name: x.Name ?? x.Builder ?? '', driver: x.Driver ?? '', status: x.Status ?? '',
      platforms: x.Platforms ?? '', endpoint: x.Endpoint ?? ''
    }))
  },

  async buildHistory(): Promise<BuildHistoryRecord[]> {
    const result = await run('docker', ['buildx', 'history', 'ls', '--format', 'json'])
    if (!result.ok) {
      // Older Buildx versions may not support history. BuildKit remains usable without this optional view.
      return []
    }

    const raw = result.stdout.trim()
    if (!raw) return []

    let rows: any[] = []
    try {
      const parsed = JSON.parse(raw)
      rows = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      // Docker Desktop / Buildx versions may emit NDJSON: one JSON object per line.
      rows = parseJsonLines<any>(raw)
    }

    return rows.map((row: any) => {
      const ref = String(firstValue(row, 'ref', 'Ref') ?? '')
      const explicitId = String(firstValue(row, 'ID', 'Id', 'id') ?? '')
      const createdAt = String(firstValue(
        row,
        'created_at', 'CreatedAt',
        'started_at', 'StartedAt',
        'Created'
      ) ?? '')
      const completedAt = String(firstValue(row, 'completed_at', 'CompletedAt') ?? '')
      const durationValue = firstValue(row, 'duration', 'Duration')
      const duration = typeof durationValue === 'string' && durationValue.trim()
        ? durationValue
        : humanDurationBetween(createdAt, completedAt)

      const cachedSteps = Number(firstValue(row, 'cached_steps', 'CachedSteps', 'NumCachedSteps') ?? 0)
      const completedSteps = Number(firstValue(row, 'completed_steps', 'CompletedSteps', 'NumCompletedSteps') ?? 0)
      const totalSteps = Number(firstValue(row, 'total_steps', 'TotalSteps', 'NumTotalSteps') ?? 0)

      return {
        id: explicitId || buildIdFromRef(ref),
        ref,
        name: String(firstValue(row, 'name', 'Name') ?? ''),
        status: String(firstValue(row, 'status', 'Status') ?? ''),
        createdAt,
        completedAt,
        duration,
        cachedSteps: Number.isFinite(cachedSteps) ? cachedSteps : 0,
        completedSteps: Number.isFinite(completedSteps) ? completedSteps : 0,
        totalSteps: Number.isFinite(totalSteps) ? totalSteps : 0
      }
    })
  },

  async buildDiagnostics(ref: string): Promise<BuildDiagnostics> {
    const [inspectResult, logsResult] = await Promise.all([
      run('docker', ['buildx', 'history', 'inspect', '--format', 'json', ref]),
      run('docker', ['buildx', 'history', 'logs', '--progress', 'plain', ref], 10 * 60_000)
    ])

    if (!inspectResult.ok) {
      throw new Error(inspectResult.stderr || `Unable to inspect Buildx record ${ref}.`)
    }

    let raw: any = {}
    try {
      raw = JSON.parse(inspectResult.stdout.trim() || '{}')
    } catch {
      throw new Error('Buildx returned invalid JSON for build history inspect.')
    }

    const startedAt = String(firstValue(raw, 'StartedAt', 'started_at', 'CreatedAt', 'created_at') ?? '')
    const completedAt = String(firstValue(raw, 'CompletedAt', 'completed_at') ?? '')
    const durationValue = Number(firstValue(raw, 'Duration', 'duration') ?? 0)
    const durationMs = Number.isFinite(durationValue) && durationValue > 0
      ? Math.round(durationValue / 1_000_000)
      : Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)) || 0
    const materialRows = Array.isArray(firstValue(raw, 'Materials', 'materials')) ? firstValue(raw, 'Materials', 'materials') : []
    const attachmentRows = Array.isArray(firstValue(raw, 'Attachments', 'attachments')) ? firstValue(raw, 'Attachments', 'attachments') : []
    const platformsRaw = firstValue(raw, 'Platform', 'Platforms', 'platform', 'platforms')
    const platforms = Array.isArray(platformsRaw) ? platformsRaw.map(String) : platformsRaw ? [String(platformsRaw)] : []
    const details: BuildHistoryDetails = {
      id: String(firstValue(raw, 'ID', 'Id', 'id') ?? buildIdFromRef(String(firstValue(raw, 'Ref', 'ref') ?? ref))),
      ref: String(firstValue(raw, 'Ref', 'ref') ?? ref),
      name: String(firstValue(raw, 'Name', 'name') ?? ''),
      status: String(firstValue(raw, 'Status', 'status') ?? ''),
      context: String(firstValue(raw, 'Context', 'context') ?? ''),
      dockerfile: String(firstValue(raw, 'Dockerfile', 'dockerfile') ?? ''),
      vcsRepository: String(firstValue(raw, 'VCSRepository', 'vcs_repository') ?? ''),
      vcsRevision: String(firstValue(raw, 'VCSRevision', 'vcs_revision') ?? ''),
      target: String(firstValue(raw, 'Target', 'target') ?? ''),
      platforms,
      startedAt,
      completedAt,
      duration: durationMs ? humanDurationMs(durationMs) : humanDurationBetween(startedAt, completedAt),
      durationMs,
      cachedSteps: Number(firstValue(raw, 'NumCachedSteps', 'cached_steps', 'CachedSteps') ?? 0),
      completedSteps: Number(firstValue(raw, 'NumCompletedSteps', 'completed_steps', 'CompletedSteps') ?? 0),
      totalSteps: Number(firstValue(raw, 'NumTotalSteps', 'total_steps', 'TotalSteps') ?? 0),
      imageResolveMode: String(firstValue(raw?.Config ?? {}, 'ImageResolveMode', 'image_resolve_mode') ?? ''),
      materials: materialRows.map((item: any) => ({
        uri: String(firstValue(item, 'URI', 'Uri', 'uri') ?? ''),
        digests: Array.isArray(firstValue(item, 'Digests', 'digests')) ? firstValue(item, 'Digests', 'digests').map(String) : []
      })),
      attachments: attachmentRows.map((item: any) => ({
        digest: String(firstValue(item, 'Digest', 'digest') ?? ''),
        platform: String(firstValue(item, 'Platform', 'platform') ?? ''),
        type: String(firstValue(item, 'Type', 'type') ?? '')
      }))
    }

    const logs = logsResult.stdout || logsResult.stderr || ''
    return { details, logs, findings: analyzeBuildFailure(details, logs) }
  },

  openBuildHistory(ref: string) {
    return run('docker', ['buildx', 'history', 'open', ref], 30_000)
  },

  async buildCacheDiskUsage(): Promise<BuildCacheRecord[]> {
    const result = await run('docker', ['buildx', 'du', '--verbose', '--format', 'json'])
    if (!result.ok) return []
    const raw = result.stdout.trim()
    if (!raw) return []
    let parsed: any
    try { parsed = JSON.parse(raw) } catch { parsed = parseJsonLines<any>(raw) }
    const rows = Array.isArray(parsed) ? parsed : (parsed.Records ?? parsed.records ?? [parsed])
    return rows.map((x: any) => ({
      id: x.ID ?? x.Id ?? '', type: x.Type ?? '', size: x.Size ?? x.SizeHuman ?? '0B',
      createdAt: x.CreatedAt ?? x.Created ?? '', lastUsedAt: x.LastUsedAt ?? x.LastUsed ?? '',
      usageCount: Number(x.UsageCount ?? x.Usage ?? 0), shared: Boolean(x.Shared), mutable: Boolean(x.Mutable),
      reclaimable: Boolean(x.Reclaimable ?? !x.InUse), description: x.Description ?? x.Desc ?? ''
    }))
  },

  pruneBuildCache(all = false, keepStorageGb = 0) {
    const args = ['builder', 'prune', '--force']
    if (all) args.push('--all')
    if (keepStorageGb > 0) args.push('--keep-storage', `${keepStorageGb}GB`)
    return run('docker', args, 20 * 60_000)
  },

  async imageHistory(imageId: string): Promise<ImageHistoryLayer[]> {
    const result = await run('docker', ['image', 'history', '--no-trunc', '--format', 'json', imageId])
    if (!result.ok) throw new Error(result.stderr || 'Unable to read image history.')
    return parseJsonLines<any>(result.stdout).map((x) => ({
      id: x.ID ?? '', createdSince: x.CreatedSince ?? '', createdBy: x.CreatedBy ?? '',
      size: x.Size ?? '0B', comment: x.Comment ?? ''
    }))
  },

  async analyzeImage(imageId: string): Promise<ImageInsight> {
    const history = await this.imageHistory(imageId)
    const images = await this.images()
    const clean = imageId.replace('sha256:', '')
    const image = images.find((x) => x.id === imageId || x.id.replace('sha256:', '') === clean)
    const sorted = [...history].sort((a, b) => parseSizeToBytes(b.size) - parseSizeToBytes(a.size))
    const largest = sorted[0]
    const threshold = 100 * 1024 * 1024
    const large = history.filter((x) => parseSizeToBytes(x.size) >= threshold)
    const notes: string[] = []
    if (large.length >= 3) notes.push(`${large.length} layers are at least 100 MB; review package installs and COPY steps.`)
    if (largest && parseSizeToBytes(largest.size) >= 500 * 1024 * 1024) notes.push('Largest layer exceeds 500 MB; consider multi-stage builds or removing build-time artifacts in the same RUN instruction.')
    if (history.some((x) => /apt-get|apk add|yum install|dnf install/i.test(x.createdBy))) notes.push('Package-manager layers detected; clean package caches in the same layer where packages are installed.')
    if (history.some((x) => /npm (install|ci)|pnpm install|yarn install/i.test(x.createdBy))) notes.push('JavaScript dependency layer detected; COPY lockfiles before source code to improve cache reuse.')
    if (history.some((x) => /dotnet publish/i.test(x.createdBy))) notes.push('.NET publish layer detected; use multi-stage builds and copy only publish output into the runtime image.')
    return {
      imageId, displayName: image ? `${image.repository}:${image.tag}` : imageId, totalSize: image?.size ?? 'Unknown',
      largestLayerSize: largest?.size ?? '0B', largestLayerCommand: largest?.createdBy ?? '',
      largeLayerCount: large.length, notes
    }
  },

  async images(): Promise<ImageInfo[]> {
    const result = await run('docker', ['image', 'ls', '-a', '--no-trunc', '--format', 'json'])
    if (!result.ok) throw new Error(result.stderr)

    return parseJsonLines<any>(result.stdout).map((x) => ({
      id: x.ID ?? '',
      repository: x.Repository ?? '',
      tag: x.Tag ?? '',
      size: x.Size ?? '',
      createdSince: x.CreatedSince ?? ''
    }))
  },

  removeImages(ids: string[], force = false) {
    return run('docker', ['image', 'rm', ...(force ? ['--force'] : []), ...ids])
  },

  pruneImages(all = false) {
    return run('docker', ['image', 'prune', ...(all ? ['--all'] : []), '--force'])
  },

  async volumeIntelligence(): Promise<VolumeIntelligence[]> {
    const volumeResult = await run('docker', ['volume', 'ls', '--format', '{{json .}}'])
    if (!volumeResult.ok) throw new Error(volumeResult.stderr || 'Unable to list Docker volumes.')

    const base = parseJsonLines<any>(volumeResult.stdout)
    const names = base.map((row: any) => String(row.Name ?? '')).filter(Boolean)
    if (!names.length) return []

    const [volumeInspectResult, diskResult, containerListResult] = await Promise.all([
      run('docker', ['volume', 'inspect', ...names]),
      run('docker', ['system', 'df', '-v']),
      run('docker', ['container', 'ls', '-a', '--no-trunc', '--format', 'json'])
    ])

    let inspectedVolumes: any[] = []
    if (volumeInspectResult.ok && volumeInspectResult.stdout.trim()) {
      try {
        const parsed = JSON.parse(volumeInspectResult.stdout)
        inspectedVolumes = Array.isArray(parsed) ? parsed : [parsed]
      } catch { inspectedVolumes = [] }
    }

    const containerInventory = containerListResult.ok ? parseJsonLines<any>(containerListResult.stdout) : []
    const containerIds = containerInventory.map((row: any) => String(row.ID ?? '')).filter(Boolean)
    let inspectedContainers: any[] = []
    if (containerIds.length) {
      const inspectContainers = await run('docker', ['container', 'inspect', ...containerIds])
      if (inspectContainers.ok && inspectContainers.stdout.trim()) {
        try {
          const parsed = JSON.parse(inspectContainers.stdout)
          inspectedContainers = Array.isArray(parsed) ? parsed : [parsed]
        } catch { inspectedContainers = [] }
      }
    }

    const volumeByName = new Map(inspectedVolumes.map(item => [String(item.Name ?? ''), item]))
    const sizes = diskResult.ok ? parseVolumeSizesFromSystemDf(diskResult.stdout) : new Map<string, string>()
    const referencesByVolume = new Map<string, VolumeReference[]>()

    for (const container of inspectedContainers) {
      const labels = stringRecord(container.Config?.Labels)
      const containerName = String(container.Name ?? '').replace(/^\//, '')
      const containerId = String(container.Id ?? container.ID ?? '')
      const state = String(container.State?.Status ?? '')
      const image = String(container.Config?.Image ?? '')
      const createdAt = String(container.Created ?? '')
      for (const mount of Array.isArray(container.Mounts) ? container.Mounts : []) {
        if (String(mount.Type ?? '').toLowerCase() !== 'volume') continue
        const name = String(mount.Name ?? '')
        if (!name) continue
        const reference: VolumeReference = {
          containerId,
          containerName,
          containerState: state,
          image,
          composeProject: labels['com.docker.compose.project'] ?? '',
          composeService: labels['com.docker.compose.service'] ?? '',
          destination: String(mount.Destination ?? ''),
          readWrite: Boolean(mount.RW),
          containerCreatedAt: createdAt
        }
        referencesByVolume.set(name, [...(referencesByVolume.get(name) ?? []), reference])
      }
    }

    return names.map(name => {
      const inspect = volumeByName.get(name) ?? {}
      const references = referencesByVolume.get(name) ?? []
      const labels = stringRecord(inspect.Labels)
      const options = stringRecord(inspect.Options)
      const composeProjects = Array.from(new Set(references.map(item => item.composeProject).filter(Boolean))).sort()
      const workloads = detectVolumeWorkloads(name, references, labels)
      const size = sizes.get(name) ?? 'Unknown'
      const latestRelatedContainerAt = references
        .map(item => item.containerCreatedAt)
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? ''

      return {
        name,
        driver: String(inspect.Driver ?? ''),
        scope: String(inspect.Scope ?? ''),
        createdAt: String(inspect.CreatedAt ?? ''),
        size,
        mountpoint: String(inspect.Mountpoint ?? ''),
        labels,
        options,
        references,
        composeProjects,
        workloads,
        latestRelatedContainerAt,
        risk: volumeRisk(size, references, workloads, labels, composeProjects)
      }
    }).sort((left, right) =>
      right.risk.score - left.risk.score ||
      parseSizeToBytes(right.size) - parseSizeToBytes(left.size) ||
      left.name.localeCompare(right.name)
    )
  },

  async volumes(): Promise<VolumeInfo[]> {
    const result = await run('docker', ['volume', 'ls', '--format', '{{json .}}'])
    if (!result.ok) throw new Error(result.stderr)

    const base = parseJsonLines<any>(result.stdout)
    const names = base.map((x: any) => String(x.Name ?? '')).filter(Boolean)
    if (!names.length) return []

    const [inspectResult, diskResult, ...referenceResults] = await Promise.all([
      run('docker', ['volume', 'inspect', ...names]),
      run('docker', ['system', 'df', '-v']),
      ...names.map(name => run('docker', ['container', 'ls', '-a', '--filter', `volume=${name}`, '-q']))
    ])

    let inspected: any[] = []
    if (inspectResult.ok && inspectResult.stdout.trim()) {
      try {
        const parsed = JSON.parse(inspectResult.stdout)
        inspected = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        inspected = []
      }
    }
    const inspectByName = new Map(inspected.map(item => [String(item.Name ?? ''), item]))
    const sizes = diskResult.ok ? parseVolumeSizesFromSystemDf(diskResult.stdout) : new Map<string, string>()

    return base.map((x: any, index: number) => {
      const name = String(x.Name ?? '')
      const inspect = inspectByName.get(name)
      return {
        name,
        driver: String(inspect?.Driver ?? x.Driver ?? ''),
        scope: String(inspect?.Scope ?? x.Scope ?? ''),
        inUse: Boolean(referenceResults[index]?.stdout.trim()),
        createdAt: String(inspect?.CreatedAt ?? ''),
        size: sizes.get(name) ?? 'Unknown'
      }
    })
  },

  removeVolumes(names: string[], force = false) {
    return run('docker', ['volume', 'rm', ...(force ? ['--force'] : []), ...names])
  },

  pruneVolumes(all = false) {
    return run('docker', ['volume', 'prune', ...(all ? ['--all'] : []), '--force'])
  },

  async networks(): Promise<NetworkInfo[]> {
    const result = await run('docker', ['network', 'ls', '--no-trunc', '--format', 'json'])
    if (!result.ok) throw new Error(result.stderr)

    return parseJsonLines<any>(result.stdout).map((x) => ({
      id: x.ID ?? '',
      name: x.Name ?? '',
      driver: x.Driver ?? '',
      scope: x.Scope ?? ''
    }))
  },

  pruneNetworks() {
    return run('docker', ['network', 'prune', '--force'])
  },

  async smartCleanupPlan(targetBytes: number): Promise<SmartCleanupPlan> {
    const safeTarget = Math.max(0, Math.min(Number(targetBytes) || 0, 100 * 1000 ** 4))
    const usage = await this.diskUsage()
    const reclaimable = (label: string) =>
      parseCleanupEstimate(usage.find(item => item.type.toLowerCase().includes(label.toLowerCase()))?.reclaimable ?? '0B')

    const danglingResult = await run('docker', [
      'image', 'ls', '--filter', 'dangling=true', '--format', 'json'
    ])
    let danglingBytes = 0
    if (danglingResult.ok) {
      try {
        const unique = new Map<string, number>()
        for (const row of parseJsonLines<any>(danglingResult.stdout)) {
          const id = String(row.ID ?? row.Id ?? '')
          const size = parseSizeToBytes(String(row.Size ?? '0B'))
          if (id && size > 0) unique.set(id, size)
        }
        danglingBytes = Array.from(unique.values()).reduce((sum, value) => sum + value, 0)
      } catch {
        danglingBytes = 0
      }
    }

    const imageReclaimable = reclaimable('Images')
    danglingBytes = Math.min(danglingBytes, imageReclaimable)
    const unusedImagesAdditional = Math.max(0, imageReclaimable - danglingBytes)

    const candidates: SmartCleanupPlanStep[] = [
      {
        key: 'build-cache',
        title: 'Build Cache',
        risk: 'low',
        estimatedBytes: reclaimable('Build Cache'),
        estimated: formatCleanupBytes(reclaimable('Build Cache')),
        selected: false,
        priority: 10,
        reason: 'Removes unused build cache. Future builds may need to rebuild or download layers.',
        commandSummary: 'docker builder prune --force'
      },
      {
        key: 'dangling-images',
        title: 'Dangling Images',
        risk: 'low',
        estimatedBytes: danglingBytes,
        estimated: formatCleanupBytes(danglingBytes),
        selected: false,
        priority: 20,
        reason: 'Removes untagged images. Estimate is derived from dangling image records and may include shared-layer approximation.',
        commandSummary: 'docker image prune --force'
      },
      {
        key: 'stopped-containers',
        title: 'Stopped Containers',
        risk: 'low',
        estimatedBytes: reclaimable('Containers'),
        estimated: formatCleanupBytes(reclaimable('Containers')),
        selected: false,
        priority: 30,
        reason: 'Removes stopped containers and their writable layers.',
        commandSummary: 'docker container prune --force'
      },
      {
        key: 'unused-networks',
        title: 'Unused Networks',
        risk: 'low',
        estimatedBytes: 0,
        estimated: 'Small / not reported',
        selected: false,
        priority: 40,
        reason: 'Removes networks not referenced by containers. Docker does not report meaningful reclaimable bytes for this category.',
        commandSummary: 'docker network prune --force'
      },
      {
        key: 'unused-images',
        title: 'Unused Images',
        risk: 'medium',
        estimatedBytes: unusedImagesAdditional,
        estimated: formatCleanupBytes(unusedImagesAdditional),
        selected: false,
        priority: 50,
        reason: 'Removes additional images not referenced by containers after dangling images. They may need to be pulled or rebuilt later.',
        commandSummary: 'docker image prune --all --force'
      }
    ]

    let selectedBytes = 0
    for (const step of candidates.sort((left, right) => left.priority - right.priority)) {
      if (safeTarget > 0 && selectedBytes >= safeTarget) break
      if (step.estimatedBytes <= 0 && step.key !== 'unused-networks') continue
      step.selected = true
      selectedBytes += step.estimatedBytes
    }

    // Networks reclaim almost no disk but are useful only when another low-risk cleanup step is selected.
    const network = candidates.find(step => step.key === 'unused-networks')
    if (network) network.selected = false

    const potentialBytes = candidates.reduce((sum, step) => sum + step.estimatedBytes, 0)
    const achievable = selectedBytes >= safeTarget
    const shortfallBytes = Math.max(0, safeTarget - potentialBytes)

    return {
      targetBytes: safeTarget,
      target: formatCleanupBytes(safeTarget),
      potentialBytes,
      potential: formatCleanupBytes(potentialBytes),
      selectedBytes,
      selected: formatCleanupBytes(selectedBytes),
      achievable,
      shortfallBytes,
      shortfall: formatCleanupBytes(shortfallBytes),
      steps: candidates,
      excluded: [
        {
          key: 'volumes',
          title: 'Volumes',
          reason: 'Persistent volumes are never included in Smart Cleanup plans. Review them separately in Volume Intelligence.'
        }
      ],
      generatedAt: new Date().toISOString()
    }
  },

  async cleanupAdvisor(): Promise<CleanupAdvisorItem[]> {
    const usage = await this.diskUsage()
    const find = (label: string) =>
      usage.find((x) => x.type.toLowerCase().includes(label.toLowerCase()))?.reclaimable ?? '0B'

    return [
      {
        key: 'containers',
        title: 'Stopped containers',
        risk: 'low',
        reclaimable: find('Containers'),
        includedInSafe: true,
        reason: 'Removes containers that are no longer running.'
      },
      {
        key: 'dangling-images',
        title: 'Dangling images',
        risk: 'low',
        reclaimable: 'Included in image estimate',
        includedInSafe: true,
        reason: 'Removes untagged image layers not required by running workloads.'
      },
      {
        key: 'networks',
        title: 'Unused networks',
        risk: 'low',
        reclaimable: 'Small',
        includedInSafe: true,
        reason: 'Removes networks not referenced by containers.'
      },
      {
        key: 'build-cache',
        title: 'Unused build cache',
        risk: 'low',
        reclaimable: find('Build Cache'),
        includedInSafe: true,
        reason: 'Can make the next build slower but does not delete persistent application data.'
      },
      {
        key: 'images',
        title: 'All unused images',
        risk: 'medium',
        reclaimable: find('Images'),
        includedInSafe: false,
        reason: 'Images not referenced by containers will need to be pulled or rebuilt again.'
      },
      {
        key: 'volumes',
        title: 'Unused volumes',
        risk: 'high',
        reclaimable: find('Local Volumes'),
        includedInSafe: false,
        reason: 'Volumes may contain databases, uploads, object storage, or other persistent state.'
      }
    ]
  },

  async safeCleanup(includeUnusedImages = false) {
    const commands = [
      run('docker', ['container', 'prune', '--force']),
      run('docker', ['image', 'prune', '--force']),
      run('docker', ['network', 'prune', '--force']),
      run('docker', ['builder', 'prune', '--force'])
    ]
    if (includeUnusedImages) commands.push(run('docker', ['image', 'prune', '--all', '--force']))
    return Promise.all(commands)
  }
}
