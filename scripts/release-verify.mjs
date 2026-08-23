import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const required = [
  'package.json',
  'electron.vite.config.ts',
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'docs/SECURITY-REVIEW.md',
  'docs/RELEASE-CHECKLIST.md'
]

const missing = required.filter(x => !existsSync(x))
if (missing.length) {
  console.error('Missing release files:', missing.join(', '))
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
if (pkg.private !== true) {
  console.error('package.json must remain private to prevent accidental npm publish.')
  process.exit(1)
}
if (!pkg.build?.asar) {
  console.error('ASAR packaging must be enabled.')
  process.exit(1)
}
if (!pkg.build?.asarUnpack?.some(x => x.includes('node-pty'))) {
  console.error('node-pty must be unpacked from ASAR.')
  process.exit(1)
}

const commands = [
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'test']],
  ['npm', ['run', 'build']]
]

for (const [cmd, args] of commands) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
}

console.log('Release verification passed.')
