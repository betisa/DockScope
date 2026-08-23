import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('large resource list protection', () => {
  const hook = readFileSync('src/renderer/src/hooks/useVirtualTable.ts', 'utf8')
  const containers = readFileSync('src/renderer/src/pages/ContainersPage.tsx', 'utf8')
  const images = readFileSync('src/renderer/src/pages/ImagesPage.tsx', 'utf8')
  const pagination = readFileSync('src/renderer/src/hooks/usePaginatedSearch.ts', 'utf8')

  it('enables virtualization at 100 rows by default', () => {
    expect(hook).toContain('enabledAt ?? 100')
  })

  it('virtualizes the container inventory and bounds the unified Images inventory with pagination', () => {
    expect(containers).toContain('<VirtualTable')
    expect(images).not.toContain('<VirtualTable')
    expect(images).toContain('usePaginatedSearch')
    expect(pagination).toContain('pageSize = options.pageSize ?? 10')
  })

  it('uses deferred filtering for the large virtualized container inventory', () => {
    expect(containers).toContain('useDeferredValue')
    expect(images).toContain('usePaginatedSearch')
  })
})
