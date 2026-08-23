import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(directory: string): string[] {
  const rows: string[] = []
  for (const name of readdirSync(directory)) {
    const full = join(directory, name)
    if (statSync(full).isDirectory()) rows.push(...walk(full))
    else if (full.endsWith('.tsx')) rows.push(full)
  }
  return rows
}

describe('Switch import regression', () => {
  it('imports Switch in every TSX file that renders <Switch>', () => {
    const failures: string[] = []

    for (const file of walk('src/renderer/src')) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes('<Switch')) continue

      const importsSwitch =
        /import\s*\{[^}]*\bSwitch\b[^}]*\}\s*from\s*['"][^'"]*\/ui['"]/.test(source)

      if (!importsSwitch) failures.push(relative('.', file))
    }

    expect(failures).toEqual([])
  })
})
