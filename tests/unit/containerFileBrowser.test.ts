import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Container File Browser', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const workspace = readFileSync('src/renderer/src/components/ContainerWorkspace.tsx', 'utf8')
  const browser = readFileSync('src/renderer/src/components/ContainerFileBrowser.tsx', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')

  it('defines typed file-browser contracts', () => {
    expect(contracts).toContain('export type ContainerFileEntry')
    expect(contracts).toContain('export type ContainerDirectoryListing')
    expect(contracts).toContain('export type ContainerTextFile')
    expect(contracts).toContain('export type ContainerFileTransferResult')
    expect(contracts).toContain('files: {')
  })

  it('validates absolute container paths and blocks parent traversal', () => {
    expect(service).toContain("if (!input.startsWith('/'))")
    expect(service).toContain("parts.some(part => part === '..')")
    expect(ipc).toContain("if (!input.startsWith('/'))")
    expect(ipc).toContain("parts.some(part => part === '..')")
  })

  it('reads the container archive through Docker instead of requiring a shell', () => {
    expect(service).toContain("run('docker', ['cp', `${id}:${target}`, payloadPath])")
    expect(service).toContain('fs.readdir(staged.payloadPath)')
  })

  it('bounds text preview and prevents truncated-file save in UI', () => {
    expect(service).toContain('const MAX_TEXT_BYTES = 1_000_000')
    expect(browser).toContain('Only the first 1 MB is shown.')
    expect(browser).toContain('textFile.truncated')
    expect(browser).toContain('readOnly={textFile.truncated || selectedWriteBlocked}')
  })

  it('keeps host path selection in Electron Main', () => {
    expect(ipc).toContain("dialog.showSaveDialog")
    expect(ipc).toContain("dialog.showOpenDialog")
    expect(preload).toContain("download: (id, path) => ipcRenderer.invoke('containers:files:download', id, path)")
    expect(preload).toContain("upload: (id, destinationDirectory) => ipcRenderer.invoke('containers:files:upload', id, destinationDirectory)")
  })


  it('canonicalizes symlinked write targets before mount-risk checks', () => {
    expect(service).toContain('async resolveContainerPath')
    expect(service).toContain('readlink -f "$DSM_PATH"')
    expect(ipc).toContain('await dockerService.resolveContainerPath(containerId, requestedDestination)')
    expect(ipc).toContain('await dockerService.resolveContainerPath(containerId, requestedTarget)')
    expect(ipc).toContain('resolved destination is inside a read-only mount')
  })

  it('guards upload and text writes with size limits and explicit Main confirmation', () => {
    expect(ipc).toContain('const MAX_UPLOAD_BYTES = 100 * 1024 * 1024')
    expect(ipc).toContain('const MAX_WRITE_BYTES = 1_000_000')
    expect(ipc).toContain("title:'Confirm guarded container upload'")
    expect(ipc).toContain("title:'Confirm guarded container write'")
    expect(ipc).toContain('Existing files with the same name may be overwritten.')
    expect(ipc).toContain('The existing file will be replaced.')
  })

  it('blocks writes to read-only mounts and escalates persistent mount audit severity', () => {
    expect(ipc).toContain("throw new Error('Upload is blocked because the resolved destination is inside a read-only mount.')")
    expect(ipc).toContain("throw new Error('Text save is blocked because the resolved file is inside a read-only mount.')")
    expect(ipc).toContain("severity:risk.persistent ? 'critical' : 'warning'")
  })

  it('audits download, upload and write operations without persisting host paths in command summaries', () => {
    expect(ipc).toContain("operation:'Download container file'")
    expect(ipc).toContain("operation:'Upload container file'")
    expect(ipc).toContain("operation:'Write container text file'")
    expect(ipc).toContain('<selected destination>')
    expect(ipc).toContain('<selected source>')
    expect(ipc).toContain('<temporary text>')
  })

  it('adds a Files tab to Container Workspace with required user actions', () => {
    expect(workspace).toContain("'files'")
    expect(workspace).toContain('<ContainerFileBrowser')
    expect(browser).toContain('Upload')
    expect(browser).toContain('Folder02Icon')
    expect(browser).toContain('GridViewIcon')
    expect(browser).toContain('ListViewIcon')
    expect(browser).toContain('Copy path')
    expect(browser).toContain('Download')
    expect(browser).toContain('Save text…')
  })

  it('documents guarded write behavior in the Container Guide', () => {
    expect(guide).toContain("title: 'Container File Browser'")
    expect(guide).toContain("title: 'Write safeguards'")
    expect(guide).toContain('Upload and text save are blocked inside read-only mounts.')
  })
})
