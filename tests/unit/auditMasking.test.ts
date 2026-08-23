import { describe, expect, it } from 'vitest'
import { maskEnv, maskKey, parseBytes } from '../../src/main/services/auditService'

describe('audit secret masking', () => {
  it('recognizes sensitive keys', () => {
    expect(maskKey('OPENAI_API_KEY')).toBe(true)
    expect(maskKey('POSTGRES_PASSWORD')).toBe(true)
    expect(maskKey('MODE')).toBe(false)
  })

  it('masks only sensitive environment values', () => {
    expect(maskEnv(['PASSWORD=abc', 'MODE=Development'])).toEqual([
      'PASSWORD=••••••••',
      'MODE=Development'
    ])
  })

  it('parses human byte values', () => {
    expect(parseBytes('1 GB')).toBe(1_000_000_000)
    expect(parseBytes('1 GiB')).toBe(1_073_741_824)
  })
})
