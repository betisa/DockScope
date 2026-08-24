export function formatUptime(startedAt: string, running: boolean, now = Date.now()): string {
  if (!running || !startedAt) return '—'

  const start = Date.parse(startedAt)
  if (!Number.isFinite(start) || start > now) return '—'

  const totalSeconds = Math.floor((now - start) / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
