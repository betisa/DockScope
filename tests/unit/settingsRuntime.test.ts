import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('M11 runtime settings integration', () => {
  const main = readFileSync('src/main/index.ts', 'utf8')
  const storage = readFileSync('src/main/services/windowsStorageService.ts', 'utf8')
  const runner = readFileSync('src/main/services/processRunner.ts', 'utf8')
  const settings = readFileSync('src/main/services/applicationSettingsService.ts', 'utf8')

  it('initializes settings before registering runtime IPC', () => {
    expect(main.indexOf('await applicationSettingsService.initialize()'))
      .toBeLessThan(main.indexOf('registerIpc()'))
  })

  it('honors close-to-tray and start-minimized preferences', () => {
    expect(main).toContain('settings.general.closeToTray')
    expect(main).toContain('settings.general.startMinimized')
  })

  it('uses configured Docker CLI/context and timeout', () => {
    expect(runner).toContain('DSM_DOCKER_CLI')
    expect(settings).toContain('DOCKER_CONTEXT')
    expect(runner).toContain('DSM_COMMAND_TIMEOUT_MS')
  })

  it('feeds custom VHDX path into storage discovery', () => {
    expect(storage).toContain('DSM_CUSTOM_VHDX_PATH')
  })
})
