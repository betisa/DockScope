import { useEffect, useState } from 'react'
import type { NetworkInfo } from '../../../shared/contracts'
import { ConfirmButton, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { PageTitle } from '../components/PageTitle'

export function NetworksPage({ filter }: { filter: string }) {
  const [rows, setRows] = useState<NetworkInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await window.dockerApi.networks.list())
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const list = usePaginatedSearch(
    rows,
    network => `${network.name} ${network.driver} ${network.scope} ${network.id}`,
    { pageSize: 10, initialQuery: filter }
  )

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle page="networks" title="Networks" subtitle="Docker network inventory and safe prune." />
        <div className="inline-actions">
          <button className="button secondary" onClick={load}>
            <AppIcon icon={RefreshIcon} />
            Refresh
          </button>
          <ConfirmButton
            message="Remove unused Docker networks?"
            onConfirm={async () => { await window.dockerApi.networks.prune(); await load() }}
          >
            Prune unused
          </ConfirmButton>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load networks">{error}</InlineAlert>}

      <section className="card table-card">
        <ListControls
          query={list.query}
          onQueryChange={list.setQuery}
          page={list.page}
          totalPages={list.totalPages}
          totalItems={list.totalItems}
          startItem={list.startItem}
          endItem={list.endItem}
          onPrevious={() => list.setPage(list.page - 1)}
          onNext={() => list.setPage(list.page + 1)}
          placeholder="Search networks…"
        />

        {loading ? (
          <LoadingState label="Loading networks" rows={7} />
        ) : !list.pageItems.length ? (
          <EmptyState title="No networks" text="No networks match this search." />
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Driver</th><th>Scope</th><th>ID</th></tr></thead>
            <tbody>
              {list.pageItems.map(network => (
                <tr key={network.id}>
                  <td><strong>{network.name}</strong></td>
                  <td>{network.driver}</td>
                  <td>{network.scope}</td>
                  <td className="mono">{network.id.slice(0, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
