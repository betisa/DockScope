import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

describe('Windows packaging contract', () => {
  it('uses ASAR and unpacks native node-pty', () => {
    expect(pkg.build.asar).toBe(true)
    expect(pkg.build.asarUnpack.some((x: string) => x.includes('node-pty'))).toBe(true)
  })

  it('builds both NSIS and portable Windows artifacts', () => {
    expect(pkg.build.win.target).toContain('nsis')
    expect(pkg.build.win.target).toContain('portable')
  })

  it('prevents accidental npm publication', () => {
    expect(pkg.private).toBe(true)
  })
})
