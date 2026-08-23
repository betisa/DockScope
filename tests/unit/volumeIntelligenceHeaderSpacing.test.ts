import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Volume Intelligence card header spacing', () => {
  const styles = readFileSync('src/renderer/src/styles.css','utf8')
  const workspace = readFileSync('src/renderer/src/components/VolumeIntelligenceWorkspace.tsx','utf8')

  it('keeps the generic compact section rule but overrides it only inside Volume Intelligence', () => {
    expect(styles).toContain('.section-row.compact { padding:4px 0 12px; }')
    expect(styles).toContain('.volume-intelligence-section > .section-row.compact')
    expect(styles).toContain('padding:13px 16px 12px')
  })

  it('aligns title and badge/action content in card headers', () => {
    expect(styles).toContain('min-height:58px')
    expect(styles).toContain('align-items:center')
    expect(styles).toContain('flex:0 0 auto')
  })

  it('uses tighter but non-zero padding for nested workload cards', () => {
    expect(workspace).toContain('className="volume-workload"')
    expect(styles).toContain('.volume-workload > .section-row.compact')
    expect(styles).toContain('padding:10px 12px')
  })

  it('has a mobile-specific header spacing rule', () => {
    expect(styles).toContain('@media (max-width:650px)')
    expect(styles).toContain('padding:12px 13px')
  })
})
