import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('M11 settings contract', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/applicationSettingsService.ts', 'utf8')

  it('defines the four required named profiles plus custom state', () => {
    expect(service).toContain("'development'")
    expect(service).toContain("'conservative'")
    expect(service).toContain("'ci-build-heavy'")
    expect(service).toContain("'low-disk-space'")
    expect(contracts).toContain("| 'custom'")
  })

  it('keeps persistent volume deletion outside profile settings', () => {
    expect(service).not.toContain('deleteVolumes')
    expect(service).not.toContain('pruneVolumes')
  })

  it('applies Docker CLI and context through process environment', () => {
    expect(service).toContain('DSM_DOCKER_CLI')
    expect(service).toContain('DOCKER_CONTEXT')
  })

  it('keeps typed confirmation enabled by default', () => {
    expect(service).toContain('requireTypedConfirmationForCritical: true')
  })
})
