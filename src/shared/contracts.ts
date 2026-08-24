
export type SettingsProfileId =
  | 'development'
  | 'conservative'
  | 'ci-build-heavy'
  | 'low-disk-space'
  | 'custom'

export type AppThemePreference = 'system' | 'dark' | 'light'

export type AppSettings = {
  profileId: SettingsProfileId
  general: {
    theme: AppThemePreference
    startWithWindows: boolean
    closeToTray: boolean
    startMinimized: boolean
  }
  docker: {
    cliPath: string
    context: string
    commandTimeoutSeconds: number
  }
  monitoring: {
    enabled: boolean
    pollIntervalSeconds: number
    unhealthyAlerts: boolean
    unexpectedExitAlerts: boolean
    restartLoopAlerts: boolean
    storageAlerts: boolean
    buildCacheAlerts: boolean
    vhdxWarningGb: number
    buildCacheWarningGb: number
  }
  cleanup: {
    defaultMode: 'safe' | 'balanced'
    includeUnusedImages: boolean
    buildCacheKeepGb: number
    requirePreview: boolean
  }
  terminal: {
    defaultShell: 'auto' | 'bash' | 'sh' | 'pwsh' | 'powershell' | 'cmd'
    logTailLines: number
    statsRefreshSeconds: number
    maxLogLines: number
  }
  notifications: {
    nativeNotifications: boolean
    notifyOnSuccess: boolean
    notifyOnWarning: boolean
    notifyOnCritical: boolean
  }
  storage: {
    customVhdxPath: string
    compactAfterCleanup: boolean
    warnBeforeWslShutdown: boolean
  }
  security: {
    maskSecrets: boolean
    requireTypedConfirmationForCritical: boolean
    allowForceRemove: boolean
    auditRetention: number
    recoverySnapshotRetention: number
  }
}

export type SettingsProfile = {
  id: Exclude<SettingsProfileId, 'custom'>
  name: string
  description: string
  settings: AppSettings
}


export type NotificationSeverity = 'info' | 'warning' | 'critical'

export type OperationalNotification = {
  id: string
  title: string
  message: string
  severity: NotificationSeverity
  source: 'docker' | 'container' | 'storage' | 'buildkit' | 'system'
  resourceId?: string
  resourceName?: string
  createdAt: string
  read: boolean
  action?: { label: string; page?: string }
}

export type OperationalHealth = {
  dockerReachable: boolean
  runningContainers: number
  unhealthyContainers: number
  stoppedContainers: number
  recentCritical: number
  recentWarnings: number
  vhdxSizeBytes: number
  vhdxSize: string
  buildCacheReclaimable: string
}

export type MonitoringSettings = {
  enabled: boolean
  nativeNotifications: boolean
  unhealthyAlerts: boolean
  unexpectedExitAlerts: boolean
  restartLoopAlerts: boolean
  storageAlerts: boolean
  buildCacheAlerts: boolean
  vhdxWarningGb: number
  buildCacheWarningGb: number
  pollIntervalSeconds: number
}


export type AuditSeverity = 'info' | 'warning' | 'critical'
export type AuditStatus = 'success' | 'failed' | 'cancelled'

export type RecoverySnapshot = {
  id: string
  resourceType: 'container' | 'compose' | 'image' | 'volume' | 'cleanup' | 'storage' | 'buildkit' | 'network'
  resourceId: string
  resourceName: string
  createdAt: string
  data: Record<string, unknown>
  notes: string[]
}

export type AuditEntry = {
  id: string
  operation: string
  category: string
  severity: AuditSeverity
  status: AuditStatus
  startedAt: string
  completedAt: string
  durationMs: number
  resourceType: string
  resourceIds: string[]
  resourceNames: string[]
  commandSummary: string
  message: string
  exitCode?: number
  reclaimedBefore?: string
  reclaimedAfter?: string
  reclaimedDelta?: string
  snapshotIds: string[]
}

export type AuditSummary = {
  totalActions: number
  successfulActions: number
  failedActions: number
  destructiveActions: number
  recoverySnapshots: number
  lastActionAt: string
}

export type AuditExportResult = {
  ok: boolean
  path?: string
  message: string
}


export type DiagnosticsBundleCollector = {
  name: string
  file: string
  status: 'success' | 'failed' | 'skipped'
  message: string
  bytes: number
}

export type DiagnosticsBundleManifest = {
  schemaVersion: 1
  generatedAt: string
  application: {
    name: string
    version: string
    platform: string
    arch: string
  }
  redaction: {
    enabled: true
    strategy: string
  }
  limits: {
    maxContainers: number
    containerLogTailLines: number
  }
  collectors: DiagnosticsBundleCollector[]
  warnings: string[]
}

export type DiagnosticsBundleExportResult = {
  ok: boolean
  path?: string
  message: string
  generatedAt?: string
  fileCount?: number
  sizeBytes?: number
  collectorFailures?: number
}


export type StorageTrendRange = '24h' | '7d' | '30d'

export type StorageTrendSample = {
  id: string
  capturedAt: string
  imagesBytes: number
  containersBytes: number
  volumesBytes: number
  buildCacheBytes: number
  dockerAllocatedBytes: number
  dockerReclaimableBytes: number
  vhdxBytes: number
  hostDriveFreeBytes: number
  imageCount: number
  containerCount: number
  volumeCount: number
  buildCacheRecords: number
}

export type StorageTrendSeries = {
  range: StorageTrendRange
  samples: StorageTrendSample[]
  summary: {
    sampleCount: number
    firstCapturedAt: string
    lastCapturedAt: string
    dockerAllocatedDeltaBytes: number
    vhdxDeltaBytes: number
    peakDockerAllocatedBytes: number
    peakVhdxBytes: number
    latestDockerAllocatedBytes: number
    latestDockerReclaimableBytes: number
    latestVhdxBytes: number
    latestHostDriveFreeBytes: number
  }
}

export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  ok: boolean
}

export type EngineStatus = {
  reachable: boolean
  serverVersion: string
  composeVersion: string
  context: string
}

export type DiskUsage = {
  type: string
  totalCount: number
  active: number
  size: string
  reclaimable: string
}

export type ContainerInfo = {
  id: string
  name: string
  image: string
  state: string
  startedAt: string
  status: string
  ports: string
  size: string
}

export type PortBindingInfo = {
  id: string
  containerId: string
  containerName: string
  containerState: string
  image: string
  composeProject: string
  composeService: string
  hostIp: string
  hostPort: number | null
  containerPort: number
  protocol: string
  published: boolean
  exposure: 'all-interfaces' | 'loopback' | 'specific-interface' | 'ipv6-all' | 'routed'
  endpoint: string
  suggestedUrl: string
  canOpenInBrowser: boolean
  conflict: boolean
  conflictWith: string[]
}

export type PortExplorerSummary = {
  totalBindings: number
  publishedBindings: number
  runningBindings: number
  conflictBindings: number
  httpCandidates: number
  loopbackBindings: number
  allInterfaceBindings: number
}

export type PortExplorerResult = {
  bindings: PortBindingInfo[]
  summary: PortExplorerSummary
}

export type HealthLogEntry = {
  start: string
  end: string
  exitCode: number
  output: string
}


export type ContainerFileEntry = {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink' | 'other'
  sizeBytes: number
  permissions: string
  owner: string
  group: string
  modifiedAt: string
  symlinkTarget: string
}

export type ContainerDirectoryListing = {
  path: string
  parentPath: string
  entries: ContainerFileEntry[]
  writableMount: boolean
  mountDestination: string
  warning: string
}

export type ContainerTextFile = {
  path: string
  content: string
  sizeBytes: number
  truncated: boolean
  encoding: 'utf-8'
  writableMount: boolean
  mountDestination: string
}

export type ContainerFileTransferResult = {
  ok: boolean
  message: string
  path?: string
  bytes?: number
}

export type ContainerDiagnostics = {
  id: string
  name: string
  image: string
  platform: string
  created: string
  startedAt: string
  finishedAt: string
  state: string
  status: string
  exitCode: number
  oomKilled: boolean
  restartCount: number
  stateError: string
  restartPolicy: string
  command: string[]
  entrypoint: string[]
  workingDir: string
  health: {
    configured: boolean
    status: string
    failingStreak: number
    test: string[]
    interval?: number
    timeout?: number
    retries?: number
    startPeriod?: number
    logs: HealthLogEntry[]
  }
  ports: Array<{
    privatePort: string
    publicHost: string
    publicPort: string
    protocol: string
  }>
  mounts: Array<{
    type: string
    name: string
    source: string
    destination: string
    mode: string
    rw: boolean
  }>
  networks: Array<{
    name: string
    ipAddress: string
    gateway: string
    macAddress: string
    aliases: string[]
  }>
  environment: string[]
  labels: Record<string, string>
}

export type ContainerStatsSnapshot = {
  cpuPercent: number
  memoryPercent: number
  memoryUsage: string
  networkIo: string
  blockIo: string
  pids: number
}

export type ContainerDiagnosticFinding = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: 'memory' | 'exit' | 'restart' | 'health' | 'port' | 'network' | 'permission' | 'storage' | 'configuration' | 'runtime'
  symptom: string
  likelyCause: string
  evidence: string[]
  actions: string[]
}

export type ContainerAdvisorResult = {
  containerId: string
  generatedAt: string
  status: 'critical' | 'warning' | 'healthy'
  summary: string
  diagnostics: ContainerDiagnostics
  stats: ContainerStatsSnapshot | null
  findings: ContainerDiagnosticFinding[]
  logsSampled: number
}

export type ContainerProcess = {
  pid: string
  user: string
  cpu: string
  memory: string
  command: string
}

export type ComposeProject = {
  name: string
  status: string
  configFiles: string
}


export type ComposePublisher = {
  url: string
  targetPort: number
  publishedPort: number
  protocol: string
}

export type ComposeServiceInfo = {
  id: string
  name: string
  service: string
  image: string
  state: string
  startedAt: string
  health: string
  exitCode: number
  publishers: ComposePublisher[]
}

export type ComposeServiceModel = {
  name: string
  image: string
  command: string[]
  dependsOn: string[]
  profiles: string[]
  ports: string[]
  networks: string[]
  volumes: string[]
  environment: Record<string, string>
}

export type ComposeWorkspaceModel = {
  project: string
  services: ComposeServiceModel[]
  networks: string[]
  volumes: string[]
  configs: string[]
  secrets: string[]
  rawJson: string
}

export type ComposeFileDocument = {
  path: string
  content: string
  modifiedMs: number
}

export type ComposeValidation = {
  valid: boolean
  stdout: string
  stderr: string
}

export type ImageInfo = {
  id: string
  repository: string
  tag: string
  size: string
  createdSince: string
}

export type VolumeInfo = {
  name: string
  driver: string
  scope: string
  inUse: boolean
  createdAt: string
  size: string
}

export type VolumeReference = {
  containerId: string
  containerName: string
  containerState: string
  image: string
  composeProject: string
  composeService: string
  destination: string
  readWrite: boolean
  containerCreatedAt: string
}

export type VolumeWorkload = {
  kind: 'postgresql' | 'mysql-mariadb' | 'sql-server' | 'mongodb' | 'redis' | 'minio' | 'elasticsearch' | 'generic'
  label: string
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

export type VolumeRiskAssessment = {
  score: number
  level: 'medium' | 'high' | 'critical'
  deletionAssessment: 'blocked' | 'high-risk' | 'review-required'
  reasons: string[]
  backupHints: string[]
}

export type VolumeIntelligence = {
  name: string
  driver: string
  scope: string
  createdAt: string
  size: string
  mountpoint: string
  labels: Record<string, string>
  options: Record<string, string>
  references: VolumeReference[]
  composeProjects: string[]
  workloads: VolumeWorkload[]
  latestRelatedContainerAt: string
  risk: VolumeRiskAssessment
}


export type ResourceGraphNodeKind =
  | 'compose-project'
  | 'compose-service'
  | 'container'
  | 'image'
  | 'volume'
  | 'network'
  | 'port'

export type ResourceGraphNode = {
  id: string
  kind: ResourceGraphNodeKind
  label: string
  subtitle: string
  state: string
  resourceId: string
  resourceName: string
  parentProject: string
  parentService: string
  metadata: Record<string, string>
}

export type ResourceGraphEdgeKind =
  | 'contains'
  | 'runs'
  | 'uses-image'
  | 'mounts'
  | 'connected-to'
  | 'publishes'

export type ResourceGraphEdge = {
  id: string
  source: string
  target: string
  kind: ResourceGraphEdgeKind
  label: string
}

export type ResourceDependencyGraph = {
  nodes: ResourceGraphNode[]
  edges: ResourceGraphEdge[]
  summary: {
    composeProjects: number
    services: number
    containers: number
    images: number
    volumes: number
    networks: number
    ports: number
    sharedResources: number
  }
}

export type NetworkInfo = {
  id: string
  name: string
  driver: string
  scope: string
}


export type SmartCleanupStepKey =
  | 'stopped-containers'
  | 'dangling-images'
  | 'unused-networks'
  | 'build-cache'
  | 'unused-images'

export type SmartCleanupPlanStep = {
  key: SmartCleanupStepKey
  title: string
  risk: 'low' | 'medium'
  estimatedBytes: number
  estimated: string
  selected: boolean
  priority: number
  reason: string
  commandSummary: string
}

export type SmartCleanupPlan = {
  targetBytes: number
  target: string
  potentialBytes: number
  potential: string
  selectedBytes: number
  selected: string
  achievable: boolean
  shortfallBytes: number
  shortfall: string
  steps: SmartCleanupPlanStep[]
  excluded: Array<{
    key: string
    title: string
    reason: string
  }>
  generatedAt: string
}

export type CleanupAdvisorItem = {
  key: string
  title: string
  risk: 'low' | 'medium' | 'high'
  reclaimable: string
  includedInSafe: boolean
  reason: string
}


export type BuilderInfo = {
  name: string
  driver: string
  status: string
  platforms: string
  endpoint: string
}


export type BuildHistoryRecord = {
  id: string
  ref: string
  name: string
  status: string
  createdAt: string
  completedAt: string
  duration: string
  cachedSteps: number
  completedSteps: number
  totalSteps: number
}


export type BuildHistoryMaterial = {
  uri: string
  digests: string[]
}

export type BuildHistoryAttachment = {
  digest: string
  platform: string
  type: string
}

export type BuildHistoryDetails = {
  id: string
  ref: string
  name: string
  status: string
  context: string
  dockerfile: string
  vcsRepository: string
  vcsRevision: string
  target: string
  platforms: string[]
  startedAt: string
  completedAt: string
  duration: string
  durationMs: number
  cachedSteps: number
  completedSteps: number
  totalSteps: number
  imageResolveMode: string
  materials: BuildHistoryMaterial[]
  attachments: BuildHistoryAttachment[]
}


export type AiProviderSettings = {
  enabled: boolean
  baseUrl: string
  model: string
  temperature: number
  maxOutputTokens: number
  timeoutSeconds: number
  includeBuildLogs: boolean
  maxLogChars: number
  apiKeyConfigured: boolean
}

export type AiProviderSettingsUpdate = Omit<AiProviderSettings, 'apiKeyConfigured'> & {
  apiKey?: string
  clearApiKey?: boolean
}

export type AiConnectionTestResult = {
  ok: boolean
  message: string
  model: string
  latencyMs: number
}


export type AiContainerFailureAnalysis = {
  generatedAt: string
  provider: 'openai-compatible'
  model: string
  summary: string
  confidence: 'low' | 'medium' | 'high'
  triggerReasons: string[]
  healthAssessment: {
    configured: boolean
    status: string
    assessable: boolean
    explanation: string
  }
  rootCauses: Array<{
    title: string
    evidence: string[]
    explanation: string
  }>
  recommendedActions: Array<{
    priority: 'high' | 'medium' | 'low'
    action: string
    rationale: string
  }>
  ruleFindingsUsed: number
  logsCharsSent: number
  disclaimer: string
}

export type AiBuildErrorAnalysis = {
  generatedAt: string
  provider: 'openai-compatible'
  model: string
  summary: string
  confidence: 'low' | 'medium' | 'high'
  rootCauses: Array<{
    title: string
    evidence: string[]
    explanation: string
  }>
  recommendedActions: Array<{
    priority: 'high' | 'medium' | 'low'
    action: string
    rationale: string
  }>
  ruleFindingsUsed: number
  logsCharsSent: number
  disclaimer: string
}

export type BuildDiagnosticFinding = {
  severity: 'info' | 'warning' | 'critical'
  title: string
  evidence: string
  recommendation: string
}

export type BuildDiagnostics = {
  details: BuildHistoryDetails
  logs: string
  findings: BuildDiagnosticFinding[]
}

export type BuildCacheRecord = {
  id: string
  type: string
  size: string
  createdAt: string
  lastUsedAt: string
  usageCount: number
  shared: boolean
  mutable: boolean
  reclaimable: boolean
  description: string
}

export type ImageHistoryLayer = {
  id: string
  createdSince: string
  createdBy: string
  size: string
  comment: string
}

export type ImageInsight = {
  imageId: string
  displayName: string
  totalSize: string
  largestLayerSize: string
  largestLayerCommand: string
  largeLayerCount: number
  notes: string[]
}

export type VhdxInfo = {
  path: string
  bytes: number
  size: string
  driveFree: string
}

export type StreamKind = 'container-logs' | 'container-stats' | 'docker-events' | 'compose-logs' | 'compose-stats'

export type StreamStartResult = {
  sessionId: string
}

export type TerminalStartResult = {
  sessionId: string
}


export type OperationTaskKind =
  | 'image-pull'
  | 'compose-pull'
  | 'compose-build'
  | 'compose-up'
  | 'buildkit-prune'
  | 'safe-cleanup'
  | 'smart-cleanup'
  | 'vhdx-compact'

export type OperationTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type OperationTaskRequest = {
  kind: OperationTaskKind
  title?: string
  imageRef?: string
  project?: ComposeProject
  noCache?: boolean
  build?: boolean
  pruneAll?: boolean
  keepStorageGb?: number
  includeUnusedImages?: boolean
  cleanupSteps?: SmartCleanupStepKey[]
  targetBytes?: number
  vhdxPath?: string
  sourcePage?: string
  resourceId?: string
  resourceName?: string
}

export type OperationTask = {
  id: string
  kind: OperationTaskKind
  title: string
  status: OperationTaskStatus
  createdAt: string
  startedAt: string
  completedAt: string
  durationMs: number
  progress: number | null
  progressText: string
  output: string
  exitCode: number | null
  cancellable: boolean
  cancelRequested: boolean
  sourcePage: string
  resourceId: string
  resourceName: string
  commandSummary: string
}

export type OperationTaskSummary = {
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
  total: number
}

export type AppShellApi = {
  onNavigate(callback: (target: string) => void): () => void
}


export type ReleaseChannel = 'stable' | 'preview'

export type AppRuntimeInfo = {
  appVersion: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  dockerVersion: string
  dockerComposeVersion: string
  dockerContext: string
  platform: string
  arch: string
  packaged: boolean
  portable: boolean
}

export type ReleaseNotesDocument = {
  version: string
  date: string
  channel: ReleaseChannel
  title: string
  highlights: string[]
  security: string[]
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unsupported'

export type UpdateState = {
  status: UpdateStatus
  channel: ReleaseChannel
  currentVersion: string
  availableVersion: string
  releaseName: string
  releaseDate: string
  releaseNotes: string
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
  error: string
  updateBaseUrlConfigured: boolean
  canCheck: boolean
  canDownload: boolean
  canInstall: boolean
  portable: boolean
  packaged: boolean
}

export type DockerApi = {
  engine: {
    status(): Promise<EngineStatus>
  }
  disk: {
    usage(): Promise<DiskUsage[]>
  }
  containers: {
    list(): Promise<ContainerInfo[]>
    start(ids: string[]): Promise<CommandResult>
    stop(ids: string[], timeout: number): Promise<CommandResult>
    restart(ids: string[]): Promise<CommandResult>
    remove(ids: string[], force?: boolean): Promise<CommandResult>
    logs(id: string, tail?: number): Promise<CommandResult>
    inspect(id: string): Promise<CommandResult>
    diagnostics(id: string): Promise<ContainerDiagnostics>
    advisor(id: string): Promise<ContainerAdvisorResult>
    processes(id: string): Promise<ContainerProcess[]>
    stats(id: string): Promise<CommandResult>
    exec(id: string, command: string[]): Promise<CommandResult>
    files: {
      list(id: string, path: string): Promise<ContainerDirectoryListing>
      readText(id: string, path: string): Promise<ContainerTextFile>
      download(id: string, path: string): Promise<ContainerFileTransferResult>
      upload(id: string, destinationDirectory: string): Promise<ContainerFileTransferResult>
      writeText(id: string, path: string, content: string): Promise<ContainerFileTransferResult>
    }
  }
  streams: {
    startContainerLogs(id: string, tail?: number): Promise<StreamStartResult>
    startContainerStats(id: string): Promise<StreamStartResult>
    startDockerEvents(type?: string): Promise<StreamStartResult>
    startComposeLogs(project: ComposeProject, services?: string[], tail?: number): Promise<StreamStartResult>
    startComposeStats(project: ComposeProject, services?: string[]): Promise<StreamStartResult>
    stop(sessionId: string): Promise<void>
    onData(sessionId: string, callback: (data: string) => void): () => void
    onError(sessionId: string, callback: (data: string) => void): () => void
    onExit(sessionId: string, callback: (exitCode: number | null) => void): () => void
  }
  terminal: {
    open(containerId: string, shell: string, cols: number, rows: number): Promise<TerminalStartResult>
    write(sessionId: string, data: string): Promise<void>
    resize(sessionId: string, cols: number, rows: number): Promise<void>
    close(sessionId: string): Promise<void>
    onData(sessionId: string, callback: (data: string) => void): () => void
    onExit(sessionId: string, callback: (exitCode: number) => void): () => void
  }
  ports: {
    list(): Promise<PortExplorerResult>
    open(url: string): Promise<void>
  }
  graph: {
    dependencies(): Promise<ResourceDependencyGraph>
  }
  tasks: {
    list(): Promise<OperationTask[]>
    summary(): Promise<OperationTaskSummary>
    enqueue(request: OperationTaskRequest): Promise<OperationTask>
    cancel(id: string): Promise<OperationTask>
    clearCompleted(): Promise<void>
    onChanged(callback: (task: OperationTask) => void): () => void
  }
  compose: {
    list(): Promise<ComposeProject[]>
    start(project: ComposeProject): Promise<CommandResult>
    stop(project: ComposeProject): Promise<CommandResult>
    restart(project: ComposeProject): Promise<CommandResult>
    down(project: ComposeProject, removeVolumes?: boolean): Promise<CommandResult>
    logs(project: ComposeProject, tail?: number): Promise<CommandResult>
    services(project: ComposeProject): Promise<ComposeServiceInfo[]>
    workspace(project: ComposeProject): Promise<ComposeWorkspaceModel>
    serviceStart(project: ComposeProject, service: string): Promise<CommandResult>
    serviceStop(project: ComposeProject, service: string): Promise<CommandResult>
    serviceRestart(project: ComposeProject, service: string): Promise<CommandResult>
    pull(project: ComposeProject): Promise<CommandResult>
    build(project: ComposeProject, noCache?: boolean): Promise<CommandResult>
    up(project: ComposeProject, build?: boolean): Promise<CommandResult>
    configValidate(project: ComposeProject, content?: string, filePath?: string): Promise<ComposeValidation>
    readFile(project: ComposeProject, filePath?: string): Promise<ComposeFileDocument>
    saveFile(project: ComposeProject, filePath: string, content: string, expectedOriginal: string): Promise<CommandResult>
  }
  images: {
    list(): Promise<ImageInfo[]>
    remove(ids: string[], force?: boolean): Promise<CommandResult>
    prune(all?: boolean): Promise<CommandResult>
  }
  volumes: {
    list(): Promise<VolumeInfo[]>
    intelligence(): Promise<VolumeIntelligence[]>
    remove(names: string[], force?: boolean): Promise<CommandResult>
    prune(all?: boolean): Promise<CommandResult>
  }
  networks: {
    list(): Promise<NetworkInfo[]>
    prune(): Promise<CommandResult>
  }
  cleanup: {
    advisor(): Promise<CleanupAdvisorItem[]>
    plan(targetBytes: number): Promise<SmartCleanupPlan>
    safe(includeUnusedImages?: boolean): Promise<CommandResult[]>
  }
  buildkit: {
    builders(): Promise<BuilderInfo[]>
    history(): Promise<BuildHistoryRecord[]>
    diagnostics(ref: string): Promise<BuildDiagnostics>
    open(ref: string): Promise<CommandResult>
    diskUsage(): Promise<BuildCacheRecord[]>
    prune(all?: boolean, keepStorageGb?: number): Promise<CommandResult>
  }
  ai: {
    settings(): Promise<AiProviderSettings>
    saveSettings(settings: AiProviderSettingsUpdate): Promise<AiProviderSettings>
    testConnection(settings?: AiProviderSettingsUpdate): Promise<AiConnectionTestResult>
    analyzeBuildError(ref: string): Promise<AiBuildErrorAnalysis>
    analyzeContainerFailure(containerId: string): Promise<AiContainerFailureAnalysis>
  }
  imageInsights: {
    history(imageId: string): Promise<ImageHistoryLayer[]>
    analyze(imageId: string): Promise<ImageInsight>
  }
  monitoring: {
    health(): Promise<OperationalHealth>
    notifications(): Promise<OperationalNotification[]>
    markRead(ids: string[]): Promise<void>
    clear(): Promise<void>
    settings(): Promise<MonitoringSettings>
    saveSettings(settings: MonitoringSettings): Promise<MonitoringSettings>
    refresh(): Promise<OperationalHealth>
  }
  diagnosticsBundle: {
    export(): Promise<DiagnosticsBundleExportResult>
  }
  audit: {
    list(): Promise<AuditEntry[]>
    summary(): Promise<AuditSummary>
    snapshots(): Promise<RecoverySnapshot[]>
    snapshot(id: string): Promise<RecoverySnapshot | null>
    clear(): Promise<void>
    export(): Promise<AuditExportResult>
  }
  about: {
    runtime(): Promise<AppRuntimeInfo>
    releaseNotes(): Promise<ReleaseNotesDocument>
  }
  updates: {
    state(): Promise<UpdateState>
    check(): Promise<UpdateState>
    download(): Promise<UpdateState>
    install(): Promise<void>
    setChannel(channel: ReleaseChannel): Promise<UpdateState>
    onChanged(callback: (state: UpdateState) => void): () => void
  }
  preferences: {
    get<T = unknown>(key: string): Promise<T | null>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    save(settings: AppSettings): Promise<AppSettings>
    profiles(): Promise<SettingsProfile[]>
    applyProfile(profileId: Exclude<SettingsProfileId, 'custom'>): Promise<AppSettings>
    reset(): Promise<AppSettings>
  }
  storage: {
    findVhdx(): Promise<VhdxInfo[]>
    compact(path: string): Promise<CommandResult>
    trends(range: StorageTrendRange): Promise<StorageTrendSeries>
    sampleNow(): Promise<StorageTrendSample>
  }
}

declare global {
  interface Window {
    dockerApi: DockerApi
    electron: AppShellApi
  }
}
