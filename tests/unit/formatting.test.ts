import { describe, expect, it } from 'vitest'
import { formatUptime } from '../../src/shared/formatting'

describe('formatUptime', () => {
  const now = Date.parse('2026-08-24T12:00:00Z')

  it('formats running time across days, hours, minutes, and seconds', () => {
    expect(formatUptime('2026-08-22T09:30:25Z', true, now)).toBe('2d 2h')
    expect(formatUptime('2026-08-24T09:45:10Z', true, now)).toBe('2h 14m')
    expect(formatUptime('2026-08-24T11:58:35Z', true, now)).toBe('1m 25s')
    expect(formatUptime('2026-08-24T11:59:58Z', true, now)).toBe('2s')
  })

  it('does not show uptime for stopped or invalid containers', () => {
    expect(formatUptime('2026-08-24T11:00:00Z', false, now)).toBe('—')
    expect(formatUptime('not-a-date', true, now)).toBe('—')
  })
})
