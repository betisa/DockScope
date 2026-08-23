import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Compose editor loading regression', () => {
  const panel = readFileSync('src/renderer/src/components/ComposeEditorPanel.tsx','utf8')
  const service = readFileSync('src/main/services/dockerService.ts','utf8')

  it('always exits loading state through finally', () => {
    expect(panel).toContain('const [loading, setLoading] = useState(true)')
    expect(panel).toContain('setLoading(true)')
    expect(panel).toContain('finally {')
    expect(panel).toContain('setLoading(false)')
  })

  it('shows a visible error state and retry instead of permanent loading text', () => {
    expect(panel).toContain('Compose source file could not be opened')
    expect(panel).toContain('Editor unavailable')
    expect(panel).toContain('Retry')
    expect(panel).toContain('Docker reported config files')
    expect(panel).not.toContain("doc?.path ?? 'Loading compose file…'")
  })

  it('validates the document returned by IPC before entering ready state', () => {
    expect(panel).toContain("typeof x.path !== 'string'")
    expect(panel).toContain("typeof x.content !== 'string'")
    expect(panel).toContain('Compose file endpoint returned an invalid document.')
  })

  it('bounds Main-process source-file reads and reports common filesystem errors', () => {
    expect(service).toContain('const timeoutMs = 10_000')
    expect(service).toContain('Promise.race([')
    expect(service).toContain('Compose source file no longer exists')
    expect(service).toContain('Compose source file is not readable by DockScope')
  })

  it('normalizes Docker ConfigFiles arrays as well as strings', () => {
    expect(service).toContain('Array.isArray(x.ConfigFiles)')
    expect(service).toContain("x.ConfigFiles.map(String).join(',')")
  })
})
