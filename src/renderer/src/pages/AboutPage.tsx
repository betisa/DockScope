import { useEffect, useState } from 'react'
import type {
  AppRuntimeInfo,
  ReleaseChannel,
  ReleaseNotesDocument,
  UpdateState
} from '../../../shared/contracts'
import { Badge, EmptyState, InlineAlert, LoadingState } from '../components/ui'
import { PageTitle } from '../components/PageTitle'
import dockscopeLogoUrl from '../assets/dockscope-banner.png'

export function AboutPage() {
  const [runtime, setRuntime] = useState<AppRuntimeInfo | null>(null)
  const [notes, setNotes] = useState<ReleaseNotesDocument | null>(null)
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const [runtimeInfo, releaseNotes, updateState] = await Promise.all([
        window.dockerApi.about.runtime(),
        window.dockerApi.about.releaseNotes(),
        window.dockerApi.updates.state()
      ])
      setRuntime(runtimeInfo)
      setNotes(releaseNotes)
      setUpdate(updateState)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    }
  }

  useEffect(() => {
    void load()
    return window.dockerApi.updates.onChanged(setUpdate)
  }, [])

  const setChannel = async (channel: ReleaseChannel) => {
    if (!update || update.channel === channel) return
    setBusy('channel')
    setError('')
    try {
      const next = await window.dockerApi.updates.setChannel(channel)
      setUpdate(next)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setBusy('')
    }
  }

  const check = async () => {
    setBusy('check')
    setError('')
    try {
      setUpdate(await window.dockerApi.updates.check())
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setBusy('')
    }
  }

  const download = async () => {
    setBusy('download')
    setError('')
    try {
      setUpdate(await window.dockerApi.updates.download())
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setBusy('')
    }
  }

  const install = async () => {
    if (!update?.canInstall) return
    if (!window.confirm(
      `Install DockScope ${update.availableVersion || 'update'} now?\n\n` +
      'The application will close and restart. Any active Docker operation should be allowed to finish first.'
    )) return

    setBusy('install')
    setError('')
    try {
      await window.dockerApi.updates.install()
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
      setBusy('')
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle
          page="about"
          title="About & Updates"
          subtitle="Application/runtime versions, release notes, release channel and guarded desktop updates."
        />
        <button className="button secondary" onClick={() => void load()}>Refresh runtime</button>
      </div>

      {error && <InlineAlert tone="danger" title="About / Update error">{error}</InlineAlert>}

      {!runtime || !update ? (
        <section className="card"><LoadingState label="Loading application information" rows={7} /></section>
      ) : (
        <>
          <section className="about-hero card">
            <div className="about-product">
              <div className="about-version-mark dockscope-about-mark"><img src={dockscopeLogoUrl} alt="DockScope" /></div>
              <div>
                <div className="eyebrow">DockScope Desktop</div>
                <h2>Version {runtime.appVersion}</h2>
                <p>
                  Docker Operations & Intelligence: inspect, diagnose, optimize and safely operate Docker Desktop environments.
                </p>
                <div className="inline-actions">
                  <Badge tone="ok">{runtime.packaged ? 'Packaged build' : 'Development build'}</Badge>
                  {runtime.portable && <Badge tone="warn">Portable</Badge>}
                  <Badge tone="info">{update.channel === 'preview' ? 'Preview channel' : 'Stable channel'}</Badge>
                </div>
              </div>
            </div>
            <div className="about-runtime-grid">
              <RuntimeFact label="Electron" value={runtime.electronVersion} />
              <RuntimeFact label="Node.js" value={runtime.nodeVersion} />
              <RuntimeFact label="Chromium" value={runtime.chromeVersion} />
              <RuntimeFact label="Docker Engine" value={runtime.dockerVersion} />
              <RuntimeFact label="Docker Compose" value={runtime.dockerComposeVersion} />
              <RuntimeFact label="Docker Context" value={runtime.dockerContext} />
              <RuntimeFact label="Platform" value={`${runtime.platform} / ${runtime.arch}`} />
              <RuntimeFact label="Update target" value={runtime.portable ? 'Portable — manual update' : 'NSIS installed build'} />
            </div>
          </section>

          <section className="card update-workspace">
            <div className="section-row">
              <div>
                <div className="eyebrow">Release channel</div>
                <h2>Choose update stability</h2>
                <p className="muted">
                  Stable receives production releases. Preview can receive beta releases as well as newer stable releases.
                </p>
              </div>
              <div className="segmented-control" role="group" aria-label="Release channel">
                <button
                  className={update.channel === 'stable' ? 'active' : ''}
                  disabled={busy === 'channel'}
                  onClick={() => void setChannel('stable')}
                  aria-pressed={update.channel === 'stable'}
                >
                  Stable
                </button>
                <button
                  className={update.channel === 'preview' ? 'active' : ''}
                  disabled={busy === 'channel'}
                  onClick={() => void setChannel('preview')}
                  aria-pressed={update.channel === 'preview'}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className="update-status-grid">
              <UpdateMetric label="Current version" value={update.currentVersion} />
              <UpdateMetric label="Available version" value={update.availableVersion || '—'} />
              <UpdateMetric label="Status" value={statusLabel(update)} />
              <UpdateMetric label="Channel" value={update.channel === 'preview' ? 'Preview / beta' : 'Stable / latest'} />
            </div>

            {!update.updateBaseUrlConfigured && (
              <InlineAlert tone="warning" title="Update source is not configured">
                Configure `DSM_UPDATE_BASE_URL` or `build/update-config.json` before producing the release build.
                The About/runtime information remains available, but update check/download/install stays disabled.
              </InlineAlert>
            )}

            {update.portable && (
              <InlineAlert tone="warning" title="Portable build">
                Portable packages cannot self-install an update. Use the installed NSIS build for automatic download/install.
              </InlineAlert>
            )}

            {!update.packaged && (
              <InlineAlert tone="info" title="Development build">
                Auto-update is intentionally disabled during development. Package the NSIS application to test the real update flow.
              </InlineAlert>
            )}

            {update.status === 'error' && update.error && (
              <InlineAlert tone="danger" title="Update failed">{update.error}</InlineAlert>
            )}

            {update.status === 'downloading' && (
              <div className="update-download-progress">
                <div className="update-progress-label">
                  <strong>Downloading {update.availableVersion || 'update'}</strong>
                  <span>{Math.round(update.percent)}% · {formatBytes(update.transferred)} / {formatBytes(update.total)} · {formatBytes(update.bytesPerSecond)}/s</span>
                </div>
                <div className="task-progress-track" aria-label={`Update download ${Math.round(update.percent)} percent`}>
                  <span style={{ width:`${Math.max(0, Math.min(100, update.percent))}%` }} />
                </div>
              </div>
            )}

            <div className="update-actions">
              <button
                className="button secondary"
                disabled={!update.canCheck || busy === 'check' || update.status === 'checking' || update.status === 'downloading'}
                onClick={() => void check()}
              >
                {update.status === 'checking' || busy === 'check' ? 'Checking…' : 'Check for updates'}
              </button>

              <button
                className="button primary"
                disabled={!update.canDownload || busy === 'download' || update.status === 'downloading'}
                onClick={() => void download()}
              >
                {update.status === 'downloading' || busy === 'download' ? 'Downloading…' : 'Download update'}
              </button>

              <button
                className="button danger"
                disabled={!update.canInstall || busy === 'install'}
                onClick={() => void install()}
              >
                {busy === 'install' ? 'Restarting…' : 'Install & Restart'}
              </button>
            </div>
          </section>

          {update.availableVersion && (update.releaseName || update.releaseDate || update.releaseNotes) && (
            <section className="card available-release-notes">
              <div className="section-row">
                <div>
                  <div className="eyebrow">Available release</div>
                  <h2>{update.releaseName || `DockScope ${update.availableVersion}`}</h2>
                  <p className="muted">{update.releaseDate ? formatDate(update.releaseDate) : `Version ${update.availableVersion}`}</p>
                </div>
                <Badge tone={update.channel === 'preview' ? 'warn' : 'ok'}>
                  {update.channel === 'preview' ? 'Preview' : 'Stable'}
                </Badge>
              </div>
              {update.releaseNotes
                ? <pre className="release-notes-remote">{update.releaseNotes}</pre>
                : <EmptyState title="No remote release notes" text="The update metadata did not include release notes." />}
            </section>
          )}

          <section className="card current-release-notes">
            <div className="section-row">
              <div>
                <div className="eyebrow">Current release notes</div>
                <h2>{notes?.title ?? `DockScope ${runtime.appVersion}`}</h2>
                <p className="muted">{notes?.date ?? ''}</p>
              </div>
              {notes && <Badge tone={notes.channel === 'preview' ? 'warn' : 'ok'}>{notes.channel}</Badge>}
            </div>

            {notes ? (
              <div className="release-note-columns">
                <div>
                  <h3>Highlights</h3>
                  <ul>{notes.highlights.map((item,index) => <li key={index}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Security</h3>
                  <ul>{notes.security.map((item,index) => <li key={index}>{item}</li>)}</ul>
                </div>
              </div>
            ) : (
              <EmptyState title="No bundled release notes" text="Release notes are not available for this build." />
            )}
          </section>

          <section className="card update-safety-card">
            <div className="section-row">
              <div><div className="eyebrow">Update safety</div><h2>Installation boundary</h2></div>
              <Badge tone="info">Main process only</Badge>
            </div>
            <div className="update-safety-grid">
              <span><strong>Renderer</strong>Shows status and sends typed update intents only.</span>
              <span><strong>Main</strong>Owns feed selection, download and installer execution.</span>
              <span><strong>Download</strong>Uses electron-updater metadata/checksum verification.</span>
              <span><strong>Install</strong>Requires an explicit Install & Restart action after download.</span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function RuntimeFact({ label, value }: { label:string; value:string }) {
  return <div><span>{label}</span><strong>{value || '—'}</strong></div>
}

function UpdateMetric({ label, value }: { label:string; value:string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function statusLabel(update: UpdateState) {
  const labels: Record<UpdateState['status'], string> = {
    idle:'Ready',
    checking:'Checking…',
    available:'Update available',
    'not-available':'Up to date',
    downloading:'Downloading',
    downloaded:'Ready to install',
    error:'Error',
    unsupported:'Unavailable'
  }
  return labels[update.status]
}

function formatBytes(bytes:number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units=['B','KB','MB','GB','TB']
  let value=bytes,index=0
  while(value>=1024 && index<units.length-1){value/=1024;index++}
  return `${value.toFixed(index===0?0:value>=10?1:2)} ${units[index]}`
}

function formatDate(value:string) {
  const date=new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
