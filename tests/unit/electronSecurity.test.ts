import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Electron security baseline', () => {
  const main = readFileSync('src/main/index.ts', 'utf8')

  it('keeps renderer Node integration disabled', () => {
    expect(main).toContain('nodeIntegration: false')
  })

  it('uses context isolation and sandbox', () => {
    expect(main).toContain('contextIsolation: true')
    expect(main).toContain('sandbox: true')
  })

  it('denies renderer-created windows by default', () => {
    expect(main).toContain("return { action: 'deny' }")
  })
})
