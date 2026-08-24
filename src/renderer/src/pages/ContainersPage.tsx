import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { ContainerInfo } from '../../../shared/contracts'
import { formatUptime } from '../../../shared/formatting'
import { Badge, ConfirmButton, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { ContainerWorkspace } from '../components/ContainerWorkspace'
import { VirtualTable } from '../components/VirtualTable'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { PageTitle } from '../components/PageTitle'

export function ContainersPage({ filter }: { filter: string }) {
  const [rows, setRows] = useState<ContainerInfo[]>([])
  const [selected, setSelected] = useState<ContainerInfo | null>(null)
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const deferredFilter = useDeferredValue(filter)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await window.dockerApi.containers.list()
      setRows(data)
      if (selected) setSelected(data.find(x => x.id === selected.id) ?? null)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const data = await window.dockerApi.containers.list()
        setRows(data)
        try {
          const raw = sessionStorage.getItem('dsm.m08.intent')
          const intent = raw ? JSON.parse(raw) : null
          if (intent?.page === 'containers') {
            const match = data.find(x =>
              (intent.resourceId && x.id === intent.resourceId) ||
              (intent.resourceName && x.name === intent.resourceName)
            )
            if (match) {
              setSelected(match)
              setWorkspaceInitialTab(typeof intent.tab === 'string' ? intent.tab : 'advisor')
            }
            sessionStorage.removeItem('dsm.m08.intent')
          }
        } catch {
          sessionStorage.removeItem('dsm.m08.intent')
        }
      } catch (value) {
        setError(value instanceof Error ? value.message : String(value))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const visible = useMemo(() => {
    const query = deferredFilter.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(row => `${row.name} ${row.image} ${row.state} ${row.status} ${row.ports}`.toLowerCase().includes(query))
  }, [rows, deferredFilter])

  const action = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle page="containers" title="Containers" subtitle={`${rows.filter(x => x.state === 'running').length} running · ${rows.length} total · select a row to open Runtime & Diagnostics`} />
        <button className="button secondary" onClick={load}>
          <AppIcon icon={RefreshIcon} />
          Refresh
        </button>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load containers">{error}</InlineAlert>}

      <section className="card table-card">
        {loading ? (
          <LoadingState label="Loading containers" rows={7} />
        ) : !visible.length ? (
          <EmptyState title="No containers" text="No containers match the current view." />
        ) : (
          <VirtualTable
            items={visible}
            ariaLabel="Docker containers"
            headers={['Name', 'State', 'Uptime', 'Image', 'Ports', 'Size', 'Actions']}
            rowKey={container => container.id}
            renderRow={container => (
              <tr
                className={selected?.id === container.id ? 'selected-row' : ''}
                onClick={() => {
                  setWorkspaceInitialTab(undefined)
                  setSelected(container)
                }}
              >
                <td><strong>{container.name}</strong></td>
                <td><Badge tone={container.state === 'running' ? 'ok' : 'neutral'}>{container.state}</Badge></td>
                <td>{formatUptime(container.startedAt, container.state === 'running', now)}</td>
                <td className="mono wrap">{container.image}</td>
                <td className="muted wrap">{container.ports || '—'}</td>
                <td>{container.size || '—'}</td>
                <td className="row-actions" onClick={event => event.stopPropagation()}>
                  {container.state === 'running' ? (
                    <div className="inline-actions">
                      <ConfirmButton
                        message={`Stop ${container.name}?`}
                        onConfirm={() => action(() => window.dockerApi.containers.stop([container.id], 10))}
                      >
                        Stop
                      </ConfirmButton>
                      <button
                        className="button secondary"
                        onClick={() => action(() => window.dockerApi.containers.restart([container.id]))}
                      >
                        Restart
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button secondary"
                      onClick={() => action(() => window.dockerApi.containers.start([container.id]))}
                    >
                      Start
                    </button>
                  )}
                </td>
              </tr>
            )}
          />
        )}
      </section>

      {selected && (
        <ContainerWorkspace
          container={selected}
          initialTab={workspaceInitialTab}
          onClose={() => {
            setSelected(null)
            setWorkspaceInitialTab(undefined)
          }}
        />
      )}
    </div>
  )
}
