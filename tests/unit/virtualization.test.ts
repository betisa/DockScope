import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('large resource list protection', () => {
  const hook = readFileSync('src/renderer/src/hooks/useVirtualTable.ts', 'utf8')
  const containers = readFileSync('src/renderer/src/pages/ContainersPage.tsx', 'utf8')
  const images = readFileSync('src/renderer/src/pages/ImagesPage.tsx', 'utf8')

  it('enables virtualization at 100 rows by default', () => {
    expect(hook).toContain('enabledAt ?? 100')
  })

  it('virtualizes container and image inventories', () => {
    expect(containers).toContain('<VirtualTable')
    expect(images).toContain('<VirtualTable')
  })

  it('uses deferred filtering for large inventories', () => {
    expect(containers).toContain('useDeferredValue')
    expect(images).toContain('useDeferredValue')
  })
})
