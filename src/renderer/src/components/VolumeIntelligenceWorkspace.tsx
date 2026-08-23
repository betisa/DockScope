import type { VolumeIntelligence } from '../../../shared/contracts'
import { Badge, EmptyState } from './ui'
import { AppIcon } from './Icon'
import { Database01Icon } from '@hugeicons/core-free-icons'

export function VolumeIntelligenceWorkspace({
  volume,
  onClose,
  onOpenContainer,
  onOpenCompose
}: {
  volume: VolumeIntelligence
  onClose: () => void
  onOpenContainer: (containerId: string, containerName: string) => void
  onOpenCompose: (project: string) => void
}) {
  return (
    <section className="card volume-intelligence-workspace">
      <div className="workspace-titlebar">
        <div className="volume-workspace-heading">
          <span className="volume-workspace-icon"><AppIcon icon={Database01Icon} size={20} /></span>
          <div>
            <div className="eyebrow">Volume Intelligence</div>
            <h2>{volume.name}</h2>
            <p className="muted">{volume.size} · {volume.driver || 'unknown driver'} · {volume.scope || 'unknown scope'}</p>
          </div>
        </div>
        <div className="inline-actions">
          <RiskBadge volume={volume} />
          <button className="icon-button" onClick={onClose} aria-label="Close volume intelligence">×</button>
        </div>
      </div>

      <div className="volume-intelligence-body">
        <section className="volume-intelligence-summary">
          <Info label="Created" value={formatDate(volume.createdAt)} />
          <Info label="Size" value={volume.size} />
          <Info label="References" value={String(volume.references.length)} />
          <Info label="Compose projects" value={String(volume.composeProjects.length)} />
          <Info label="Risk score" value={`${volume.risk.score}/100`} />
          <Info label="Deletion assessment" value={assessmentLabel(volume.risk.deletionAssessment)} />
        </section>

        <section className="card volume-intelligence-section">
          <div className="section-row compact">
            <div><div className="eyebrow">Ownership</div><h3>Container & Compose references</h3></div>
            <Badge tone={volume.references.length ? 'warn' : 'neutral'}>{volume.references.length} references</Badge>
          </div>

          {!volume.references.length ? (
            <EmptyState
              title="No current container references"
              text="Docker does not currently report a container mounting this volume. Review ownership and backups before deletion."
            />
          ) : (
            <div className="table-card">
              <table>
                <thead><tr><th>Container</th><th>Compose</th><th>Image</th><th>Destination</th><th>Mode</th><th>State</th></tr></thead>
                <tbody>{volume.references.map(reference => (
                  <tr key={`${reference.containerId}-${reference.destination}`}>
                    <td>
                      <button className="resource-link" onClick={() => onOpenContainer(reference.containerId, reference.containerName)}>
                        <strong>{reference.containerName || reference.containerId.slice(0,12)}</strong>
                        <span className="mono">{reference.containerId.slice(0,12)}</span>
                      </button>
                    </td>
                    <td>
                      {reference.composeProject ? (
                        <button className="resource-link compact" onClick={() => onOpenCompose(reference.composeProject)}>
                          <strong>{reference.composeProject}</strong>
                          <span>{reference.composeService || 'Compose service'}</span>
                        </button>
                      ) : <span className="muted">Standalone</span>}
                    </td>
                    <td className="mono wrap">{reference.image || '—'}</td>
                    <td className="mono wrap">{reference.destination || '—'}</td>
                    <td><Badge tone={reference.readWrite ? 'warn' : 'ok'}>{reference.readWrite ? 'Read/Write' : 'Read only'}</Badge></td>
                    <td><Badge tone={reference.containerState === 'running' ? 'ok' : 'neutral'}>{reference.containerState || 'unknown'}</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <div className="volume-intelligence-grid">
          <section className="card volume-intelligence-section">
            <div className="section-row compact">
              <div><div className="eyebrow">Workload detection</div><h3>Detected data role</h3></div>
            </div>
            {!volume.workloads.length ? (
              <EmptyState title="No workload signature" text="No known database or storage signature was detected from current Docker metadata." />
            ) : (
              <div className="volume-workload-list">
                {volume.workloads.map(workload => (
                  <article className="volume-workload" key={workload.kind}>
                    <div className="section-row compact">
                      <strong>{workload.label}</strong>
                      <Badge tone={workload.confidence === 'high' ? 'danger' : workload.confidence === 'medium' ? 'warn' : 'info'}>
                        {workload.confidence} confidence
                      </Badge>
                    </div>
                    <ul>{workload.evidence.map((item,index) => <li key={index}>{item}</li>)}</ul>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card volume-intelligence-section">
            <div className="section-row compact">
              <div><div className="eyebrow">Risk</div><h3>Deletion assessment</h3></div>
              <RiskBadge volume={volume} />
            </div>
            <div className="volume-risk-score">
              <strong>{volume.risk.score}</strong><span>/100</span>
            </div>
            <ul className="volume-risk-reasons">
              {volume.risk.reasons.map((reason,index) => <li key={index}>{reason}</li>)}
            </ul>
          </section>
        </div>

        <section className="card volume-intelligence-section">
          <div className="section-row compact">
            <div><div className="eyebrow">Backup readiness</div><h3>Before any deletion</h3></div>
          </div>
          <div className="warning-banner">
            <strong>Metadata is not a backup.</strong> Validate a real export, database backup, object replication, or storage snapshot before deleting persistent data.
          </div>
          <ul className="volume-backup-hints">
            {volume.risk.backupHints.map((hint,index) => <li key={index}>{hint}</li>)}
          </ul>
        </section>

        <div className="volume-intelligence-grid">
          <section className="card volume-intelligence-section">
            <div className="section-row compact"><div><div className="eyebrow">Docker metadata</div><h3>Labels</h3></div></div>
            <KeyValues values={volume.labels} empty="No volume labels." />
          </section>
          <section className="card volume-intelligence-section">
            <div className="section-row compact"><div><div className="eyebrow">Driver configuration</div><h3>Options</h3></div></div>
            <KeyValues values={volume.options} empty="No volume driver options." />
          </section>
        </div>

        <section className="card volume-intelligence-section">
          <div className="section-row compact"><div><div className="eyebrow">Host metadata</div><h3>Mount point</h3></div></div>
          <code className="volume-mountpoint">{volume.mountpoint || 'Unavailable'}</code>
          <p className="muted">
            This path is Docker Engine metadata. Docker Desktop/WSL2 storage may not be directly accessible as a normal Windows filesystem path.
          </p>
        </section>
      </div>
    </section>
  )
}

function Info({label,value}:{label:string;value:string}) {
  return <div className="card diagnostic-item"><span>{label}</span><strong className="wrap">{value}</strong></div>
}

function RiskBadge({volume}:{volume:VolumeIntelligence}) {
  const tone = volume.risk.level === 'critical' ? 'danger' : volume.risk.level === 'high' ? 'warn' : 'info'
  return <Badge tone={tone}>{volume.risk.level.toUpperCase()} · {assessmentLabel(volume.risk.deletionAssessment)}</Badge>
}

function assessmentLabel(value: VolumeIntelligence['risk']['deletionAssessment']) {
  if (value === 'blocked') return 'Blocked'
  if (value === 'high-risk') return 'High risk'
  return 'Review required'
}

function KeyValues({values,empty}:{values:Record<string,string>;empty:string}) {
  const entries=Object.entries(values)
  if (!entries.length) return <div className="muted volume-empty-inline">{empty}</div>
  return <div className="volume-key-values">{entries.map(([key,value]) => (
    <div className="volume-key-value" key={key}><code>{key}</code><span className="mono wrap">{value || '—'}</span></div>
  ))}</div>
}

function formatDate(value:string) {
  if (!value) return '—'
  const date=new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
