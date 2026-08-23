import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Colored Container / Compose workspace logs', () => {
  const renderer=readFileSync('src/renderer/src/components/ColoredLogConsole.tsx','utf8')
  const container=readFileSync('src/renderer/src/components/LiveLogsPanel.tsx','utf8')
  const compose=readFileSync('src/renderer/src/components/ComposeLiveLogsPanel.tsx','utf8')
  const styles=readFileSync('src/renderer/src/styles.css','utf8')

  it('uses the shared colored console in both workspaces',()=>{
    expect(container).toContain("import { ColoredLogConsole }")
    expect(compose).toContain("import { ColoredLogConsole }")
    expect(container).toContain('ariaLabel="Live container logs output"')
    expect(compose).toContain('ariaLabel="Live Compose logs output"')
    expect(compose).toContain('compose')
  })

  it('classifies common severity levels',()=>{
    expect(renderer).toContain("'error'")
    expect(renderer).toContain("'warn'")
    expect(renderer).toContain("'info'")
    expect(renderer).toContain("'debug'")
    expect(renderer).toContain("'trace'")
    expect(renderer).toContain('FATAL|CRITICAL|PANIC|ERROR|ERR')
  })

  it('highlights timestamps, HTTP statuses and exception markers',()=>{
    expect(renderer).toContain('log-token-timestamp')
    expect(renderer).toContain('log-token-http')
    expect(renderer).toContain('log-token-exception')
    expect(renderer).toContain('log-token-stderr')
  })

  it('colors Compose service prefixes consistently',()=>{
    expect(renderer).toContain('composePrefixPattern')
    expect(renderer).toContain('hashBucket(prefix)')
    expect(styles).toContain('.log-service-0')
    expect(styles).toContain('.log-service-5')
  })

  it('does not inject log text as HTML',()=>{
    expect(renderer).not.toContain('dangerouslySetInnerHTML')
    expect(renderer).not.toContain('innerHTML')
  })

  it('does not rely only on color for severity',()=>{
    expect(styles).toContain('border-left-color:var(--red)')
    expect(styles).toContain('font-weight:800')
    expect(container).toContain('Log color legend')
    expect(compose).toContain('Log color legend')
  })
})
