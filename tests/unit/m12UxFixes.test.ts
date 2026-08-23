import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('M12 UX fixes', () => {
  const app = readFileSync('src/renderer/src/App.tsx', 'utf8')
  const styles = readFileSync('src/renderer/src/styles.css', 'utf8')
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const volumeService = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const volumes = readFileSync('src/renderer/src/pages/VolumesPage.tsx', 'utf8')
  const pagination = readFileSync('src/renderer/src/hooks/usePaginatedSearch.ts', 'utf8')

  it('provides a draggable title-bar surface', () => {
    expect(app).toContain('window-drag-region')
    expect(styles).toContain('-webkit-app-region: drag')
  })

  it('uses resource-specific Hugeicons in sidebar resources', () => {
    expect(app).toContain('ContainerIcon')
    expect(app).toContain('Image01Icon')
    expect(app).toContain('Database01Icon')
    expect(app).toContain('Globe02Icon')
    expect(app).toContain('Layers01Icon')
  })

  it('exposes volume created time and disk size', () => {
    expect(contracts).toContain('createdAt: string')
    expect(contracts).toContain('size: string')
    expect(volumeService).toContain("['system', 'df', '-v']")
    expect(volumeService).toContain("['volume', 'inspect', ...names]")
    expect(volumes).toContain('<th>Created</th>')
    expect(volumes).toContain('<th>Size</th>')
  })

  it('standardizes static lists to 10 rows per page', () => {
    expect(pagination).toContain('pageSize = options.pageSize ?? 10')
    expect(pagination).toContain('filtered.slice(start, start + pageSize)')
  })
})
