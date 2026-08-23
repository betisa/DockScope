import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { dockerService } from '../../src/main/services/dockerService'

const mock = path.resolve('tests/mock/docker-cli.mjs')

describe('dockerService using mock Docker CLI', () => {
  beforeEach(() => {
    process.env.DSM_DOCKER_MOCK_SCRIPT = mock
    process.env.DSM_MOCK_SCENARIO = 'success'
  })

  it('returns engine status without a real Docker daemon', async () => {
    const status = await dockerService.engineStatus()
    expect(status).toEqual({
      reachable: true,
      serverVersion: '29.6.1',
      composeVersion: '2.39.1',
      context: 'desktop-linux'
    })
  })

  it('parses docker system df JSON lines', async () => {
    const usage = await dockerService.diskUsage()
    expect(usage).toHaveLength(4)
    expect(usage.find(x => x.type === 'Build Cache')?.reclaimable).toContain('9.1GB')
  })


  it('builds a minimal Smart Cleanup plan for a reclaim target', async () => {
    const plan = await dockerService.smartCleanupPlan(10_000_000_000)

    expect(plan).toMatchObject({
      target: '10.0 GB',
      selected: '10.5 GB',
      potential: '15.0 GB',
      achievable: true,
      shortfallBytes: 0
    })

    expect(plan.steps.filter(step => step.selected).map(step => step.key)).toEqual([
      'build-cache',
      'dangling-images'
    ])
    expect(plan.steps.find(step => step.key === 'unused-images')).toMatchObject({
      estimated: '3.70 GB',
      selected: false,
      risk: 'medium'
    })
    expect(plan.excluded.some(item => item.key === 'volumes')).toBe(true)
  })

  it('reports Smart Cleanup shortfall without adding volumes', async () => {
    const plan = await dockerService.smartCleanupPlan(20_000_000_000)

    expect(plan.achievable).toBe(false)
    expect(plan.potential).toBe('15.0 GB')
    expect(plan.shortfall).toBe('5.00 GB')
    expect(plan.steps.find(step => step.key === 'unused-images')?.selected).toBe(true)
    expect(plan.steps.some(step => step.key === ('volumes' as any))).toBe(false)
    expect(plan.excluded).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'volumes' })
    ]))
  })

  it('parses container inventory', async () => {
    const containers = await dockerService.containers()
    expect(containers.map(x => x.name)).toEqual(['api', 'worker'])
    expect(containers[0].state).toBe('running')
  })



  it('produces evidence-driven container advisor findings for OOM/restart/health failures', async () => {
    process.env.DSM_MOCK_ADVISOR = 'oom'
    const result = await dockerService.containerAdvisor('abc123')

    expect(result.status).toBe('critical')
    expect(result.diagnostics).toMatchObject({
      exitCode: 137,
      oomKilled: true,
      restartCount: 7
    })
    expect(result.findings.some(x => x.id === 'oom-killed')).toBe(true)
    expect(result.findings.some(x => x.id === 'restart-loop')).toBe(true)
    expect(result.findings.some(x => x.id === 'unhealthy')).toBe(true)
    expect(result.findings.find(x => x.id === 'oom-killed')?.evidence).toContain('OOMKilled=true')
    delete process.env.DSM_MOCK_ADVISOR
  })

  it('returns a healthy advisor result when no known evidence pattern matches', async () => {
    delete process.env.DSM_MOCK_ADVISOR
    const result = await dockerService.containerAdvisor('abc123')
    expect(result.status).toBe('healthy')
    expect(result.findings).toHaveLength(0)
    expect(result.stats).toMatchObject({ cpuPercent: 12.5, memoryPercent: 43.95, pids: 18 })
  })


  it('builds a global Port Explorer inventory with Compose ownership and conflicts', async () => {
    const result = await dockerService.portExplorer()

    expect(result.bindings).toHaveLength(5)
    expect(result.summary).toMatchObject({
      totalBindings: 5,
      publishedBindings: 4,
      runningBindings: 4,
      conflictBindings: 2,
      httpCandidates: 3,
      loopbackBindings: 2,
      allInterfaceBindings: 2
    })

    const api = result.bindings.find(x => x.containerName === 'api' && x.containerPort === 8080)
    expect(api).toMatchObject({
      hostIp: '0.0.0.0',
      hostPort: 8080,
      protocol: 'tcp',
      composeProject: 'sample',
      composeService: 'api',
      exposure: 'all-interfaces',
      suggestedUrl: 'http://localhost:8080',
      conflict: true
    })
    expect(api?.conflictWith).toContain('worker')

    const worker = result.bindings.find(x => x.containerName === 'worker' && x.containerPort === 9090)
    expect(worker).toMatchObject({
      hostIp: '127.0.0.1',
      hostPort: 8080,
      exposure: 'loopback',
      conflict: true
    })

    const udp = result.bindings.find(x => x.protocol === 'udp')
    expect(udp?.conflict).toBe(false)

    const routed = result.bindings.find(x => x.containerPort === 6379)
    expect(routed).toMatchObject({
      published: false,
      hostPort: null,
      exposure: 'routed'
    })
  })

  it('parses Buildx snake_case NDJSON build history', async () => {
    const builds = await dockerService.buildHistory()

    expect(builds).toHaveLength(3)
    expect(builds[0]).toMatchObject({
      id: 'vh50t5y5k6dlcmj0bnwi2tc4r',
      ref: 'desktop-linux/desktop-linux/vh50t5y5k6dlcmj0bnwi2tc4r',
      name: '',
      status: 'Completed',
      cachedSteps: 11,
      completedSteps: 19,
      totalSteps: 19
    })
    expect(builds[0].duration).toBe('927ms')

    expect(builds[1]).toMatchObject({
      id: 'bjg3aqtclgtkp115v4nbri1dv',
      name: 'demo-client',
      status: 'Error',
      cachedSteps: 1,
      completedSteps: 9,
      totalSteps: 15
    })

    expect(builds[2]).toMatchObject({
      name: 'src/BetisaAi.Gateway.Api',
      cachedSteps: 36,
      completedSteps: 44,
      totalSteps: 44
    })
  })

  it('loads Buildx diagnostics workspace data and evidence-based findings', async () => {
    const diagnostics = await dockerService.buildDiagnostics('vh50t5y5k6dlcmj0bnwi2tc4r')
    expect(diagnostics.details).toMatchObject({
      id: 'vh50t5y5k6dlcmj0bnwi2tc4r',
      context: '.',
      dockerfile: 'Dockerfile',
      target: 'runtime',
      cachedSteps: 11,
      completedSteps: 19,
      totalSteps: 19
    })
    expect(diagnostics.logs).toContain('npm ERR! code ENOTFOUND')
    expect(diagnostics.findings.some(x => x.title === 'Network or DNS failure')).toBe(true)
    expect(diagnostics.findings.some(x => x.title === 'Package restore/install failure')).toBe(true)
  })

  it('opens a Buildx history record in Docker Desktop', async () => {
    const result = await dockerService.openBuildHistory('vh50t5y5k6dlcmj0bnwi2tc4r')
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('Opened build in Docker Desktop')
  })



  it('builds a Docker resource dependency graph with shared resources', async () => {
    const graph = await dockerService.resourceDependencyGraph()

    expect(graph.summary).toMatchObject({
      composeProjects: 1,
      services: 2,
      containers: 2,
      images: 1,
      volumes: 1,
      networks: 1,
      ports: 4,
      sharedResources: 2
    })

    expect(graph.nodes.some(node => node.id === 'compose-project:sample')).toBe(true)
    expect(graph.nodes.some(node => node.id === 'compose-service:sample:api')).toBe(true)
    expect(graph.nodes.some(node => node.id === 'container:abc123')).toBe(true)
    expect(graph.nodes.some(node => node.id === 'image:sha256:shared-app')).toBe(true)
    expect(graph.nodes.some(node => node.id === 'volume:db-data')).toBe(true)
    expect(graph.nodes.some(node => node.id === 'network:net-shared')).toBe(true)

    expect(graph.edges.some(edge =>
      edge.source === 'compose-project:sample' &&
      edge.target === 'compose-service:sample:api' &&
      edge.kind === 'contains'
    )).toBe(true)

    expect(graph.edges.filter(edge => edge.target === 'image:sha256:shared-app')).toHaveLength(2)
    expect(graph.edges.filter(edge => edge.target === 'network:net-shared')).toHaveLength(2)
    expect(graph.edges.some(edge =>
      edge.source === 'container:abc123' &&
      edge.target === 'volume:db-data' &&
      edge.kind === 'mounts'
    )).toBe(true)
  })

  it('builds Volume Intelligence with ownership, workload detection and conservative risk', async () => {
    const volumes = await dockerService.volumeIntelligence()
    expect(volumes).toHaveLength(2)

    const database = volumes.find(x => x.name === 'db-data')!
    expect(database).toMatchObject({
      size: '2.45GB',
      mountpoint: '/var/lib/docker/volumes/db-data/_data',
      composeProjects: ['sample'],
      latestRelatedContainerAt: '2026-08-21T10:00:00Z'
    })
    expect(database.references).toHaveLength(1)
    expect(database.references[0]).toMatchObject({
      containerId: 'abc123',
      containerName: 'api',
      composeProject: 'sample',
      composeService: 'api',
      destination: '/var/lib/postgresql/data',
      readWrite: true
    })
    expect(database.workloads.some(x => x.kind === 'postgresql' && x.confidence === 'high')).toBe(true)
    expect(database.risk.level).toBe('critical')
    expect(database.risk.deletionAssessment).toBe('blocked')
    expect(database.risk.backupHints.join(' ')).toContain('PostgreSQL')

    const uploads = volumes.find(x => x.name === 'uploads')!
    expect(uploads.references).toHaveLength(0)
    expect(uploads.risk.deletionAssessment).toBe('high-risk')
    expect(uploads.risk.reasons.join(' ')).toContain('No current container reference')
  })

  it('returns volume creation time and verbose disk size', async () => {
    const volumes = await dockerService.volumes()
    expect(volumes).toHaveLength(2)
    expect(volumes[0]).toMatchObject({
      name: 'db-data',
      createdAt: '2026-08-01T10:15:00Z',
      size: '2.45GB',
      inUse: true
    })
    expect(volumes[1]).toMatchObject({
      name: 'uploads',
      size: '128.5MB',
      inUse: false
    })
  })

  it('degrades engine status when daemon is unavailable', async () => {
    process.env.DSM_MOCK_SCENARIO = 'daemon-down'
    const status = await dockerService.engineStatus()
    expect(status.reachable).toBe(false)
  })
})
