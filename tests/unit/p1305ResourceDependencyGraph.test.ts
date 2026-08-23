import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.05 Resource Dependency Graph', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/ResourceGraphPage.tsx', 'utf8')
  const nav = readFileSync('src/renderer/src/navigation.ts', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')

  it('exposes a typed read-only graph through Electron Main', () => {
    expect(contracts).toContain('export type ResourceDependencyGraph')
    expect(contracts).toContain('export type ResourceGraphNodeKind')
    expect(service).toContain('async resourceDependencyGraph(): Promise<ResourceDependencyGraph>')
    expect(ipc).toContain("ipcMain.handle('graph:dependencies'")
    expect(preload).toContain("ipcRenderer.invoke('graph:dependencies')")
  })

  it('models the required resource relationships from Docker inspect metadata', () => {
    expect(service).toContain("'compose-project'")
    expect(service).toContain("'compose-service'")
    expect(service).toContain("kind: 'uses-image'")
    expect(service).toContain("kind: 'mounts'")
    expect(service).toContain("kind: 'connected-to'")
    expect(service).toContain("kind: 'publishes'")
    expect(service).toContain("container.NetworkSettings?.Networks")
    expect(service).toContain("container.NetworkSettings?.Ports")
    expect(service).toContain("container.Mounts")
  })

  it('deduplicates shared image, volume, network and port nodes by stable ids', () => {
    expect(service).toContain('const nodes = new Map<string, ResourceGraphNode>()')
    expect(service).toContain('const edges = new Map<string, ResourceGraphEdge>()')
    expect(service).toContain("sharedKinds = new Set(['image', 'volume', 'network', 'port'])")
  })

  it('provides SVG topology, search, type filter and neighborhood focus without a graph dependency', () => {
    expect(page).toContain('<svg')
    expect(page).toContain('Search graph')
    expect(page).toContain('Resource type')
    expect(page).toContain('Focus selected neighborhood')
    expect(page).toContain('Edge labels')
    expect(page).not.toContain('reactflow')
    expect(page).not.toContain('cytoscape')
    expect(page).not.toContain('d3')
  })

  it('provides accessible node navigation and resource deep links', () => {
    expect(page).toContain('role="button"')
    expect(page).toContain('tabIndex={0}')
    expect(page).toContain("onNavigate('containers')")
    expect(page).toContain("onNavigate('compose')")
    expect(page).toContain("onNavigate('images')")
    expect(page).toContain("onNavigate('volumes')")
    expect(page).toContain("onNavigate('networks')")
    expect(page).toContain("onNavigate('ports')")
  })

  it('registers Resource Graph in navigation and in-app Guide', () => {
    expect(nav).toContain("id: 'resource-graph'")
    expect(nav).toContain("label: 'Resource Graph'")
    expect(guide).toContain("title: 'Resource Dependency Graph Guide'")
    expect(guide).toContain('current Docker metadata snapshot')
  })
})
