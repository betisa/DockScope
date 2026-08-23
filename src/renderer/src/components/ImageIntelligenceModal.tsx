import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImageHistoryLayer, ImageInfo, ImageInsight } from '../../../shared/contracts'
import { Badge, EmptyState, InlineAlert, LoadingState } from './ui'
import { ListControls } from './ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'

export function ImageIntelligenceModal({
  image,
  open,
  onClose
}: {
  image: ImageInfo | null
  open: boolean
  onClose: () => void
}) {
  const [history, setHistory] = useState<ImageHistoryLayer[]>([])
  const [insight, setInsight] = useState<ImageInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const layerList = usePaginatedSearch(
    history,
    layer => `${layer.id} ${layer.createdSince} ${layer.size} ${layer.createdBy} ${layer.comment}`,
    { pageSize: 10 }
  )

  const load = async () => {
    if (!image) return
    setLoading(true)
    setError('')
    setHistory([])
    setInsight(null)
    layerList.setQuery('')
    layerList.setPage(1)
    try {
      const [nextHistory, nextInsight] = await Promise.all([
        window.dockerApi.imageInsights.history(image.id),
        window.dockerApi.imageInsights.analyze(image.id)
      ])
      setHistory(Array.isArray(nextHistory) ? nextHistory : [])
      setInsight(nextInsight ?? null)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && image) void load()
  }, [open, image?.id, image?.repository, image?.tag])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.setTimeout(() => closeRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  const summary = useMemo(() => ({
    layers: history.length,
    notes: Array.isArray(insight?.notes) ? insight!.notes.length : 0
  }), [history, insight])

  if (!open || !image) return null

  return (
    <div
      className="image-intelligence-modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="image-intelligence-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-intelligence-modal-title"
      >
        <header className="image-intelligence-modal-header">
          <div>
            <div className="eyebrow">Image Intelligence</div>
            <h2 id="image-intelligence-modal-title">{image.repository}:{image.tag}</h2>
            <div className="image-intelligence-modal-meta">
              <code>{image.id}</code>
              <Badge tone="neutral">{image.size}</Badge>
              <Badge tone="info">{image.createdSince}</Badge>
            </div>
          </div>
          <div className="inline-actions">
            <button className="button secondary" disabled={loading} onClick={() => void load()}>
              {loading ? 'Analyzing…' : 'Analyze again'}
            </button>
            <button
              ref={closeRef}
              className="icon-button"
              aria-label="Close Image Intelligence"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {error && (
          <div className="image-intelligence-modal-alert">
            <InlineAlert tone="danger" title="Image analysis failed">{error}</InlineAlert>
          </div>
        )}

        {loading ? (
          <div className="image-intelligence-modal-loading">
            <LoadingState label="Analyzing image layers and optimization signals" rows={10} />
          </div>
        ) : (
          <div className="image-intelligence-modal-body">
            <section className="image-intelligence-summary">
              <div>
                <span>Image size</span>
                <strong>{insight?.totalSize || image.size}</strong>
              </div>
              <div>
                <span>Layers</span>
                <strong>{summary.layers}</strong>
              </div>
              <div>
                <span>Largest layer</span>
                <strong>{insight?.largestLayerSize || '—'}</strong>
              </div>
              <div>
                <span>Large layers</span>
                <strong>{insight?.largeLayerCount ?? 0}</strong>
              </div>
              <div>
                <span>Recommendations</span>
                <strong>{summary.notes}</strong>
              </div>
            </section>

            <section className="image-intelligence-modal-grid">
              <div className="card image-intelligence-advisor">
                <div className="section-row">
                  <div>
                    <div className="eyebrow">Optimization advisor</div>
                    <h3>{insight?.displayName || `${image.repository}:${image.tag}`}</h3>
                  </div>
                  <Badge tone={summary.notes ? 'warn' : 'ok'}>
                    {summary.notes ? `${summary.notes} recommendation${summary.notes === 1 ? '' : 's'}` : 'No obvious issue'}
                  </Badge>
                </div>

                <div className="image-largest-layer">
                  <span>Largest layer command</span>
                  <code>{insight?.largestLayerCommand || '—'}</code>
                </div>

                <div className="image-intelligence-notes">
                  {insight && Array.isArray(insight.notes) && insight.notes.length ? (
                    insight.notes.map((note, index) => (
                      <article key={index}>
                        <Badge tone="info">Recommendation {index + 1}</Badge>
                        <p>{note}</p>
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      title="No common optimization issue detected"
                      text="The advisor did not detect a known large-layer or Dockerfile optimization pattern in the sampled image history."
                    />
                  )}
                </div>
              </div>

              <div className="card image-intelligence-context">
                <div className="section-row">
                  <div>
                    <div className="eyebrow">How to interpret this</div>
                    <h3>Image optimization context</h3>
                  </div>
                </div>
                <div className="image-intelligence-context-list">
                  <span><strong>Large layers</strong>Prioritize package caches, copied build artifacts, and dependency installation layers.</span>
                  <span><strong>Layer count</strong>Many layers are not automatically a problem; size and cache behavior matter more.</span>
                  <span><strong>History</strong>`CreatedBy` is Docker image history metadata, not the original Dockerfile source.</span>
                  <span><strong>Safety</strong>Analysis is read-only. Removing the image remains a separate confirmed action on the Images page.</span>
                </div>
              </div>
            </section>

            <section className="card image-intelligence-layers">
              <div className="section-row">
                <div>
                  <div className="eyebrow">Layer history</div>
                  <h3>{history.length} layer record{history.length === 1 ? '' : 's'}</h3>
                </div>
                <Badge tone="info">Read-only</Badge>
              </div>

              <ListControls
                query={layerList.query}
                onQueryChange={layerList.setQuery}
                page={layerList.page}
                totalPages={layerList.totalPages}
                totalItems={layerList.totalItems}
                startItem={layerList.startItem}
                endItem={layerList.endItem}
                onPrevious={() => layerList.setPage(layerList.page - 1)}
                onNext={() => layerList.setPage(layerList.page + 1)}
                placeholder="Search layers, commands, comments…"
              />

              {!layerList.pageItems.length ? (
                <EmptyState title="No layer history" text="Docker did not return layer-history records matching this search." />
              ) : (
                <div className="image-intelligence-layer-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Layer</th>
                        <th>Age</th>
                        <th>Size</th>
                        <th>Command</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {layerList.pageItems.map((layer, index) => (
                        <tr key={`${layer.id}-${index}`}>
                          <td className="mono">{(layer.id || '<missing>').replace('sha256:', '').slice(0, 12)}</td>
                          <td>{layer.createdSince || '—'}</td>
                          <td><strong>{layer.size || '—'}</strong></td>
                          <td className="mono wrap">{layer.createdBy || '—'}</td>
                          <td className="muted wrap">{layer.comment || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        <footer className="image-intelligence-modal-footer">
          <span>Analysis uses Docker image history and heuristic optimization signals; it does not modify the image.</span>
          <button className="button secondary" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  )
}
