import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { AiBuildErrorAnalysis, AiProviderSettings, BuildDiagnosticFinding, BuildDiagnostics, BuildHistoryRecord } from '../../../shared/contracts'
import { Badge, CodePanel, EmptyState, InlineAlert, LoadingState } from './ui'
import { AppIcon } from './Icon'
import { RefreshIcon, Search01Icon } from '@hugeicons/core-free-icons'

type Tab = 'overview' | 'logs' | 'steps' | 'cache' | 'timing' | 'errors'
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'logs', label: 'Logs' },
  { id: 'steps', label: 'Steps' },
  { id: 'cache', label: 'Cache' },
  { id: 'timing', label: 'Timing' },
  { id: 'errors', label: 'Error Analysis' }
]

export function BuildDiagnosticsModal({
  build,
  diagnostics,
  loading,
  error,
  onReload,
  onClose
}: {
  build: BuildHistoryRecord
  diagnostics: BuildDiagnostics | null
  loading: boolean
  error: string
  onReload: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [query, setQuery] = useState('')
  const [aiSettings, setAiSettings] = useState<AiProviderSettings | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AiBuildErrorAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const deferredQuery = useDeferredValue(query)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const ref = build.id || build.ref

  useEffect(() => {
    setTab('overview')
    setQuery('')
    setAiAnalysis(null)
    setAiError('')
    setAiLoading(false)
    void window.dockerApi.ai.settings().then(setAiSettings).catch(() => setAiSettings(null))
  }, [build.id, build.ref])

  useEffect(() => {
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
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [])

  const steps = useMemo(() => parseBuildSteps(diagnostics?.logs ?? ''), [diagnostics?.logs])
  const visibleLogs = useMemo(() => {
    const text = diagnostics?.logs ?? ''
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return text
    return text.split(/\r?\n/).filter(line => line.toLowerCase().includes(q)).join('\n')
  }, [diagnostics?.logs, deferredQuery])

  const openDockerDesktop = async () => {
    const result = await window.dockerApi.buildkit.open(ref)
    if (!result.ok) window.alert(result.stderr || 'Unable to open this build in Docker Desktop.')
  }

  const analyzeWithAi = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const result = await window.dockerApi.ai.analyzeBuildError(ref)
      setAiAnalysis(result)
    } catch (value) {
      setAiError(value instanceof Error ? value.message : String(value))
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div
      className="build-diagnostics-modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="build-diagnostics-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-diagnostics-modal-title"
      >
        <div className="workspace-titlebar build-workspace-titlebar build-diagnostics-modal-header">
          <div>
            <div className="eyebrow">Build Diagnostics</div>
            <h2 id="build-diagnostics-modal-title">{displayName(build)}</h2>
            <div className="mono muted wrap">{build.ref || build.id}</div>
          </div>
          <div className="inline-actions">
            <button className="button secondary" onClick={() => navigator.clipboard.writeText(build.ref || build.id)}>
              Copy ref
            </button>
            <button className="button secondary" onClick={openDockerDesktop}>
              Open in Docker Desktop
            </button>
            <button className="button secondary" onClick={onReload} disabled={loading}>
              <AppIcon icon={RefreshIcon} />
              Reload
            </button>
            <button
              ref={closeRef}
              className="icon-button"
              aria-label="Close build diagnostics"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className="workspace-tabs build-diagnostics-modal-tabs" role="tablist" aria-label="Build diagnostics tabs">
          {tabs.map(item => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`build-diagnostics-panel-${item.id}`}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.id === 'errors' && diagnostics && diagnostics.findings.some(f => f.severity !== 'info') && (
                <span className="tab-alert-dot" aria-label="Diagnostic findings available" />
              )}
            </button>
          ))}
        </div>

        <div
          className="workspace-body build-diagnostics-body build-diagnostics-modal-body"
          id={`build-diagnostics-panel-${tab}`}
          role="tabpanel"
        >
          {loading ? <LoadingState label="Loading Buildx diagnostics" rows={8} /> : null}
          {!loading && error ? <InlineAlert tone="danger" title="Build diagnostics unavailable">{error}</InlineAlert> : null}
          {!loading && !error && diagnostics ? (
            <>
              {tab === 'overview' && <Overview diagnostics={diagnostics} />}
              {tab === 'logs' && <Logs value={visibleLogs} query={query} onQueryChange={setQuery} />}
              {tab === 'steps' && <Steps steps={steps} details={diagnostics} />}
              {tab === 'cache' && <Cache diagnostics={diagnostics} steps={steps} />}
              {tab === 'timing' && <Timing diagnostics={diagnostics} />}
                            {tab === 'errors' && (
                <ErrorAnalysis
                  findings={diagnostics.findings}
                  aiSettings={aiSettings}
                  aiAnalysis={aiAnalysis}
                  aiLoading={aiLoading}
                  aiError={aiError}
                  onAnalyzeWithAi={() => void analyzeWithAi()}
                />
              )}
            </>
          ) : null}
        </div>

        <footer className="build-diagnostics-modal-footer">
          <span>
            Diagnostics are read-only. Buildx history/logs are analyzed without rerunning the original build.
          </span>
          <button className="button secondary" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  )
}

function Overview({ diagnostics }: { diagnostics: BuildDiagnostics }) {
  const d = diagnostics.details
  return (
    <div className="build-diagnostics-stack">
      <div className="diagnostic-grid">
        <Info label="Status" value={d.status || 'unknown'} tone={statusTone(d.status)} />
        <Info label="Duration" value={d.duration || '—'} />
        <Info label="Steps" value={d.totalSteps ? `${d.completedSteps}/${d.totalSteps}` : '—'} />
        <Info label="Cached" value={d.totalSteps ? `${d.cachedSteps}/${d.totalSteps} (${Math.round(d.cachedSteps / d.totalSteps * 100)}%)` : '—'} />
        <Info label="Context" value={d.context || '—'} />
        <Info label="Dockerfile" value={d.dockerfile || '—'} />
        <Info label="Target" value={d.target || 'default'} />
        <Info label="Platforms" value={d.platforms.join(', ') || '—'} />
      </div>

      <div className="build-metadata-grid">
        <section className="card build-metadata-card">
          <div className="eyebrow">Source control</div>
          <dl className="build-definition-list">
            <dt>Repository</dt><dd className="wrap">{d.vcsRepository || '—'}</dd>
            <dt>Revision</dt><dd className="mono wrap">{d.vcsRevision || '—'}</dd>
            <dt>Image resolve</dt><dd>{d.imageResolveMode || '—'}</dd>
          </dl>
        </section>
        <section className="card build-metadata-card">
          <div className="eyebrow">Build record</div>
          <dl className="build-definition-list">
            <dt>Build ID</dt><dd className="mono wrap">{d.id || '—'}</dd>
            <dt>Ref</dt><dd className="mono wrap">{d.ref || '—'}</dd>
            <dt>Started</dt><dd>{formatDate(d.startedAt)}</dd>
            <dt>Completed</dt><dd>{formatDate(d.completedAt)}</dd>
          </dl>
        </section>
      </div>

      <section className="card build-metadata-card">
        <div className="section-row compact">
          <div><div className="eyebrow">Materials</div><h3>Build inputs</h3></div>
          <Badge tone="neutral">{d.materials.length}</Badge>
        </div>
        {!d.materials.length ? <EmptyState title="No build materials" text="Buildx did not report material metadata for this build." /> : (
          <div className="build-material-list">
            {d.materials.map((material, index) => (
              <div className="build-material-row" key={`${material.uri}-${index}`}>
                <strong className="wrap">{material.uri || 'Unnamed material'}</strong>
                <span className="mono muted wrap">{material.digests.join(', ') || 'No digest'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card build-metadata-card">
        <div className="section-row compact">
          <div><div className="eyebrow">Attachments</div><h3>Provenance / SBOM artifacts</h3></div>
          <Badge tone="neutral">{d.attachments.length}</Badge>
        </div>
        {!d.attachments.length ? <EmptyState title="No build attachments" text="This build record does not expose provenance, SBOM, or other attached artifacts." /> : (
          <div className="build-material-list">
            {d.attachments.map((attachment, index) => (
              <div className="build-material-row" key={`${attachment.digest}-${index}`}>
                <div><strong className="wrap">{attachment.type || 'Attachment'}</strong><div className="muted">{attachment.platform || 'all platforms'}</div></div>
                <span className="mono muted wrap">{attachment.digest || 'No digest'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Logs({ value, query, onQueryChange }: { value: string; query: string; onQueryChange: (value: string) => void }) {
  return (
    <div className="build-log-view">
      <div className="build-log-toolbar">
        <label className="list-search build-log-search">
          <AppIcon icon={Search01Icon} />
          <span className="sr-only">Search build logs</span>
          <input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search build logs…" />
        </label>
        <span className="muted">Buildx progress=plain</span>
      </div>
      {!value ? <EmptyState title="No build logs" text="Buildx did not return logs for this record." /> : (
        <CodePanel title={query ? 'Filtered build logs' : 'Build logs'} value={value} />
      )}
    </div>
  )
}

function Steps({ steps, details }: { steps: BuildLogStep[]; details: BuildDiagnostics }) {
  if (!steps.length) {
    return <EmptyState title="No parsed build steps" text="The logs did not contain Buildx plain-progress step markers. Use the Logs tab for raw output." />
  }
  return (
    <div className="build-step-list">
      <div className="build-progress-summary">
        <strong>{details.details.completedSteps}/{details.details.totalSteps || steps.length}</strong>
        <span>completed steps</span>
      </div>
      {steps.map(step => (
        <article className="card build-step-row" key={step.id}>
          <div className={`build-step-status step-${step.status.toLowerCase()}`} aria-hidden="true" />
          <div className="build-step-main">
            <div className="build-step-title-row">
              <strong>#{step.id} {step.title}</strong>
              <Badge tone={step.status === 'ERROR' ? 'danger' : step.status === 'CACHED' ? 'info' : step.status === 'DONE' ? 'ok' : 'neutral'}>{step.status}</Badge>
            </div>
            {step.detail && <div className="mono muted wrap">{step.detail}</div>}
          </div>
          <div className="build-step-duration">{step.duration || '—'}</div>
        </article>
      ))}
    </div>
  )
}

function Cache({ diagnostics, steps }: { diagnostics: BuildDiagnostics; steps: BuildLogStep[] }) {
  const d = diagnostics.details
  const cached = steps.filter(step => step.status === 'CACHED')
  const percent = d.totalSteps ? Math.round(d.cachedSteps / d.totalSteps * 100) : 0
  return (
    <div className="build-diagnostics-stack">
      <div className="diagnostic-grid">
        <Info label="Cached steps" value={`${d.cachedSteps}`} tone="info" />
        <Info label="Total steps" value={`${d.totalSteps}`} />
        <Info label="Cache hit" value={d.totalSteps ? `${percent}%` : '—'} />
        <Info label="Executed" value={d.totalSteps ? `${Math.max(0, d.totalSteps - d.cachedSteps)}` : '—'} />
      </div>
      <section className="card build-metadata-card">
        <div className="section-row compact"><div><div className="eyebrow">Cache evidence</div><h3>Steps reported as cached</h3></div><Badge tone="info">{cached.length}</Badge></div>
        {!cached.length ? <EmptyState title="No cached step markers" text="Buildx logs did not mark individual steps as CACHED, even if aggregate cache metadata is available." /> : (
          <div className="build-material-list">
            {cached.map(step => <div className="build-material-row" key={step.id}><strong>#{step.id} {step.title}</strong><span className="muted">{step.duration || 'Cached'}</span></div>)}
          </div>
        )}
      </section>
    </div>
  )
}

function Timing({ diagnostics }: { diagnostics: BuildDiagnostics }) {
  const d = diagnostics.details
  const total = Math.max(d.totalSteps, 1)
  const cachePercent = Math.round(d.cachedSteps / total * 100)
  const executePercent = 100 - cachePercent
  return (
    <div className="build-diagnostics-stack">
      <div className="diagnostic-grid">
        <Info label="Started" value={formatDate(d.startedAt)} />
        <Info label="Completed" value={formatDate(d.completedAt)} />
        <Info label="Duration" value={d.duration || '—'} />
        <Info label="Duration ms" value={d.durationMs ? d.durationMs.toLocaleString() : '—'} />
      </div>
      <section className="card build-timing-card">
        <div className="eyebrow">Execution mix</div>
        <h3>Cache vs executed steps</h3>
        <div className="build-timing-bar" role="img" aria-label={`${cachePercent}% cached steps, ${executePercent}% executed steps`}>
          <div className="build-timing-cached" style={{ width: `${cachePercent}%` }} />
          <div className="build-timing-executed" style={{ width: `${executePercent}%` }} />
        </div>
        <div className="chart-legend build-timing-legend">
          <span><i className="legend-swatch build-cache-swatch" />Cached {cachePercent}%</span>
          <span><i className="legend-swatch build-execute-swatch" />Executed {executePercent}%</span>
        </div>
      </section>
    </div>
  )
}

function ErrorAnalysis({
  findings,
  aiSettings,
  aiAnalysis,
  aiLoading,
  aiError,
  onAnalyzeWithAi
}: {
  findings: BuildDiagnosticFinding[]
  aiSettings: AiProviderSettings | null
  aiAnalysis: AiBuildErrorAnalysis | null
  aiLoading: boolean
  aiError: string
  onAnalyzeWithAi: () => void
}) {
  const aiReady = Boolean(aiSettings?.enabled && aiSettings.model)

  return (
    <div className="build-error-analysis-stack">
      <section className="build-ai-analysis-card card">
        <div className="section-row">
          <div>
            <div className="eyebrow">AI-assisted Error Analysis</div>
            <h3>OpenAI-compatible second opinion</h3>
            <p className="muted">
              Rule-based findings remain authoritative local evidence. AI runs only when requested and adds an advisory interpretation.
            </p>
          </div>
          <div className="inline-actions">
            {aiSettings && (
              <Badge tone={aiReady ? 'ok' : 'neutral'}>
                {aiReady ? `${aiSettings.model}` : 'Not configured'}
              </Badge>
            )}
            <button className="button primary" disabled={!aiReady || aiLoading} onClick={onAnalyzeWithAi}>
              {aiLoading ? 'Analyzing…' : aiAnalysis ? 'Analyze again with AI' : 'Analyze with AI'}
            </button>
          </div>
        </div>

        {!aiReady && (
          <InlineAlert tone="info" title="AI provider is not ready">
            Enable AI Error Analysis and configure an OpenAI-compatible Base URL + Model in Settings → AI Provider.
          </InlineAlert>
        )}

        {aiError && <InlineAlert tone="danger" title="AI Error Analysis failed">{aiError}</InlineAlert>}

        {aiLoading && (
          <div className="build-ai-loading">
            <LoadingState label="Redacting evidence and requesting AI analysis" rows={6} />
          </div>
        )}

        {!aiLoading && aiAnalysis && (
          <div className="build-ai-result">
            <div className="build-ai-summary">
              <div>
                <span>Confidence</span>
                <Badge tone={aiAnalysis.confidence === 'high' ? 'ok' : aiAnalysis.confidence === 'low' ? 'warn' : 'info'}>
                  {aiAnalysis.confidence}
                </Badge>
              </div>
              <div><span>Model</span><strong>{aiAnalysis.model}</strong></div>
              <div><span>Rule findings used</span><strong>{aiAnalysis.ruleFindingsUsed}</strong></div>
              <div><span>Log chars sent</span><strong>{aiAnalysis.logsCharsSent.toLocaleString()}</strong></div>
            </div>

            <div className="build-ai-summary-text">
              <span>AI summary</span>
              <p>{aiAnalysis.summary}</p>
            </div>

            <div className="build-ai-columns">
              <section>
                <div className="section-row compact">
                  <div><div className="eyebrow">Potential root causes</div><h3>Evidence-backed hypotheses</h3></div>
                  <Badge tone="neutral">{aiAnalysis.rootCauses.length}</Badge>
                </div>
                {!aiAnalysis.rootCauses.length ? (
                  <EmptyState title="No AI root cause" text="The provider did not identify a sufficiently supported root cause." />
                ) : (
                  <div className="build-ai-cause-list">
                    {aiAnalysis.rootCauses.map((cause,index) => (
                      <article key={`${cause.title}-${index}`}>
                        <strong>{cause.title}</strong>
                        <p>{cause.explanation}</p>
                        {!!cause.evidence.length && (
                          <ul>{cause.evidence.map((evidence,i) => <li key={i}><code>{evidence}</code></li>)}</ul>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="section-row compact">
                  <div><div className="eyebrow">Recommended actions</div><h3>Suggested next steps</h3></div>
                  <Badge tone="neutral">{aiAnalysis.recommendedActions.length}</Badge>
                </div>
                {!aiAnalysis.recommendedActions.length ? (
                  <EmptyState title="No AI action" text="No additional action was returned by the provider." />
                ) : (
                  <div className="build-ai-action-list">
                    {aiAnalysis.recommendedActions.map((item,index) => (
                      <article key={`${item.action}-${index}`}>
                        <Badge tone={item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warn' : 'info'}>{item.priority}</Badge>
                        <strong>{item.action}</strong>
                        <p>{item.rationale}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="build-ai-disclaimer">{aiAnalysis.disclaimer}</div>
          </div>
        )}
      </section>

      <section>
        <div className="section-row compact build-rule-analysis-heading">
          <div>
            <div className="eyebrow">Local rule-based analysis</div>
            <h3>Deterministic diagnostic findings</h3>
          </div>
          <Badge tone="neutral">{findings.length}</Badge>
        </div>
        <div className="build-finding-list">
          {findings.map((finding, index) => (
            <article className={`card build-finding finding-${finding.severity}`} key={`${finding.title}-${index}`}>
              <div className="build-finding-header">
                <strong>{finding.title}</strong>
                <Badge tone={finding.severity === 'critical' ? 'danger' : finding.severity === 'warning' ? 'warn' : 'info'}>{finding.severity}</Badge>
              </div>
              <div className="build-finding-block">
                <span>Evidence</span>
                <code className="wrap">{finding.evidence}</code>
              </div>
              <div className="build-finding-block">
                <span>Recommended action</span>
                <p>{finding.recommendation}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'danger' | 'info' }) {
  return <div className="card diagnostic-item"><span>{label}</span><strong className="wrap">{value}</strong>{tone !== 'neutral' && <Badge tone={tone}>{tone === 'ok' ? 'Healthy' : tone === 'danger' ? 'Attention' : 'Info'}</Badge>}</div>
}

function statusTone(status: string): 'neutral' | 'ok' | 'danger' | 'info' {
  if (/complete|success/i.test(status)) return 'ok'
  if (/error|fail|cancel/i.test(status)) return 'danger'
  if (/running|active/i.test(status)) return 'info'
  return 'neutral'
}

function displayName(build: BuildHistoryRecord) {
  if (build.name.trim()) return build.name
  return `Build ${build.id || build.ref.split('/').filter(Boolean).at(-1) || 'record'}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

type BuildLogStep = { id: string; title: string; status: 'RUNNING' | 'DONE' | 'CACHED' | 'ERROR'; duration: string; detail: string }

function parseBuildSteps(logs: string): BuildLogStep[] {
  const rows = new Map<string, BuildLogStep>()
  const clean = logs.replace(/\x1b\[[0-9;]*m/g, '')
  for (const rawLine of clean.split(/\r?\n/)) {
    const line = rawLine.trim()
    const header = line.match(/^#(\d+)\s+(.+)$/)
    if (!header) continue
    const [, id, content] = header
    const current = rows.get(id) ?? { id, title: '', status: 'RUNNING' as const, duration: '', detail: '' }

    const terminal = content.match(/^(DONE|CACHED|ERROR)\s*([\d.]+s)?\s*(.*)$/i)
    if (terminal) {
      const status = terminal[1].toUpperCase() as BuildLogStep['status']
      rows.set(id, { ...current, status, duration: terminal[2] ?? current.duration, detail: terminal[3] || current.detail })
      continue
    }

    if (!current.title && !/^(resolve|sha256:|transferring|extracting|loading|fetching)/i.test(content)) {
      rows.set(id, { ...current, title: content })
    } else if (/error|failed|exit code/i.test(content)) {
      rows.set(id, { ...current, detail: content, status: 'ERROR' })
    } else {
      rows.set(id, { ...current, detail: current.detail || content })
    }
  }
  return [...rows.values()].sort((a, b) => Number(a.id) - Number(b.id)).map(step => ({ ...step, title: step.title || 'Build step' }))
}
