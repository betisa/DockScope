import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const roots = [
  { path: 'out/renderer', limit: 14 * 1024 * 1024, label: 'Renderer output' },
  { path: 'out/main', limit: 5 * 1024 * 1024, label: 'Main output' },
  { path: 'out/preload', limit: 3 * 1024 * 1024, label: 'Preload output' }
]

function sizeOf(target) {
  if (!existsSync(target)) return 0
  const stat = statSync(target)
  if (stat.isFile()) return stat.size
  return readdirSync(target).reduce((sum, entry) => sum + sizeOf(path.join(target, entry)), 0)
}

let failed = false
for (const root of roots) {
  const size = sizeOf(root.path)
  if (!size) {
    console.error(`${root.label}: output missing (${root.path}). Run npm run build first.`)
    failed = true
    continue
  }

  const mib = (size / 1024 / 1024).toFixed(2)
  const budget = (root.limit / 1024 / 1024).toFixed(0)
  console.log(`${root.label}: ${mib} MiB / ${budget} MiB budget`)

  if (size > root.limit) {
    console.error(`${root.label} exceeds the GA bundle budget.`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('GA bundle budgets passed.')
