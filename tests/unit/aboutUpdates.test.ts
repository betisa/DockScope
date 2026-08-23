import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('About / Updates / Release Channel', () => {
  const contracts = readFileSync('src/shared/contracts.ts','utf8')
  const service = readFileSync('src/main/services/updateService.ts','utf8')
  const main = readFileSync('src/main/index.ts','utf8')
  const ipc = readFileSync('src/main/ipc.ts','utf8')
  const preload = readFileSync('src/preload/index.ts','utf8')
  const page = readFileSync('src/renderer/src/pages/AboutPage.tsx','utf8')
  const nav = readFileSync('src/renderer/src/navigation.ts','utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts','utf8')
  const packageJson = readFileSync('package.json','utf8')
  const updateConfig = readFileSync('electron-builder.github.cjs','utf8')

  it('defines typed runtime, release-note and updater contracts', () => {
    expect(contracts).toContain("export type ReleaseChannel = 'stable' | 'preview'")
    expect(contracts).toContain('export type AppRuntimeInfo')
    expect(contracts).toContain('export type ReleaseNotesDocument')
    expect(contracts).toContain('export type UpdateState')
    expect(contracts).toContain('onChanged(callback: (state: UpdateState)')
  })

  it('uses current electron-updater dependency and generates update files for channels', () => {
    expect(packageJson).toContain('"electron-updater": "6.8.9"')
    expect(packageJson).toContain('"generateUpdatesFilesForAllChannels": true')
    expect(packageJson).toContain('"release:github:win"')
    expect(updateConfig).toContain("provider: 'github'")
    expect(updateConfig).toContain("owner: 'mohikan1986'")
    expect(updateConfig).toContain("repo: 'DockScope'")
    expect(updateConfig).toContain("target: ['nsis']")
  })

  it('derives runtime versions from the running application and Docker', () => {
    expect(service).toContain('app.getVersion()')
    expect(service).toContain('process.versions.electron')
    expect(service).toContain('process.versions.node')
    expect(service).toContain('process.versions.chrome')
    expect(service).toContain('dockerService.engineStatus()')
  })

  it('persists only Stable or Preview and maps them to latest/beta', () => {
    expect(service).toContain("return channel === 'preview' ? 'beta' : 'latest'")
    expect(service).toContain("databaseService.setState('application.releaseChannel'")
    expect(ipc).toContain("value !== 'stable' && value !== 'preview'")
    expect(page).toContain('Stable')
    expect(page).toContain('Preview')
  })

  it('requires explicit check, download and install instead of auto download', () => {
    expect(service).toContain('autoUpdater.autoDownload = false')
    expect(service).toContain('autoUpdater.checkForUpdates()')
    expect(service).toContain('autoUpdater.downloadUpdate()')
    expect(service).toContain('autoUpdater.quitAndInstall(false, true)')
    expect(page).toContain('Check for updates')
    expect(page).toContain('Download update')
    expect(page).toContain('Install & Restart')
    expect(page).toContain('window.confirm(')
  })

  it('reports download progress through event-driven typed IPC', () => {
    expect(service).toContain("autoUpdater.on('download-progress'")
    expect(ipc).toContain("webContents.send('updates:changed'")
    expect(preload).toContain("subscribe('updates:changed', callback)")
    expect(page).toContain('update.bytesPerSecond')
    expect(page).toContain('update.percent')
  })

  it('blocks self-update for dev and portable builds', () => {
    expect(service).toContain("app.isPackaged")
    expect(service).toContain("PORTABLE_EXECUTABLE_DIR")
    expect(service).toContain('Portable builds cannot self-update')
    expect(page).toContain('Portable — manual update')
    expect(page).toContain('Auto-update is intentionally disabled during development')
  })

  it('does not allow Renderer to configure arbitrary feed URLs', () => {
    expect(contracts).not.toContain('setFeedUrl')
    expect(preload).not.toContain('setFeedURL')
    expect(ipc).not.toContain('updates:set-feed')
    expect(service).not.toContain('setFeedURL')
    expect(service).toContain('resources/app-update.yml')
    expect(updateConfig).toContain("provider: 'github'")
  })

  it('bundles current release notes and displays remote release notes', () => {
    expect(packageJson).toContain('"to": "release-notes.json"')
    expect(service).toContain("path.join(process.resourcesPath,'release-notes.json')")
    expect(service).toContain('info.releaseNotes')
    expect(page).toContain('Current release notes')
    expect(page).toContain('Available release')
  })

  it('adds About & Updates to navigation and contextual Guide', () => {
    expect(nav).toContain("id: 'about'")
    expect(nav).toContain("label: 'About & Updates'")
    expect(guide).toContain("title: 'About & Updates Guide'")
    expect(guide).toContain("Stable maps to the latest update channel")
  })

  it('initializes updater only after application/database setup', () => {
    expect(main).toContain('await updateService.initialize()')
  })
})
