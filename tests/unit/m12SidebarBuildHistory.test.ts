import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Sidebar identity and Build History', () => {
  const app = readFileSync('src/renderer/src/App.tsx', 'utf8')
  const buildkit = readFileSync('src/renderer/src/pages/BuildKitPage.tsx', 'utf8')
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')

  it('renders Settings only once in the sidebar navigation', () => {
    const matches = app.match(/label: 'Settings'/g) ?? []
    expect(matches).toHaveLength(1)
    expect(app).not.toContain('<div className="sidebar-footer">')
  })

  it('uses the packaged application icon in the sidebar brand', () => {
    expect(app).toContain("import appIconUrl from './assets/app-icon.png'")
    expect(app).toContain('<img src={appIconUrl}')
  })

  it('loads real Buildx history records', () => {
    expect(service).toContain("'buildx', 'history', 'ls'")
    expect(buildkit).toContain('Build history')
    expect(buildkit).toContain('window.dockerApi.buildkit.history()')
  })
})
