import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

describe('Switch and Empty State design system', () => {
  const rendererFiles = walk('src/renderer/src').filter(file => file.endsWith('.tsx'))
  const rendererSource = rendererFiles.map(file => readFileSync(file, 'utf8')).join('\n')
  const ui = readFileSync('src/renderer/src/components/ui.tsx', 'utf8')

  it('does not render raw checkbox inputs anywhere in renderer TSX', () => {
    expect(rendererSource).not.toContain('type="checkbox"')
  })

  it('uses an accessible role=switch control', () => {
    expect(ui).toContain('role="switch"')
    expect(ui).toContain('aria-checked={checked}')
  })

  it('renders an icon for every EmptyState through a default icon resolver', () => {
    expect(ui).toContain('inferEmptyStateIcon(title)')
    expect(ui).toContain('<AppIcon icon={resolvedIcon}')
    expect(ui).toContain('className="empty-icon"')
  })

  it('maps common empty resource types to contextual Hugeicons', () => {
    expect(ui).toContain('ContainerIcon')
    expect(ui).toContain('Image01Icon')
    expect(ui).toContain('Database01Icon')
    expect(ui).toContain('Globe02Icon')
    expect(ui).toContain('Layers01Icon')
  })
})
