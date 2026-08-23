import { existsSync, readFileSync } from 'node:fs'

const requiredFiles = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'SUPPORT.md',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/CODEOWNERS',
  '.github/workflows/ci.yml',
  '.github/workflows/repository-policy.yml',
  '.github/workflows/release.yml',
  'docs/GIT-WORKFLOW.md',
  'docs/RELEASE-PROCESS.md',
  'docs/GITHUB-SETUP.md',
  'electron-builder.github.cjs'
]

const missing = requiredFiles.filter(file => !existsSync(file))
if (missing.length) {
  console.error('Repository policy files missing:')
  for (const file of missing) console.error(`- ${file}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json','utf8'))
if (pkg.name !== 'dockscope-desktop') throw new Error('Unexpected package name.')
if (pkg.license !== 'MIT') throw new Error('package.json license must be MIT.')
if (!String(pkg.repository?.url ?? '').includes('github.com/mohikan1986/DockScope')) {
  throw new Error('package.json repository URL does not target DockScope.')
}

const updater = readFileSync('electron-builder.github.cjs','utf8')
for (const expected of ["provider: 'github'","owner: 'mohikan1986'","repo: 'DockScope'"]) {
  if (!updater.includes(expected)) throw new Error(`GitHub updater config missing: ${expected}`)
}

const mainUpdater = readFileSync('src/main/services/updateService.ts','utf8')
if (/autoUpdater\.setFeedURL\s*\(/.test(mainUpdater)) {
  throw new Error('Updater must use electron-builder app-update.yml instead of runtime setFeedURL.')
}

console.log('Repository policy check passed.')
