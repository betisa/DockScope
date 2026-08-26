import { useEffect, useMemo, useState } from 'react'
import type { ContainerDirectoryListing, ContainerFileEntry, ContainerTextFile } from '../../../shared/contracts'
import { Badge, EmptyState, InlineAlert, LoadingState } from './ui'
import { AppIcon } from './Icon'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Download04Icon,
  File01Icon,
  Folder02Icon,
  FolderOpenIcon,
  GridViewIcon,
  Home01Icon,
  Link01Icon,
  ListViewIcon,
  RefreshIcon,
  Search01Icon,
  Upload04Icon
} from '@hugeicons/core-free-icons'

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
  const [rootListing, setRootListing] = useState<ContainerDirectoryListing | null>(null)
  const [selected, setSelected] = useState<ContainerFileEntry | null>(null)
  const [recentEntries, setRecentEntries] = useState<ContainerFileEntry[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
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
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const next = await window.dockerApi.containers.files.list(containerId, nextPath)
      setListing(next)
      setPath(next.path)
      setAddress(next.path)
      setSearch('')
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
    void loadDirectory(initialPath || '/')
    void window.dockerApi.containers.files.list(containerId, '/').then(setRootListing).catch(() => setRootListing(null))
  }, [containerId, running])

  const openEntry = async (entry: ContainerFileEntry) => {
    setSelected(entry)
    setMessage('')
    setError('')
    setRecentEntries(old => [entry, ...old.filter(item => item.path !== entry.path)].slice(0, 6))

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

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return listing?.entries ?? []
    return (listing?.entries ?? []).filter(entry => `${entry.name} ${entry.path}`.toLowerCase().includes(query))
  }, [listing, search])

  const rootDirectories = useMemo(
    () => (rootListing?.entries ?? []).filter(entry => entry.type === 'directory'),
    [rootListing]
  )

  return (
    <div className="container-file-browser">
      {!running && (
        <InlineAlert tone="warning" title="Container is stopped">
          Files can still be browsed and downloaded from stopped containers through Docker. Start the container to upload files or save text changes.
        </InlineAlert>
      )}
      <div className="file-browser-security-banner">
        <strong>Guarded filesystem access.</strong>
        <span>
          Browse, view, download and copy-path are read-only. Upload and text save require a Main-process confirmation and are blocked for read-only mounts.
        </span>
      </div>

      <div className="file-browser-toolbar">
        <div className="file-browser-navigation">
          <button className="file-browser-icon-button" disabled={path === '/' || loading} onClick={() => listing && void loadDirectory(listing.parentPath)} aria-label="Go to parent directory" title="Go to parent directory">
            <AppIcon icon={ArrowLeft01Icon} />
          </button>
          <button className="file-browser-icon-button" disabled aria-label="Go forward" title="Go forward">
            <AppIcon icon={ArrowRight01Icon} />
          </button>
          <button className="file-browser-icon-button" disabled={path === '/' || loading} onClick={() => listing && void loadDirectory(listing.parentPath)} aria-label="Go up one directory" title="Go up one directory">
            <AppIcon icon={ArrowUp01Icon} />
          </button>
          <button className="file-browser-icon-button" disabled={loading} onClick={refresh} aria-label="Refresh directory" title="Refresh directory">
            <AppIcon icon={RefreshIcon} />
          </button>
        </div>
        <div className="file-browser-address">
          <AppIcon icon={FolderOpenIcon} size={15} />
          <input value={address} onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void loadDirectory(address) }} aria-label="Container filesystem path" spellCheck={false} />
          <button className="button secondary" disabled={loading} onClick={() => void loadDirectory(address)}>Go</button>
        </div>
        <div className="file-browser-toolbar-actions">
          <label className="file-browser-search">
            <AppIcon icon={Search01Icon} size={15} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search files…" aria-label="Search files" />
          </label>
          <div className="file-browser-view-switcher" role="group" aria-label="File view">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" title="Grid view"><AppIcon icon={GridViewIcon} size={15} /></button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" title="List view"><AppIcon icon={ListViewIcon} size={15} /></button>
          </div>
          <button
            className="button secondary"
             disabled={mutating || writeBlocked || !running}
            onClick={() => void upload()}
            title={writeBlocked ? 'Upload is blocked inside a read-only mount.' : 'Choose a local file and confirm upload in the system dialog.'}
          >
            <AppIcon icon={Upload04Icon} size={15} />
            Upload
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
        <aside className="card file-browser-sidebar" aria-label="File browser navigation">
          <section className="file-browser-sidebar-section">
            <div className="file-browser-sidebar-label">Recent</div>
            {recentEntries.length ? recentEntries.map(entry => <button key={`recent-${entry.path}`} className="file-browser-sidebar-item" onClick={() => void openEntry(entry)}><AppIcon icon={entry.type === 'directory' ? Folder02Icon : File01Icon} size={14} /><span>{entry.name}</span></button>) : <span className="file-browser-sidebar-empty">No recent files</span>}
          </section>
          <section className="file-browser-sidebar-section">
            <div className="file-browser-sidebar-label">Folder shortcuts</div>
            <button className="file-browser-sidebar-item" onClick={() => void loadDirectory('/')}><AppIcon icon={Home01Icon} size={14} /><span>Root filesystem</span></button>
            {initialPath && initialPath !== '/' && <button className="file-browser-sidebar-item" onClick={() => void loadDirectory(initialPath)}><AppIcon icon={FolderOpenIcon} size={14} /><span>{initialPath}</span></button>}
          </section>
          <section className="file-browser-sidebar-section file-browser-directories">
            <div className="file-browser-sidebar-label">Directories</div>
            {rootDirectories.length ? rootDirectories.map(entry => <button key={entry.path} className={`file-browser-sidebar-item ${path === entry.path ? 'active' : ''}`} onClick={() => void loadDirectory(entry.path)}><AppIcon icon={Folder02Icon} size={14} /><span>{entry.name}</span></button>) : <span className="file-browser-sidebar-empty">Loading directories…</span>}
          </section>
        </aside>
        <section className="card file-browser-list-panel">
          <div className="section-row compact">
            <div>
              <div className="eyebrow">Filesystem</div>
              <h3>{path}</h3>
            </div>
            <div className="file-browser-list-meta">{listing && <Badge tone="neutral">{visibleEntries.length} items</Badge>}<button className="button secondary" disabled={!selected} onClick={() => selected && void navigator.clipboard.writeText(selected.path)}><AppIcon icon={Copy01Icon} size={14} />Copy path</button></div>
          </div>

          {loading ? (
            <LoadingState label="Reading container directory" rows={8} />
          ) : !visibleEntries.length ? (
            <EmptyState title="Directory is empty" text="No visible filesystem entries were returned for this path." />
          ) : view === 'grid' ? (
            <div className="file-browser-grid" aria-label="Container files">
              {visibleEntries.map(entry => <button key={entry.path} className={`file-browser-tile ${entry.type} ${selected?.path === entry.path ? 'selected' : ''}`} onClick={() => void openEntry(entry)} title={entry.path}>
                <AppIcon icon={entry.type === 'directory' ? Folder02Icon : entry.type === 'symlink' ? Link01Icon : File01Icon} size={32} />
                <strong>{entry.name}</strong>
                <small>{entry.type === 'directory' ? 'Directory' : formatBytes(entry.sizeBytes)}</small>
              </button>)}
            </div>
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
                  {visibleEntries.map(entry => (
                    <tr
                      key={entry.path}
                      className={selected?.path === entry.path ? 'selected-row' : ''}
                      onDoubleClick={() => void openEntry(entry)}
                    >
                      <td>
                          <button className="file-entry-name" onClick={() => void openEntry(entry)}>
                          <span className={`file-entry-icon ${entry.type}`} aria-hidden="true">
                            <AppIcon icon={entry.type === 'directory' ? Folder02Icon : entry.type === 'symlink' ? Link01Icon : File01Icon} size={17} />
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
                          {entry.type === 'file' && <button className="link-button" onClick={() => void download(entry)}><AppIcon icon={Download04Icon} size={13} />Download</button>}
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
                  <button className="button secondary" onClick={() => void navigator.clipboard.writeText(textFile.path)}><AppIcon icon={Copy01Icon} size={14} />Copy path</button>
                  <button className="button secondary" disabled={mutating} onClick={() => void download(selected)}><AppIcon icon={Download04Icon} size={14} />Download</button>
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
                   disabled={!dirty || mutating || textFile.truncated || selectedWriteBlocked || !running}
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
