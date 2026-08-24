import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Uptime Reports page', () => {
  const page = readFileSync('src/renderer/src/pages/UptimePage.tsx', 'utf8')
  const navigation = readFileSync('src/renderer/src/navigation.ts', 'utf8')
  const productivity = readFileSync('src/renderer/src/productivity/model.ts', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')

  it('registers a top-level uptime route and command-palette entry', () => {
    expect(navigation).toContain("'uptime'")
    expect(productivity).toContain("['uptime','Uptime Reports'")
    expect(page).toContain("PageTitle page=\"uptime\"")
  })

  it('collects Docker and Compose runtime state without duplicating Compose containers', () => {
    expect(page).toContain('window.dockerApi.containers.list()')
    expect(page).toContain('window.dockerApi.compose.services(project)')
    expect(page).toContain('const composeIds = new Set')
    expect(page).toContain('Runtime-derived status history')
  })

  it('documents runtime-derived reporting limitations', () => {
    expect(guide).toContain('Uptime Reports Guide')
    expect(guide).toContain('not HTTP/TCP checks against external endpoints')
  })
})
