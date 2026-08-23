import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('P13.01 Build Diagnostics Workspace', () => {
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/BuildKitPage.tsx', 'utf8')
  const workspace = readFileSync('src/renderer/src/components/BuildDiagnosticsModal.tsx', 'utf8')

  it('uses official Buildx history inspect, logs and open commands in Electron Main', () => {
    expect(service).toContain("['buildx', 'history', 'inspect', '--format', 'json', ref]")
    expect(service).toContain("['buildx', 'history', 'logs', '--progress', 'plain', ref]")
    expect(service).toContain("['buildx', 'history', 'open', ref]")
  })

  it('keeps Docker execution behind IPC/preload', () => {
    expect(ipc).toContain("'buildkit:diagnostics'")
    expect(ipc).toContain('safeBuildRef(ref)')
    expect(preload).toContain("ipcRenderer.invoke('buildkit:diagnostics', ref)")
    expect(workspace).not.toContain('child_process')
  })

  it('adds diagnostics entrypoint to every build row', () => {
    expect(page).toContain('openDiagnostics(build)')
    expect(page).toContain('<BuildDiagnosticsModal')
    expect(page).toContain('>Diagnostics</button>')
  })

  it('provides the required diagnostics tabs', () => {
    for (const label of ['Overview', 'Logs', 'Steps', 'Cache', 'Timing', 'Error Analysis']) {
      expect(workspace).toContain(`label: '${label}'`)
    }
  })

  it('keeps error analysis evidence-driven', () => {
    expect(service).toContain('analyzeBuildFailure')
    expect(service).toContain("title: 'No known failure pattern detected'")
    expect(service).toContain('This advisor intentionally avoids guessing without evidence.')
  })
})
