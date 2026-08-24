import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Electron E2E shell regressions', () => {
  const app = readFileSync('src/renderer/src/App.tsx','utf8')
  const runner = readFileSync('src/main/services/processRunner.ts','utf8')
  const taskCenter = readFileSync('src/main/services/taskCenterService.ts','utf8')

  it('gives the actual nav landmark the Primary navigation accessible name', () => {
    expect(app).toContain('<nav className="nav" aria-label="Primary navigation">')
  })

  it('runs Docker mock scripts through Electron as Node', () => {
    expect(runner).toContain("ELECTRON_RUN_AS_NODE: '1'")
    expect(runner).toContain('env: resolved.env ?? process.env')
  })

  it('propagates resolved command environment to Task Center child processes', () => {
    expect(taskCenter).toContain('env: resolved.env ?? process.env')
  })
})
