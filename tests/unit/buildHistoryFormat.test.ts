import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Buildx history format compatibility', () => {
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/BuildKitPage.tsx', 'utf8')

  it('supports Docker Desktop snake_case build-history fields', () => {
    expect(service).toContain("'created_at', 'CreatedAt'")
    expect(service).toContain("'completed_at', 'CompletedAt'")
    expect(service).toContain("'cached_steps', 'CachedSteps', 'NumCachedSteps'")
    expect(service).toContain("'completed_steps', 'CompletedSteps', 'NumCompletedSteps'")
    expect(service).toContain("'total_steps', 'TotalSteps', 'NumTotalSteps'")
    expect(service).toContain("buildIdFromRef(ref)")
  })

  it('shows steps and cached progress instead of a non-existent repository column', () => {
    expect(page).toContain('<th>Steps</th>')
    expect(page).toContain('<th>Cached</th>')
    expect(page).not.toContain('<th>Repository</th>')
    expect(page).toContain('formatCached(build.cachedSteps, build.totalSteps)')
  })
})
