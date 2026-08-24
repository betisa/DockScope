// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { ComposeLiveStatsPanel } from '../../src/renderer/src/components/ComposeLiveStatsPanel'

const project = { name: 'demo', status: 'running', configFiles: 'compose.yml' }

describe('ComposeLiveStatsPanel', () => {
  it('renders Compose stats JSON wrapped in ANSI control codes', async () => {
    let onData: ((chunk: string) => void) | undefined
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: {
        streams: {
          startComposeStats: vi.fn().mockResolvedValue({ sessionId: 'compose-stats-1' }),
          onData: vi.fn((_sessionId: string, callback: (chunk: string) => void) => {
            onData = callback
            return vi.fn()
          }),
          onError: vi.fn(() => vi.fn()),
          onExit: vi.fn(() => vi.fn()),
          stop: vi.fn()
        }
      }
    })

    render(<ComposeLiveStatsPanel project={project} services={[]} />)
    await waitFor(() => expect(onData).toBeDefined())

    const stats = JSON.stringify({ Name: 'demo-api-1', CPUPerc: '12.50%', MemUsage: '450MiB / 1GiB', MemPerc: '43.95%', NetIO: '10MB / 4MB', BlockIO: '2MB / 1MB', PIDs: '18' })
    onData?.(`\u001b[H${stats}\u001b[K\u001b[J`)

    expect(await screen.findByText('demo-api-1')).toBeInTheDocument()
    expect(screen.getByText('12.50%')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('shows a stream startup error instead of staying blank', async () => {
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: { streams: { startComposeStats: vi.fn().mockRejectedValue(new Error('compose stats unavailable')) } }
    })

    render(<ComposeLiveStatsPanel project={project} services={[]} />)

    expect(await screen.findByText(/Error: compose stats unavailable/)).toBeInTheDocument()
  })
})
