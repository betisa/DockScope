import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from '../../src/main/services/processRunner'

const mock = path.resolve('tests/mock/docker-cli.mjs')

describe('processRunner', () => {
  it('captures stdout and exit code', async () => {
    process.env.DSM_DOCKER_MOCK_SCRIPT = mock
    const result = await run('docker', ['version', '--format', '{{.Server.Version}}'])
    expect(result.ok).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('29.6.1')
  })

  it('captures command failures', async () => {
    process.env.DSM_DOCKER_MOCK_SCRIPT = mock
    process.env.DSM_MOCK_SCENARIO = 'failure'
    const result = await run('docker', ['info'])
    expect(result.ok).toBe(false)
    expect(result.exitCode).toBe(42)
    expect(result.stderr).toContain('mock failure')
  })

  it('kills timed out commands', async () => {
    process.env.DSM_DOCKER_MOCK_SCRIPT = mock
    process.env.DSM_MOCK_SCENARIO = 'timeout'
    const result = await run('docker', ['info'], 30)
    expect(result.ok).toBe(false)
    expect(result.exitCode).toBe(-2)
    expect(result.stderr).toContain('timed out')
  })
})
