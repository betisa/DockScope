// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { ContainerInfo } from '../../src/shared/contracts'
import { ContainerWorkspace } from '../../src/renderer/src/components/ContainerWorkspace'

const container: ContainerInfo = {
  id: 'abc123',
  name: 'api',
  image: 'my-api:latest',
  state: 'running',
  startedAt: '2026-08-21T11:00:00Z',
  status: 'Up 3 minutes',
  ports: '0.0.0.0:8080->8080/tcp',
  size: '10MB'
}

describe('ContainerWorkspace', () => {
  it('shows container summary and a useful error when diagnostics cannot load', async () => {
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: {
        containers: {
          diagnostics: vi.fn().mockRejectedValue(new Error('Docker inspect failed'))
        }
      }
    })

    render(<ContainerWorkspace container={container} initialTab="overview" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Could not load container details')).toBeInTheDocument())
    expect(screen.getByText('Docker inspect failed')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getAllByText('my-api:latest')).toHaveLength(2)
  })
})
