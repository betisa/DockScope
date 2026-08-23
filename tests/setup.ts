import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.DSM_DOCKER_MOCK_SCRIPT
  delete process.env.DSM_MOCK_SCENARIO
})
