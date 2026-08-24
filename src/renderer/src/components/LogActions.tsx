import { useEffect, useRef, useState } from 'react'
import { Copy01Icon, FileExportIcon } from '@hugeicons/core-free-icons'
import { AppIcon } from './Icon'

export async function copyLogText(value: string) {
  if (!value) throw new Error('No log output is available to copy.')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard access is unavailable.')
}

export function exportLogText(value: string, fileName: string) {
  if (!value) throw new Error('No log output is available to export.')
  const safeName = fileName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\.+$/, '') || 'dockscope-logs'
  const downloadName = /\.log$/i.test(safeName) ? safeName : `${safeName}.log`
  const url = window.URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = downloadName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}

export function LogActions({ value, fileName }: { value: string; fileName: string }) {
  const [feedback, setFeedback] = useState('')
  const feedbackTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
  }, [])

  const showFeedback = (message: string) => {
    setFeedback(message)
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(''), 1800)
  }

  const copyAll = async () => {
    try {
      await copyLogText(value)
      showFeedback('Copied')
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : String(error))
    }
  }

  const exportAll = () => {
    try {
      exportLogText(value, fileName)
      showFeedback('Exported')
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="log-actions" aria-label="Log actions">
      <button className="button secondary" type="button" disabled={!value} onClick={() => void copyAll()} title="Copy all logs">
        <AppIcon icon={Copy01Icon} />
        Copy all
      </button>
      <button className="button secondary" type="button" disabled={!value} onClick={exportAll} title="Export logs as a .log file">
        <AppIcon icon={FileExportIcon} />
        Export
      </button>
      <span className="log-action-status" role="status" aria-live="polite">{feedback}</span>
    </div>
  )
}

type LogContextMenuProps = {
  x: number
  y: number
  hasSelection: boolean
  hasContent: boolean
  onCopySelection: () => void
  onCopyAll: () => void
  onExport: () => void
}

export function LogContextMenu({ x, y, hasSelection, hasContent, onCopySelection, onCopyAll, onExport }: LogContextMenuProps) {
  return (
    <div
      className="log-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onClick={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
    >
      <button type="button" role="menuitem" disabled={!hasSelection} onClick={onCopySelection}>
        <AppIcon icon={Copy01Icon} />
        Copy selection
      </button>
      <button type="button" role="menuitem" disabled={!hasContent} onClick={onCopyAll}>
        <AppIcon icon={Copy01Icon} />
        Copy all
      </button>
      <button type="button" role="menuitem" disabled={!hasContent} onClick={onExport}>
        <AppIcon icon={FileExportIcon} />
        Export logs
      </button>
    </div>
  )
}
