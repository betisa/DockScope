import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Dashboard charts', () => {
  const dashboard = readFileSync('src/renderer/src/pages/DashboardPage.tsx', 'utf8')
  const charts = readFileSync('src/renderer/src/components/DashboardCharts.tsx', 'utf8')

  it('loads storage and container data for dashboard visualization', () => {
    expect(dashboard).toContain('window.dockerApi.disk.usage()')
    expect(dashboard).toContain('window.dockerApi.containers.list()')
    expect(dashboard).toContain('<StorageUsageChart')
    expect(dashboard).toContain('<ContainerStateChart')
  })

  it('uses only real Docker data and no illustrative chart constants', () => {
    expect(charts).toContain('usage.map')
    expect(charts).toContain('for (const container of containers)')
    expect(charts).not.toContain('Math.random')
  })

  it('provides accessible text for visual charts', () => {
    expect(charts).toContain('aria-label="Docker storage usage chart"')
    expect(charts).toContain('aria-label={`${containers.length} containers:')
    expect(charts).toContain('role="img"')
  })

  it('does not add a heavyweight chart dependency', () => {
    expect(charts).not.toContain('recharts')
    expect(charts).not.toContain('chart.js')
    expect(charts).not.toContain('echarts')
  })
})
