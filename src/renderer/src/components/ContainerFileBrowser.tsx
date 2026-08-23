import { useEffect, useMemo, useState } from 'react'
import type { ContainerDirectoryListing, ContainerFileEntry, ContainerTextFile } from '../../../shared/contracts'
import { Badge, EmptyState, InlineAlert, LoadingState } from './ui'

export function ContainerFileBrowser({
  containerId,
  running,
  initialPath = '/'
}: {
  containerId: string
  running: boolean
  initialPath?: string
}) {
  const [path, setPath] = useState(initialPath || '/')
  const [address, setAddress] = useState(initialPath || '/')
  const [listing, setListing] = useState<ContainerDirectoryListing | null>(null)
  const [selected, setSelected] = useState<ContainerFileEntry | null>(null)
  const [textFile, setTextFile] = useState<ContainerTextFile | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const writeBlocked = Boolean(listing?.mountDestination) && !listing?.writableMount
  const selectedWriteBlocked = Boolean(textFile?.mountDestination) && !textFile?.writableMount

  const loadDirectory = async (nextPath: string) => {
    if (!running) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const next = await window.dockerApi.containers.files.list(containerId, nextPath)
      setListing(next)
      setPath(next.path)
      setAddress(next.path)
      setSelected(null)
      setTextFile(null)
      setEditorValue('')
      setDirty(false)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (running) void loadDirectory(initialPath || '/')
  }, [containerId, running])

  const openEntry = async (entry: ContainerFileEntry) => {
    setSelected(entry)
    setMessage('')
    setError('')

    if (entry.type === 'directory') {
      await loadDirectory(entry.path)
      return
    }

    if (entry.type !== 'file') {
      setTextFile(null)
      setEditorValue('')
      setDirty(false)
      return
    }

    setFileLoading(true)
    try {
      const file = await window.dockerApi.containers.files.readText(containerId, entry.path)
      setTextFile(file)
      setEditorValue(file.content)
      setDirty(false)
    } catch (value) {
      setTextFile(null)
      setEditorValue('')
      setDirty(false)
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setFileLoading(false)
    }
  }

  const refresh = () => void loadDirectory(path)

  const download = async (entry = selected) => {
    if (!entry || entry.type !== 'file') return
    setMutating(true)
    setError('')
    try {
      const result = await window.dockerApi.containers.files.download(containerId, entry.path)
      setMessage(result.message + (result.path ? ` ${result.path}` : ''))
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setMutating(false)
    }
  }

  const upload = async () => {
    setMutating(true)
    setError('')
    setMessage('')
    try {
      const result = await window.dockerApi.containers.files.upload(containerId, path)
      setMessage(result.message)
      if (result.ok) await loadDirectory(path)
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setMutating(false)
    }
  }

  const saveText = async () => {
    if (!textFile || textFile.truncated || selectedWriteBlocked || !dirty) return
    setMutating(true)
    setError('')
    setMessage('')
    try {
      const result = await window.dockerApi.containers.files.writeText(containerId, textFile.path, editorValue)
      setMessage(result.message)
      if (result.ok) {
        setDirty(false)
        const refreshed = await window.dockerApi.containers.files.readText(containerId, textFile.path)
        setTextFile(refreshed)
        setEditorValue(refreshed.content)
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value))
    } finally {
      setMutating(false)
    }
  }

  const breadcrumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean)
    const rows = [{ label:'/', path:'/' }]
    let current = ''
    for (const part of parts) {
      current += `/${part}`
      rows.push({ label:part, path:current })
    }
    return rows
  }, [path])

  if (!running) {
    return (
      <div>
        <InlineAlert tone="warning" title="File browsing requires a running container">
          Container File Browser uses a fixed read-only shell script for directory enumeration. Start the container to browse or view files.
        </InlineAlert>
        <EmptyState
          title="Container is stopped"
          text="Start the container and reopen Files. Download through docker cp can work for stopped containers, but directory browsing is intentionally unavailable here."
        />
      </div>
    )
  }

  return (
    <div className="container-file-browser">
      <div className="file-browser-security-banner">
        <strong>Guarded filesystem access.</strong>
        <span>
          Browse, view, download and copy-path are read-only. Upload and text save require a Main-process confirmation and are blocked for read-only mounts.
        </span>
      </div>

      <div className="file-browser-toolbar">
        <div className="file-browser-address">
          <button
            className="button secondary"
            disabled={path === '/' || loading}
            onClick={() => listing && void loadDirectory(listing.parentPath)}
            aria-label="Go to parent directory"
          >
            Up
          </button>
          <input
            value={address}
            onChange={event => setAddress(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void loadDirectory(address)
            }}
            aria-label="Container filesystem path"
            spellCheck={false}
          />
          <button className="button secondary" disabled={loading} onClick={() => void loadDirectory(address)}>Go</button>
          <button className="button secondary" disabled={loading} onClick={refresh}>Refresh</button>
        </div>
        <div className="inline-actions">
          <button
            className="button secondary"
            disabled={mutating || writeBlocked}
            onClick={() => void upload()}
            title={writeBlocked ? 'Upload is blocked inside a read-only mount.' : 'Choose a local file and confirm upload in the system dialog.'}
          >
            Upload…
          </button>
          <button
            className="button secondary"
            disabled={!selected}
            onClick={() => selected && void navigator.clipboard.writeText(selected.path)}
          >
            Copy path
          </button>
        </div>
      </div>

      <nav className="file-browser-breadcrumbs" aria-label="Container filesystem breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path}>
            {index > 0 && <i>/</i>}
            <button onClick={() => void loadDirectory(crumb.path)}>{crumb.label}</button>
          </span>
        ))}
      </nav>

      {listing && (
        <div className={`file-browser-path-warning ${listing.mountDestination ? (listing.writableMount ? 'persistent' : 'readonly') : 'ephemeral'}`}>
          <Badge tone={listing.mountDestination ? (listing.writableMount ? 'warn' : 'neutral') : 'info'}>
            {listing.mountDestination ? (listing.writableMount ? 'RW mount' : 'Read-only mount') : 'Container layer'}
          </Badge>
          <span>{listing.warning}</span>
        </div>
      )}

      {error && <InlineAlert tone="danger" title="File Browser error">{error}</InlineAlert>}
      {message && <div className="file-browser-status" role="status">{message}</div>}

      <div className="file-browser-layout">
        <section className="card file-browser-list-panel">
          <div className="section-row compact">
            <div>
              <div className="eyebrow">Filesystem</div>
              <h3>{path}</h3>
            </div>
            {listing && <Badge tone="neutral">{listing.entries.length} entries</Badge>}
          </div>

          {loading ? (
            <LoadingState label="Reading container directory" rows={8} />
          ) : !listing?.entries.length ? (
            <EmptyState title="Directory is empty" text="No visible filesystem entries were returned for this path." />
          ) : (
            <div className="file-browser-table-wrap">
              <table className="file-browser-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Permissions</th>
                    <th>Owner</th>
                    <th>Modified</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {listing.entries.map(entry => (
                    <tr
                      key={entry.path}
                      className={selected?.path === entry.path ? 'selected-row' : ''}
                      onDoubleClick={() => void openEntry(entry)}
                    >
                      <td>
                        <button className="file-entry-name" onClick={() => void openEntry(entry)}>
                          <span className={`file-entry-icon ${entry.type}`} aria-hidden="true">
                            {entry.type === 'directory' ? '▣' : entry.type === 'symlink' ? '↗' : '▤'}
                          </span>
                          <span>
                            <strong>{entry.name}</strong>
                            {entry.symlinkTarget && <small>→ {entry.symlinkTarget}</small>}
                          </span>
                        </button>
                      </td>
                      <td>{entry.type === 'directory' ? '—' : formatBytes(entry.sizeBytes)}</td>
                      <td className="mono">{entry.permissions || '—'}</td>
                      <td>{[entry.owner,entry.group].filter(Boolean).join(':') || '—'}</td>
                      <td>{entry.modifiedAt ? formatDate(entry.modifiedAt) : '—'}</td>
                      <td>
                        <div className="inline-actions">
                          <button className="link-button" onClick={() => void navigator.clipboard.writeText(entry.path)}>Copy path</button>
                          {entry.type === 'file' && <button className="link-button" onClick={() => void download(entry)}>Download</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card file-browser-preview-panel">
          {!selected ? (
            <EmptyState
              title="Select a file"
              text="Choose a regular file to view UTF-8 text, download it, copy its path, or perform a guarded text edit."
            />
          ) : selected.type === 'directory' ? (
            <EmptyState title="Directory selected" text="Open the directory to browse its contents." />
          ) : selected.type !== 'file' ? (
            <EmptyState title={`${selected.type} selected`} text="Text preview is available only for regular files." />
          ) : fileLoading ? (
            <LoadingState label="Reading file preview" rows={8} />
          ) : textFile ? (
            <>
              <div className="file-preview-header">
                <div>
                  <div className="eyebrow">Text viewer</div>
                  <h3>{selected.name}</h3>
                  <code>{textFile.path}</code>
                </div>
                <div className="inline-actions">
                  <Badge tone={textFile.truncated ? 'warn' : 'info'}>
                    {textFile.truncated ? 'Preview truncated' : formatBytes(textFile.sizeBytes)}
                  </Badge>
                  <button className="button secondary" onClick={() => void navigator.clipboard.writeText(textFile.path)}>Copy path</button>
                  <button className="button secondary" disabled={mutating} onClick={() => void download(selected)}>Download</button>
                </div>
              </div>

              {textFile.truncated && (
                <InlineAlert tone="warning" title="Large file preview">
                  Only the first 1 MB is shown. Editing is disabled because saving a truncated preview could destroy unseen content.
                </InlineAlert>
              )}

              {textFile.mountDestination && !textFile.writableMount && (
                <InlineAlert tone="warning" title="Read-only mounted file">
                  This file belongs to a read-only mount. Save is blocked.
                </InlineAlert>
              )}

              <textarea
                className="file-text-editor"
                value={editorValue}
                readOnly={textFile.truncated || selectedWriteBlocked}
                onChange={event => {
                  setEditorValue(event.target.value)
                  setDirty(event.target.value !== textFile.content)
                }}
                spellCheck={false}
                aria-label={`Text content of ${textFile.path}`}
              />

              <footer className="file-preview-footer">
                <div>
                  <span>{dirty ? 'Unsaved changes' : 'No local changes'}</span>
                  <small>
                    Save replaces the complete file through a temporary UTF-8 file and guarded docker cp.
                  </small>
                </div>
                <button
                  className="button danger"
                  disabled={!dirty || mutating || textFile.truncated || selectedWriteBlocked}
                  onClick={() => void saveText()}
                >
                  {mutating ? 'Saving…' : 'Save text…'}
                </button>
              </footer>
            </>
          ) : (
            <EmptyState title="Preview unavailable" text="The file could not be read as a regular text file." />
          )}
        </section>
      </div>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
