import { useEffect, useState } from 'react'
import type { ProductivityHistoryEntry, RecentResource } from '../productivity/model'
import { productivityStorage } from '../productivity/storage'
import { Badge, EmptyState } from '../components/ui'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { PageTitle } from '../components/PageTitle'

export function ProductivityPage({ onOpen }:{onOpen:(page:string)=>void}) {
  const [history, setHistory] = useState<ProductivityHistoryEntry[]>([])
  const [recents, setRecents] = useState<RecentResource[]>([])
  const load = async () => {
    const [historyRows, recentRows] = await Promise.all([
      productivityStorage.history(),
      productivityStorage.recents()
    ])
    setHistory(historyRows)
    setRecents(recentRows)
  }
  useEffect(() => { void load() }, [])

  const recentList = usePaginatedSearch(
    recents,
    item => `${item.title} ${item.subtitle} ${item.kind} ${item.page}`,
    { pageSize: 10 }
  )
  const historyList = usePaginatedSearch(
    history,
    item => `${item.title} ${item.subtitle} ${item.resourceName ?? ''} ${item.kind} ${item.message} ${item.executedAt}`,
    { pageSize: 10 }
  )

  return <div className="page">
    <div className="page-heading">
      <PageTitle page="productivity" title="Productivity" subtitle="Recent resources, command activity and keyboard-first navigation." />
      <div className="inline-actions">
        <button className="button secondary" onClick={() => void load()}>Refresh</button>
        <button className="button danger" onClick={() => { void productivityStorage.clearHistory().then(() => load()) }}>Clear action history</button>
      </div>
    </div>

    <div className="productivity-grid">
      <section className="card">
        <div className="section-row"><div><div className="eyebrow">Recent resources</div><h2>Jump back in</h2></div><kbd>Ctrl K</kbd></div>
        <ListControls
          query={recentList.query} onQueryChange={recentList.setQuery}
          page={recentList.page} totalPages={recentList.totalPages} totalItems={recentList.totalItems}
          startItem={recentList.startItem} endItem={recentList.endItem}
          onPrevious={() => recentList.setPage(recentList.page - 1)}
          onNext={() => recentList.setPage(recentList.page + 1)}
          placeholder="Search recent resources…"
        />
        {!recentList.pageItems.length ? <EmptyState title="No recent resources" text="Open a resource from the Command Palette and it will appear here." /> :
          <div className="recent-list">{recentList.pageItems.map(item => <button className="recent-row" key={item.id} onClick={() => onOpen(item.page)}>
            <div><strong>{item.title}</strong><span>{item.subtitle}</span></div><Badge tone="neutral">{item.kind}</Badge>
          </button>)}</div>}
      </section>

      <section className="card">
        <div className="section-row"><div><div className="eyebrow">Keyboard</div><h2>Shortcuts</h2></div></div>
        <div className="shortcut-list">
          <Shortcut keys="Ctrl + K" label="Open command palette" />
          <Shortcut keys="Ctrl + R" label="Refresh current workspace" />
          <Shortcut keys="Ctrl + Shift + P" label="Open command palette" />
          <Shortcut keys="Esc" label="Close palette / overlays" />
        </div>
      </section>
    </div>

    <section className="card table-card" style={{ marginTop: 16 }}>
      <div className="section-row"><div><div className="eyebrow">Audit-lite</div><h2>Action history</h2></div></div>
      <ListControls
        query={historyList.query} onQueryChange={historyList.setQuery}
        page={historyList.page} totalPages={historyList.totalPages} totalItems={historyList.totalItems}
        startItem={historyList.startItem} endItem={historyList.endItem}
        onPrevious={() => historyList.setPage(historyList.page - 1)}
        onNext={() => historyList.setPage(historyList.page + 1)}
        placeholder="Search action history…"
      />
      {!historyList.pageItems.length ? <EmptyState title="No command activity" text="Quick actions executed from the Command Palette are recorded locally." /> :
        <table><thead><tr><th>Time</th><th>Action</th><th>Resource</th><th>Result</th><th>Message</th></tr></thead>
          <tbody>{historyList.pageItems.map(item => <tr key={item.id}>
            <td>{new Date(item.executedAt).toLocaleString()}</td><td><strong>{item.title}</strong></td>
            <td>{item.resourceName || item.kind}</td><td><Badge tone={item.ok ? 'ok' : 'danger'}>{item.ok ? 'Success' : 'Failed'}</Badge></td>
            <td className="muted wrap">{item.message || '—'}</td>
          </tr>)}</tbody></table>}
    </section>
  </div>
}
function Shortcut({ keys, label }: { keys: string; label: string }) {
  return <div className="shortcut-row"><kbd>{keys}</kbd><span>{label}</span></div>
}
