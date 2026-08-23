import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ImageInfo } from '../../../shared/contracts'
import { Badge, ConfirmButton, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { ListControls } from '../components/ListControls'
import { usePaginatedSearch } from '../hooks/usePaginatedSearch'
import { AppIcon } from '../components/Icon'
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { PageTitle } from '../components/PageTitle'
import { ImageIntelligenceModal } from '../components/ImageIntelligenceModal'

type ImageIntent = {
  page?: string
  kind?: string
  resourceId?: string
  resourceName?: string
  action?: string
  createdAt?: number
}

export function ImagesPage({ filter }: { filter: string }) {
  const [rows, setRows] = useState<ImageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analysisImage, setAnalysisImage] = useState<ImageInfo | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)

  const closeAnalysis = useCallback(() => {
    setAnalysisOpen(false)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const next = await window.dockerApi.images.list()
      setRows(Array.isArray(next) ? next : [])
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (loading || !rows.length) return

    try {
      const raw = sessionStorage.getItem('dsm.m08.intent')
      if (!raw) return
      const intent = JSON.parse(raw) as ImageIntent
      if (intent.page !== 'images') return

      const match = rows.find(image =>
        (intent.resourceId && image.id === intent.resourceId) ||
        (intent.resourceName && `${image.repository}:${image.tag}` === intent.resourceName)
      )
      if (!match) return

      sessionStorage.removeItem('dsm.m08.intent')
      setAnalysisImage(match)
      setAnalysisOpen(true)
    } catch {
      sessionStorage.removeItem('dsm.m08.intent')
    }
  }, [loading, rows])

  const totals = useMemo(() => ({
    images: rows.length,
    tagged: rows.filter(image => image.repository !== '<none>' && image.tag !== '<none>').length,
    dangling: rows.filter(image => image.repository === '<none>' || image.tag === '<none>').length
  }), [rows])

  const list = usePaginatedSearch(
    rows,
    image => `${image.repository}:${image.tag} ${image.id} ${image.createdSince} ${image.size}`,
    { pageSize: 10, initialQuery: filter }
  )

  const openAnalysis = (image: ImageInfo) => {
    setAnalysisImage(image)
    setAnalysisOpen(true)
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="images"
          title="Images"
          subtitle="Manage image inventory and open layer-level Image Intelligence without leaving this workspace."
        />
        <div className="inline-actions">
          <button className="button secondary" onClick={() => void load()}>
            <AppIcon icon={RefreshIcon} />
            Refresh
          </button>
          <ConfirmButton
            message="Remove dangling images?"
            onConfirm={async () => { await window.dockerApi.images.prune(false); await load() }}
          >
            Prune dangling
          </ConfirmButton>
          <ConfirmButton
            danger
            message="Remove ALL images not referenced by containers?"
            onConfirm={async () => { await window.dockerApi.images.prune(true); await load() }}
          >
            Prune unused
          </ConfirmButton>
        </div>
      </div>

      {error && <InlineAlert tone="danger" title="Could not load images">{error}</InlineAlert>}

      <section className="image-page-summary">
        <div className="card">
          <span>Total images</span>
          <strong>{totals.images}</strong>
        </div>
        <div className="card">
          <span>Tagged images</span>
          <strong>{totals.tagged}</strong>
        </div>
        <div className="card">
          <span>Dangling / untagged</span>
          <strong>{totals.dangling}</strong>
        </div>
        <div className="card image-intelligence-entry-card">
          <span>Image Intelligence</span>
          <strong>Integrated</strong>
          <small>Analyze any row to inspect layers and optimization signals.</small>
        </div>
      </section>

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
          placeholder="Search images by repository, tag, ID, age, or size…"
        />

        {loading ? (
          <LoadingState label="Loading images" rows={7} />
        ) : !list.pageItems.length ? (
          <EmptyState title="No images" text="No images match this search." />
        ) : (
          <div className="image-table-wrap">
            <table className="images-unified-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Tag</th>
                  <th>Image ID</th>
                  <th>Age</th>
                  <th>Size</th>
                  <th>Intelligence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.pageItems.map(image => {
                  const dangling = image.repository === '<none>' || image.tag === '<none>'
                  return (
                    <tr key={`${image.id}-${image.repository}-${image.tag}`}>
                      <td>
                        <strong className="wrap">{image.repository}</strong>
                        {dangling && <div><Badge tone="warn">Dangling / untagged</Badge></div>}
                      </td>
                      <td>{image.tag}</td>
                      <td className="mono">{image.id.replace('sha256:', '').slice(0, 12)}</td>
                      <td>{image.createdSince}</td>
                      <td><strong>{image.size}</strong></td>
                      <td>
                        <button className="button secondary" onClick={() => openAnalysis(image)}>
                          Analyze
                        </button>
                      </td>
                      <td>
                        <ConfirmButton
                          danger
                          message={`Remove ${image.repository}:${image.tag}?`}
                          onConfirm={async () => {
                            await window.dockerApi.images.remove([image.id])
                            if (analysisImage?.id === image.id) closeAnalysis()
                            await load()
                          }}
                        >
                          Remove
                        </ConfirmButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card images-intelligence-help">
        <div className="section-row">
          <div>
            <div className="eyebrow">Integrated Image Intelligence</div>
            <h2>Analyze before optimizing or removing</h2>
          </div>
          <Badge tone="info">Read-only analysis</Badge>
        </div>
        <div className="images-intelligence-help-grid">
          <span><strong>Layer history</strong>Inspect Docker history, layer sizes, commands and comments.</span>
          <span><strong>Optimization advisor</strong>Surface common large-layer and Dockerfile optimization opportunities.</span>
          <span><strong>Modal workflow</strong>Keep the image inventory visible in context instead of navigating to a separate page.</span>
          <span><strong>Removal safety</strong>Analysis never removes an image; removal keeps its own explicit confirmation.</span>
        </div>
      </section>

      <ImageIntelligenceModal
        image={analysisImage}
        open={analysisOpen}
        onClose={closeAnalysis}
      />
    </div>
  )
}
