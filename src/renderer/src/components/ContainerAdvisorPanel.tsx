import { useEffect, useMemo, useState } from 'react'
import type { AiContainerFailureAnalysis, AiProviderSettings, ContainerAdvisorResult, ContainerDiagnosticFinding } from '../../../shared/contracts'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { AppIcon } from './Icon'
import { Badge, EmptyState, InlineAlert, LoadingState } from './ui'

export function ContainerAdvisorPanel({ containerId }: { containerId: string }) {
  const [result, setResult] = useState<ContainerAdvisorResult | null>(null)
  const [aiSettings, setAiSettings] = useState<AiProviderSettings | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AiContainerFailureAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [advisor, provider] = await Promise.all([
        window.dockerApi.containers.advisor(containerId),
        window.dockerApi.ai.settings().catch(() => null)
      ])
      setResult(advisor)
      setAiSettings(provider)
      setAiAnalysis(null)
      setAiError('')
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [containerId])


  const analyzeWithAi = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      setAiAnalysis(await window.dockerApi.ai.analyzeContainerFailure(containerId))
    } catch (value) {
      setAiError(value instanceof Error ? value.message : String(value))
    } finally {
      setAiLoading(false)
    }
  }

  const findings = Array.isArray(result?.findings) ? result.findings : []

  const aiEligible = Boolean(result && (
    result.diagnostics.state !== 'running' ||
    result.diagnostics.oomKilled ||
    result.diagnostics.exitCode !== 0 ||
    result.diagnostics.restartCount >= 3 ||
    result.diagnostics.health.status === 'unhealthy' ||
    (result.diagnostics.health.configured && result.diagnostics.health.status === 'unknown') ||
    findings.some(item => item.severity === 'critical' || item.severity === 'warning')
  ))
  const aiReady = Boolean(aiSettings?.enabled && aiSettings.model)

  const counts = useMemo(() => ({
    critical: findings.filter(item => item.severity === 'critical').length,
    warning: findings.filter(item => item.severity === 'warning').length,
    info: findings.filter(item => item.severity === 'info').length
  }), [findings])

  if (loading) return <LoadingState label="Analyzing container evidence" rows={7} />
  if (error) return <InlineAlert tone="danger" title="Container diagnostics advisor failed">{error}</InlineAlert>
  if (!result) return <EmptyState title="No diagnostic result" text="No container evidence was returned." />

  if (!result.diagnostics || !Array.isArray(result.findings)) {
    return (
      <InlineAlert tone="danger" title="Unexpected Container Advisor response">
        The diagnostics endpoint returned an invalid payload. Refresh the application after updating; the workspace has been protected from crashing.
      </InlineAlert>
    )
  }

  return (
    <div className="container-advisor">
      <div className={`advisor-summary advisor-summary-${result.status}`}>
        <div className="advisor-summary-icon" aria-hidden="true"><AppIcon icon={Alert02Icon} size={24} /></div>
        <div className="advisor-summary-copy">
          <div className="eyebrow">Evidence-driven diagnostics</div>
          <h3>{statusTitle(result.status)}</h3>
          <p>{result.summary}</p>
          <div className="advisor-summary-meta">
            <Badge tone={counts.critical ? 'danger' : 'neutral'}>{counts.critical} critical</Badge>
            <Badge tone={counts.warning ? 'warn' : 'neutral'}>{counts.warning} warning</Badge>
            <Badge tone="info">{result.logsSampled} log lines sampled</Badge>
          </div>
        </div>
        <button className="button secondary" onClick={load}><AppIcon icon={RefreshIcon} />Analyze again</button>
      </div>

      <section className="diagnostic-grid advisor-facts">
        <Fact label="State" value={result.diagnostics.state || '—'} />
        <Fact label="Exit code" value={String(result.diagnostics.exitCode)} />
        <Fact label="OOM killed" value={result.diagnostics.oomKilled ? 'Yes' : 'No'} danger={result.diagnostics.oomKilled} />
        <Fact label="Restart count" value={String(result.diagnostics.restartCount)} danger={result.diagnostics.restartCount >= 3} />
        <Fact label="Health" value={result.diagnostics.health.status} danger={result.diagnostics.health.status === 'unhealthy'} />
        <Fact label="Memory" value={result.stats ? `${result.stats.memoryPercent.toFixed(1)}% · ${result.stats.memoryUsage}` : 'No running snapshot'} danger={Boolean(result.stats && result.stats.memoryPercent >= 90)} />
        <Fact label="CPU" value={result.stats ? `${result.stats.cpuPercent.toFixed(1)}%` : 'No running snapshot'} danger={Boolean(result.stats && result.stats.cpuPercent >= 95)} />
        <Fact label="PIDs" value={result.stats ? String(result.stats.pids) : '—'} />
      </section>

      {aiEligible && (
        <section className="card container-ai-analysis-card">
          <div className="section-row">
            <div>
              <div className="eyebrow">AI-assisted Failure Analysis</div>
              <h3>Container runtime & health second opinion</h3>
              <p className="muted">
                Uses the same OpenAI-compatible provider configured in Settings. Analysis is explicit, read-only, and complements the local deterministic findings below.
              </p>
            </div>
            <div className="inline-actions">
              {aiSettings && (
                <Badge tone={aiReady ? 'ok' : 'neutral'}>{aiReady ? aiSettings.model : 'AI not configured'}</Badge>
              )}
              <button className="button primary" disabled={!aiReady || aiLoading} onClick={() => void analyzeWithAi()}>
                {aiLoading ? 'Analyzing…' : aiAnalysis ? 'Analyze again with AI' : 'Analyze failure with AI'}
              </button>
            </div>
          </div>

          {!aiReady && (
            <InlineAlert tone="info" title="AI provider is not ready">
              Enable AI Diagnostics and configure an OpenAI-compatible Base URL + Model in Settings → AI Provider.
            </InlineAlert>
          )}
          {aiError && <InlineAlert tone="danger" title="AI Container Failure Analysis failed">{aiError}</InlineAlert>}
          {aiLoading && <div className="container-ai-loading"><LoadingState label="Redacting container evidence and requesting AI analysis" rows={6} /></div>}
          {!aiLoading && aiAnalysis && <ContainerAiResult analysis={aiAnalysis} />}
        </section>
      )}

      {!findings.length ? (
        <EmptyState title="No known failure patterns" text="The sampled inspect, health, logs, and stats evidence did not match a known diagnostic rule. This does not guarantee the workload is problem-free." />
      ) : (
        <div className="advisor-findings">
          {findings.map(finding => <FindingCard finding={finding} key={finding.id} />)}
        </div>
      )}

      <div className="info-banner">
        <strong>Advisor scope.</strong> Findings are generated only from Docker inspect, health, recent logs, and a point-in-time stats snapshot. The advisor does not modify the container and does not claim a root cause without matching evidence.
      </div>
    </div>
  )
}

function ContainerAiResult({ analysis }: { analysis: AiContainerFailureAnalysis }) {
  return (
    <div className="container-ai-result">
      <div className="build-ai-summary">
        <div><span>Confidence</span><Badge tone={analysis.confidence === 'high' ? 'ok' : analysis.confidence === 'low' ? 'warn' : 'info'}>{analysis.confidence}</Badge></div>
        <div><span>Model</span><strong>{analysis.model}</strong></div>
        <div><span>Rule findings used</span><strong>{analysis.ruleFindingsUsed}</strong></div>
        <div><span>Log chars sent</span><strong>{analysis.logsCharsSent.toLocaleString()}</strong></div>
      </div>

      <div className="container-ai-summary-text">
        <span>AI summary</span>
        <p>{analysis.summary}</p>
      </div>

      <div className={`container-ai-health ${analysis.healthAssessment.assessable ? '' : 'unavailable'}`}>
        <div>
          <span>Health assessment</span>
          <strong>{analysis.healthAssessment.configured ? analysis.healthAssessment.status : 'not configured'}</strong>
        </div>
        <p>{analysis.healthAssessment.explanation}</p>
      </div>

      <div className="container-ai-triggers">
        <span>Why AI analysis was offered</span>
        <ul>{analysis.triggerReasons.map((reason,index) => <li key={index}>{reason}</li>)}</ul>
      </div>

      <div className="build-ai-columns">
        <section>
          <div className="section-row compact"><div><div className="eyebrow">Potential root causes</div><h3>Evidence-backed hypotheses</h3></div><Badge tone="neutral">{analysis.rootCauses.length}</Badge></div>
          {!analysis.rootCauses.length ? <EmptyState title="No supported root cause" text="The AI provider did not identify a sufficiently supported root cause." /> : (
            <div className="build-ai-cause-list">
              {analysis.rootCauses.map((cause,index) => <article key={`${cause.title}-${index}`}><strong>{cause.title}</strong><p>{cause.explanation}</p>{!!cause.evidence.length && <ul>{cause.evidence.map((evidence,i) => <li key={i}><code>{evidence}</code></li>)}</ul>}</article>)}
            </div>
          )}
        </section>
        <section>
          <div className="section-row compact"><div><div className="eyebrow">Recommended actions</div><h3>Safe next steps</h3></div><Badge tone="neutral">{analysis.recommendedActions.length}</Badge></div>
          {!analysis.recommendedActions.length ? <EmptyState title="No additional AI action" text="The AI provider did not return an additional safe action." /> : (
            <div className="build-ai-action-list">
              {analysis.recommendedActions.map((item,index) => <article key={`${item.action}-${index}`}><Badge tone={item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warn' : 'info'}>{item.priority}</Badge><strong>{item.action}</strong><p>{item.rationale}</p></article>)}
            </div>
          )}
        </section>
      </div>
      <div className="build-ai-disclaimer">{analysis.disclaimer}</div>
    </div>
  )
}

function FindingCard({ finding }: { finding: ContainerDiagnosticFinding }) {
  return (
    <article className={`card advisor-finding finding-${finding.severity}`}>
      <div className="advisor-finding-head">
        <div>
          <div className="eyebrow">{finding.category}</div>
          <h3>{finding.symptom}</h3>
        </div>
        <Badge tone={finding.severity === 'critical' ? 'danger' : finding.severity === 'warning' ? 'warn' : 'info'}>{finding.severity}</Badge>
      </div>

      <div className="advisor-flow">
        <div className="advisor-flow-block">
          <span>Symptoms</span>
          <strong>{finding.symptom}</strong>
        </div>
        <div className="advisor-flow-arrow" aria-hidden="true">→</div>
        <div className="advisor-flow-block">
          <span>Likely cause</span>
          <strong>{finding.likelyCause}</strong>
        </div>
      </div>

      <div className="advisor-columns">
        <section>
          <h4>Evidence</h4>
          <ul>{finding.evidence.map((item, index) => <li className="mono wrap" key={index}>{item}</li>)}</ul>
        </section>
        <section>
          <h4>Recommended actions</h4>
          <ol>{finding.actions.map((item, index) => <li key={index}>{item}</li>)}</ol>
        </section>
      </div>
    </article>
  )
}

function Fact({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="card diagnostic-item"><span>{label}</span><strong className={`wrap ${danger ? 'text-danger' : ''}`}>{value}</strong></div>
}

function statusTitle(status: ContainerAdvisorResult['status']) {
  if (status === 'critical') return 'Critical diagnostic evidence detected'
  if (status === 'warning') return 'Diagnostic warnings detected'
  return 'No known failure pattern detected'
}
