import { readFileSync } from 'node:fs'

const allowedTypes = [
  'feat','fix','docs','refactor','perf','test','build','ci','chore','style','security','revert'
]

function validate(message) {
  const header = String(message ?? '').split(/\r?\n/, 1)[0].trim()

  if (!header) return 'Commit message is empty.'
  if (/^Merge\b/.test(header)) return null
  if (/^Revert\b/.test(header)) return null
  if (header.length > 100) return 'Commit header must be 100 characters or fewer.'

  const match = header.match(/^([a-z]+)(?:\(([a-z0-9._/-]+)\))?(!)?: (.+)$/)
  if (!match) {
    return 'Use Conventional Commits: type(optional-scope): summary'
  }

  const [, type,, , summary] = match
  if (!allowedTypes.includes(type)) {
    return `Unsupported commit type "${type}". Allowed: ${allowedTypes.join(', ')}`
  }
  if (!summary || summary.length < 3) return 'Commit summary is too short.'
  if (summary.endsWith('.')) return 'Commit summary should not end with a period.'

  return null
}

const arg = process.argv[2]
let message = ''

if (arg === '--message') {
  message = process.argv.slice(3).join(' ')
} else if (arg) {
  message = readFileSync(arg, 'utf8')
} else {
  console.error('Usage: node scripts/validate-commit-message.mjs <commit-msg-file>')
  console.error('   or: node scripts/validate-commit-message.mjs --message "fix(scope): summary"')
  process.exit(2)
}

const error = validate(message)
if (error) {
  console.error(`Invalid commit message: ${error}`)
  process.exit(1)
}

console.log('Commit message is valid.')
