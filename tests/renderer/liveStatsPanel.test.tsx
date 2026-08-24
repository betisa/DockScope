// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { LiveStatsPanel } from '../../src/renderer/src/components/LiveStatsPanel'

describe('LiveStatsPanel', () => {
  it('renders Docker stats JSON wrapped in ANSI control codes', async () => {
    let onData: ((chunk: string) => void) | undefined
    const stop = vi.fn()
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: {
        streams: {
          startContainerStats: vi.fn().mockResolvedValue({ sessionId: 'stats-1' }),
          onData: vi.fn((_sessionId: string, callback: (chunk: string) => void) => {
            onData = callback
            return vi.fn()
          }),
          onError: vi.fn(() => vi.fn()),
          onExit: vi.fn(() => vi.fn()),
          stop
        }
      }
    })

    render(<LiveStatsPanel containerId="abc123" />)
    await waitFor(() => expect(onData).toBeDefined())
    const stats = JSON.stringify({ CPUPerc: '12.50%', MemUsage: '450MiB / 1GiB', MemPerc: '43.95%', NetIO: '10MB / 4MB', BlockIO: '2MB / 1MB', PIDs: '18' })
    onData?.(`\u001b[H${stats}\u001b[K\u001b[J`)

    expect(await screen.findByText('12.50%')).toBeInTheDocument()
    expect(screen.getByText('450MiB / 1GiB')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('shows a stream startup error instead of staying blank', async () => {
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: {
        streams: {
          startContainerStats: vi.fn().mockRejectedValue(new Error('stats unavailable'))
        }
      }
    })

    render(<LiveStatsPanel containerId="abc123" />)

    expect(await screen.findByText(/Error: stats unavailable/)).toBeInTheDocument()
  })
})
