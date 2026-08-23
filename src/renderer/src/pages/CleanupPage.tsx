import { useEffect, useMemo, useState } from 'react'
import type { CleanupAdvisorItem, SmartCleanupPlan } from '../../../shared/contracts'
import { Badge, CodePanel, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { PageTitle } from '../components/PageTitle'

const GB = 1_000_000_000

export function CleanupPage() {
  const [items, setItems] = useState<CleanupAdvisorItem[]>([])
  const [targetGb, setTargetGb] = useState(20)
  const [plan, setPlan] = useState<SmartCleanupPlan | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [output, setOutput] = useState('')

  const loadAdvisor = async () => {
    try {
      setItems(await window.dockerApi.cleanup.advisor())
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    }
  }

  const analyzeTarget = async (gb = targetGb) => {
    const safeGb = Math.max(.1, Math.min(100_000, Number(gb) || 0))
    setTargetGb(safeGb)
    setLoadingPlan(true)
    setError('')
    try {
      setPlan(await window.dockerApi.cleanup.plan(Math.round(safeGb * GB)))
    } catch (value) {
      setPlan(null)
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoadingPlan(false)
    }
  }

  useEffect(() => {
    void loadAdvisor()
    void analyzeTarget(20)
  }, [])

  const selectedSteps = useMemo(
    () => plan?.steps.filter(step => step.selected) ?? [],
    [plan]
  )

  const runPlan = async () => {
    if (!plan || !selectedSteps.length) return

    const stepList = selectedSteps.map(step => `• ${step.title}: ${step.estimated}`).join('\n')
    const targetStatus = plan.achievable
      ? `Estimated plan reaches the ${plan.target} target with ${plan.selected} potential reclaim.`
      : `Target cannot currently be reached. Maximum estimated potential is ${plan.potential}; shortfall ${plan.shortfall}.`

    const confirmed = window.confirm(
      `Smart Cleanup Plan\n\nTarget: ${plan.target}\n${targetStatus}\n\n${stepList}\n\nVolumes are excluded.\nActual reclaimed space can differ because Docker layers may be shared.\n\nQueue this plan in Task Center?`
    )
    if (!confirmed) return

    setRunning(true)
    setError('')
    try {
      const task = await window.dockerApi.tasks.enqueue({
        kind: 'smart-cleanup',
        cleanupSteps: selectedSteps.map(step => step.key),
        targetBytes: plan.targetBytes,
        sourcePage: 'cleanup',
        resourceName: `Target ${plan.target}`
      })
      setOutput(`Queued in Task Center: ${task.title}\nEstimated reclaim: ${plan.selected}\nTarget: ${plan.target}`)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setRunning(false)
    }
  }

  const progress = plan && plan.targetBytes > 0
    ? Math.min(100, plan.selectedBytes / plan.targetBytes * 100)
    : 0

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="cleanup"
          title="Smart Cleanup Planner"
          subtitle="Set a free-space target and build the lowest-risk Docker cleanup plan needed to reach it."
        />
        <button className="button secondary" onClick={() => {
          void loadAdvisor()
          void analyzeTarget()
        }}>Analyze again</button>
      </div>

      {error && <InlineAlert tone="danger" title="Cleanup analysis failed">{error}</InlineAlert>}

      <section className="card smart-cleanup-target-card">
        <div className="section-row">
          <div>
            <div className="eyebrow">Free-space goal</div>
            <h2>How much space do you want to reclaim?</h2>
            <p className="muted">
              Smart Cleanup chooses lower-risk categories first and adds broader cleanup only when the target requires it.
            </p>
          </div>
          <Badge tone="ok">Volumes excluded</Badge>
        </div>

        <div className="smart-cleanup-target-input">
          <label>
            <span>Target reclaim</span>
            <div className="smart-cleanup-number">
              <input
                type="number"
                min=".1"
                max="100000"
                step=".5"
                value={targetGb}
                onChange={event => setTargetGb(Number(event.target.value))}
                onKeyDown={event => {
                  if (event.key === 'Enter') void analyzeTarget()
                }}
                aria-label="Target reclaim in gigabytes"
              />
              <strong>GB</strong>
            </div>
          </label>
          <div className="smart-cleanup-presets" aria-label="Cleanup target presets">
            {[5, 10, 20, 50].map(value => (
              <button
                className={`button secondary ${targetGb === value ? 'active' : ''}`}
                key={value}
                onClick={() => void analyzeTarget(value)}
              >
                {value} GB
              </button>
            ))}
          </div>
          <button className="button primary" disabled={loadingPlan} onClick={() => void analyzeTarget()}>
            {loadingPlan ? 'Planning…' : 'Build plan'}
          </button>
        </div>
      </section>

      {loadingPlan ? (
        <section className="card">
          <LoadingState label="Building Smart Cleanup plan" rows={6} />
        </section>
      ) : plan ? (
        <>
          <section className={`card smart-cleanup-plan ${plan.achievable ? 'achievable' : 'shortfall'}`}>
            <div className="section-row">
              <div>
                <div className="eyebrow">Target-based execution plan</div>
                <h2>{plan.achievable ? `Target reachable: ${plan.target}` : `Target exceeds current cleanup potential`}</h2>
                <p className="muted">
                  Generated {formatDate(plan.generatedAt)} · estimates are based on current Docker metadata.
                </p>
              </div>
              <Badge tone={plan.achievable ? 'ok' : 'warn'}>
                {plan.achievable ? 'Target reachable' : `${plan.shortfall} short`}
              </Badge>
            </div>

            <div className="smart-cleanup-summary-grid">
              <PlanMetric label="Target" value={plan.target} />
              <PlanMetric label="Selected plan" value={plan.selected} />
              <PlanMetric label="Total potential" value={plan.potential} />
              <PlanMetric
                label={plan.achievable ? 'Headroom' : 'Shortfall'}
                value={plan.achievable ? formatBytes(Math.max(0, plan.selectedBytes - plan.targetBytes)) : plan.shortfall}
                tone={plan.achievable ? 'ok' : 'warn'}
              />
            </div>

            <div className="smart-cleanup-progress" aria-label={`Estimated plan covers ${Math.round(progress)} percent of target`}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="smart-cleanup-plan-table-wrap">
              <table className="smart-cleanup-plan-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Cleanup category</th>
                    <th>Risk</th>
                    <th>Estimated reclaim</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.steps.map(step => (
                    <tr key={step.key} className={step.selected ? 'selected-plan-step' : ''}>
                      <td>
                        {step.selected
                          ? <Badge tone="ok">Included</Badge>
                          : <Badge tone="neutral">Not needed</Badge>}
                      </td>
                      <td>
                        <strong>{step.title}</strong>
                        <code>{step.commandSummary}</code>
                      </td>
                      <td><Badge tone={step.risk === 'low' ? 'ok' : 'warn'}>{step.risk} risk</Badge></td>
                      <td><strong>{step.estimated}</strong></td>
                      <td className="muted">{step.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!plan.achievable && (
              <div className="smart-cleanup-shortfall">
                <strong>Current Docker cleanup candidates cannot satisfy this target.</strong>
                <span>
                  The planner found approximately {plan.potential} reclaimable without touching persistent volumes.
                  Reduce the target, inspect large volumes separately, or review host/VHDX usage. Volumes will not be added automatically.
                </span>
              </div>
            )}

            <div className="smart-cleanup-excluded">
              {plan.excluded.map(item => (
                <div key={item.key}>
                  <Badge tone="danger">Excluded</Badge>
                  <span><strong>{item.title}</strong>{item.reason}</span>
                </div>
              ))}
            </div>

            <footer className="smart-cleanup-plan-footer">
              <div>
                <strong>Estimated reclaim: {plan.selected}</strong>
                <span>
                  Actual reclaimed space is measured by Docker after execution and can differ due to shared image/build layers.
                </span>
              </div>
              <button className="button primary" disabled={running || !selectedSteps.length} onClick={() => void runPlan()}>
                {running
                  ? 'Queueing…'
                  : plan.achievable
                    ? `Run plan for ${plan.target}`
                    : `Run available ${plan.selected} plan`}
              </button>
            </footer>
          </section>

          <section className="card smart-cleanup-example">
            <div className="section-row">
              <div>
                <div className="eyebrow">Plan preview</div>
                <h2>Selected reclaim sequence</h2>
              </div>
              <Badge tone="info">Lowest risk first</Badge>
            </div>
            <pre>{[
              `Target:              ${plan.target}`,
              '',
              ...selectedSteps.map(step => `${step.title.padEnd(22)} ${step.estimated.padStart(10)}`),
              '----------------------------------',
              `Potential:           ${plan.selected}`
            ].join('\n')}</pre>
          </section>
        </>
      ) : (
        <EmptyState title="No cleanup plan" text="Enter a reclaim target and build a plan." />
      )}

      <section className="card smart-cleanup-inventory">
        <div className="section-row">
          <div>
            <div className="eyebrow">Raw advisor inventory</div>
            <h2>Current cleanup categories</h2>
          </div>
        </div>
        <div className="advisor-list embedded">
          {items.map(item => (
            <div className="advisor-row" key={item.key}>
              <div>
                <div className="advisor-title">
                  {item.title}
                  <Badge tone={item.risk === 'low' ? 'ok' : item.risk === 'medium' ? 'warn' : 'danger'}>{item.risk} risk</Badge>
                </div>
                <div className="muted">{item.reason}</div>
              </div>
              <div className="advisor-space">
                <span>Reclaimable</span>
                <strong>{item.reclaimable}</strong>
                {item.key === 'volumes'
                  ? <small>Never auto-planned</small>
                  : item.includedInSafe && <small>Low-risk candidate</small>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {output && <CodePanel title="Task Center" value={output} />}
    </div>
  )
}

function PlanMetric({
  label,
  value,
  tone = 'neutral'
}: {
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {tone !== 'neutral' && <Badge tone={tone}>{tone === 'ok' ? 'Covered' : 'Attention'}</Badge>}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
