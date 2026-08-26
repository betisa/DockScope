// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { ContainerDiagnostics, ContainerInfo } from '../../src/shared/contracts'
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

const healthyDiagnostics: ContainerDiagnostics = {
  id:'abc123', name:'api', image:'my-api:latest', platform:'linux', created:'2026-08-21T10:00:00Z', startedAt:'2026-08-21T11:00:00Z', finishedAt:'', state:'running', status:'Running', exitCode:0, oomKilled:false, restartCount:0, stateError:'', restartPolicy:'unless-stopped', command:['dotnet','Api.dll'], entrypoint:[], workingDir:'/app',
  health:{ configured:true, status:'healthy', failingStreak:0, test:['CMD','curl','-f','http://localhost:8080/health'], retries:3, timeout:5000000000, logs:[] },
  ports:[], mounts:[], networks:[], environment:[], labels:{}
}

describe('ContainerWorkspace', () => {
  it('renders the health tab as a runtime report with status history and probe details', async () => {
    const diagnostics: ContainerDiagnostics = {
      id:'abc123', name:'api', image:'my-api:latest', platform:'linux', created:'2026-08-21T10:00:00Z', startedAt:'2026-08-21T11:00:00Z', finishedAt:'', state:'running', status:'Running', exitCode:0, oomKilled:false, restartCount:0, stateError:'', restartPolicy:'unless-stopped', command:['dotnet','Api.dll'], entrypoint:[], workingDir:'/app',
      health:{ configured:true, status:'healthy', failingStreak:0, test:['CMD','curl','-f','http://localhost:8080/health'], retries:3, timeout:5000000000, logs:[
        { start:'2026-08-26T10:00:00Z', end:'2026-08-26T10:00:01Z', exitCode:0, output:'ok' },
        { start:'2026-08-26T10:01:00Z', end:'2026-08-26T10:01:01Z', exitCode:1, output:'health endpoint timed out' }
      ] },
      ports:[], mounts:[], networks:[], environment:[], labels:{}
    }
    Object.defineProperty(window, 'dockerApi', {
      configurable:true,
      value:{ containers:{ diagnostics:vi.fn().mockResolvedValue(diagnostics) } }
    })

    render(<ContainerWorkspace container={container} initialTab="health" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Runtime health')).toBeInTheDocument())
    expect(screen.getAllByText('Healthy')).toHaveLength(2)
    expect(screen.getByText('Recent Docker probe results')).toBeInTheDocument()
    expect(screen.getByText('Passing checks')).toBeInTheDocument()
    expect(screen.getByText('health endpoint timed out')).toBeInTheDocument()
  })

  it('opens Stats by default for a running container', async () => {
    let onData: ((chunk: string) => void) | undefined
    Object.defineProperty(window, 'dockerApi', {
      configurable:true,
      value:{
        containers:{ diagnostics:vi.fn().mockResolvedValue(healthyDiagnostics) },
        streams:{
          startContainerStats:vi.fn().mockResolvedValue({ sessionId:'workspace-stats' }),
          onData:vi.fn((_id:string, callback:(chunk:string)=>void) => { onData = callback; return vi.fn() }),
          onError:vi.fn(() => vi.fn()),
          onExit:vi.fn(() => vi.fn()),
          stop:vi.fn()
        }
      }
    })

    render(<ContainerWorkspace container={container} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('CPU usage')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name:'Stats' })).toHaveAttribute('aria-selected', 'true')
    expect(onData).toBeDefined()
  })

  it('opens Advisor by default when the container has a runtime failure', async () => {
    const failedDiagnostics: ContainerDiagnostics = { ...healthyDiagnostics, state:'exited', status:'Exited (139)', exitCode:139 }
    Object.defineProperty(window, 'dockerApi', {
      configurable:true,
      value:{
        containers:{
          diagnostics:vi.fn().mockResolvedValue(failedDiagnostics),
          advisor:vi.fn().mockResolvedValue({ diagnostics:failedDiagnostics, status:'critical', summary:'Container exited unexpectedly.', findings:[], logsSampled:0 })
        },
        ai:{ settings:vi.fn().mockResolvedValue(null) }
      }
    })

    render(<ContainerWorkspace container={{ ...container, state:'exited', status:'Exited (139)' }} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('tab', { name:'Advisor' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByText('No known failure patterns')).toBeInTheDocument()
  })

  it('shows container summary and a useful error when diagnostics cannot load', async () => {
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: {
        containers: {
          diagnostics: vi.fn().mockRejectedValue(new Error('Docker inspect failed'))
        },
        streams: {
          startContainerStats: vi.fn().mockRejectedValue(new Error('stats unavailable'))
        }
      }
    })

    render(<ContainerWorkspace container={container} initialTab="overview" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Could not load container details')).toBeInTheDocument())
    expect(screen.getByText('Docker inspect failed')).toBeInTheDocument()
    expect(screen.getAllByText('running')).toHaveLength(2)
    expect(screen.getAllByText('my-api:latest')).toHaveLength(3)
  })

  it('renders the workspace as a modal and closes on Escape', () => {
    const onClose = vi.fn()
    Object.defineProperty(window, 'dockerApi', {
      configurable: true,
      value: { containers: { diagnostics: vi.fn().mockResolvedValue(healthyDiagnostics) } }
    })

    render(<ContainerWorkspace container={container} initialTab="health" onClose={onClose} />)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
