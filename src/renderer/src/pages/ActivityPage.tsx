import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../components/Icon'
import { Delete02Icon } from '@hugeicons/core-free-icons'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { PageTitle } from '../components/PageTitle'

interface DockerEvent {
  Type?: string
  Action?: string
  status?: string
  id?: string
  from?: string
  Actor?: { Attributes?: Record<string, string> }
  time?: number
  timeNano?: number
}

export function ActivityPage() {
  const [events, setEvents] = useState<DockerEvent[]>([])
  const [type, setType] = useState('')
  const [state, setState] = useState('Connecting…')
  const pending = useRef<DockerEvent[]>([])

  useEffect(() => {
    let disposed = false
    let localId: string | null = null
    let buffer = ''
    let unsubs: Array<() => void> = []

    const flush = window.setInterval(() => {
      if (!pending.current.length) return
      const batch = pending.current
      pending.current = []
      setEvents(old => [...batch.reverse(), ...old].slice(0, 500))
    }, 200)

    void window.dockerApi.streams.startDockerEvents(type || undefined).then(({ sessionId }) => {
      if (disposed) {
        void window.dockerApi.streams.stop(sessionId)
        return
      }

      localId = sessionId
      setState('Live · Esc to stop')

      unsubs = [
        window.dockerApi.streams.onData(sessionId, chunk => {
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            try {
              pending.current.push(JSON.parse(line) as DockerEvent)
            } catch { /* incomplete or unsupported event */ }
          }
        }),
        window.dockerApi.streams.onError(sessionId, value => setState(`Error: ${value}`)),
        window.dockerApi.streams.onExit(sessionId, () => setState('Stopped'))
      ]
    }).catch(error => setState(`Error: ${error instanceof Error ? error.message : String(error)}`))

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && localId) void window.dockerApi.streams.stop(localId)
    }

    window.addEventListener('keydown', onKey)

    return () => {
      disposed = true
      window.clearInterval(flush)
      window.removeEventListener('keydown', onKey)
      unsubs.forEach(unsub => unsub())
      if (localId) void window.dockerApi.streams.stop(localId)
    }
  }, [type])

  const list = usePaginatedSearch(
    events,
    event => `${event.Type ?? ''} ${event.Action ?? event.status ?? ''} ${event.Actor?.Attributes?.name ?? ''} ${event.from ?? ''} ${event.id ?? ''}`,
    { pageSize: 10 }
  )

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle page="activity" title="Docker Activity" subtitle="Real-time daemon events for containers, images, volumes and networks." />
        <div className="inline-actions">
          <label>
            <span className="sr-only">Filter event type</span>
            <select value={type} onChange={event => setType(event.target.value)}>
              <option value="">All types</option>
              <option>container</option>
              <option>image</option>
              <option>volume</option>
              <option>network</option>
              <option>daemon</option>
            </select>
          </label>
          <button className="button secondary" onClick={() => setEvents([])}>
            <AppIcon icon={Delete02Icon} />
            Clear
          </button>
        </div>
      </div>

      <div className="stream-state activity-state" role="status">● {state}</div>

      <section className="card event-list" aria-label="Docker event stream">
        <ListControls
          query={list.query} onQueryChange={list.setQuery}
          page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
          startItem={list.startItem} endItem={list.endItem}
          onPrevious={() => list.setPage(list.page - 1)}
          onNext={() => list.setPage(list.page + 1)}
          placeholder="Search Docker events…"
        />

        {!list.pageItems.length ? (
          <div className="empty">Waiting for Docker events…</div>
        ) : list.pageItems.map((event, index) => (
          <div className="event-row" key={`${event.timeNano ?? event.time}-${list.startItem + index}`}>
            <div className={`event-dot event-${event.Action ?? event.status ?? ''}`} aria-hidden="true" />
            <div>
              <strong>{event.Type ?? 'event'} · {event.Action ?? event.status ?? 'unknown'}</strong>
              <span>{event.Actor?.Attributes?.name || event.from || event.id?.slice(0, 12) || '—'}</span>
            </div>
            <time dateTime={event.time ? new Date(event.time * 1000).toISOString() : undefined}>
              {event.time ? new Date(event.time * 1000).toLocaleTimeString() : 'now'}
            </time>
          </div>
        ))}
      </section>
    </div>
  )
}
