import { forwardRef, useEffect, useMemo, useState } from 'react'
import { copyLogText, exportLogText, LogContextMenu } from './LogActions'

type ColoredLogConsoleProps = {
  value: string
  emptyText: string
  ariaLabel: string
  compose?: boolean
  tabIndex?: number
  exportFileName?: string
  actionValue?: string
}

type Severity = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'stdout'

const timestampPattern =
  /^(?:\d{4}-\d{2}-\d{2}[T ][0-9:.+\-Z]+|\d{2}:\d{2}:\d{2}(?:\.\d+)?|\[[0-9:.+\-TZ ]+\])/

const severityPattern =
  /\b(?:FATAL|CRITICAL|PANIC|ERROR|ERR|WARN(?:ING)?|INFO|NOTICE|DEBUG|DBG|TRACE|TRC|VERBOSE)\b/gi

const httpPattern = /\b(?:HTTP\/[12](?:\.\d)?\s+)?([1-5]\d{2})\b/g
const exceptionPattern = /\b(?:exception|traceback|stack trace|caused by|segmentation fault|panic|fatal)\b/gi
const composePrefixPattern = /^([^|\r\n]{1,80}?)(\s+\|\s+)/
const stderrPattern = /^\s*\[stderr\]/

export const ColoredLogConsole = forwardRef<HTMLDivElement, ColoredLogConsoleProps>(
  function ColoredLogConsole({ value, emptyText, ariaLabel, compose = false, tabIndex = 0, exportFileName = 'dockscope-logs.log', actionValue }, ref) {
    const allValue = actionValue ?? value
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectedText: string } | null>(null)
    const lines = useMemo(() => {
      if (!value) return []
      return value.split(/\r?\n/)
    }, [value])

    useEffect(() => {
      if (!contextMenu) return
      const close = () => setContextMenu(null)
      const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
      window.addEventListener('click', close)
      window.addEventListener('keydown', onKeyDown)
      return () => {
        window.removeEventListener('click', close)
        window.removeEventListener('keydown', onKeyDown)
      }
    }, [contextMenu])

    const openContextMenu = (x: number, y: number) => {
      const menuWidth = 190
      const menuHeight = 132
      setContextMenu({
        x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
        y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
        selectedText: window.getSelection()?.toString() ?? ''
      })
    }

    const runContextAction = (action: () => Promise<void> | void) => {
      void Promise.resolve(action()).catch(() => undefined).finally(() => setContextMenu(null))
    }

    return (
      <div
        ref={ref}
        className="live-console colored-log-console"
        role="log"
        aria-label={ariaLabel}
        aria-live="off"
        tabIndex={tabIndex}
        onContextMenu={event => {
          event.preventDefault()
          openContextMenu(event.clientX, event.clientY)
        }}
        onKeyDown={event => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            openContextMenu(rect.left + 16, rect.top + 16)
          }
        }}
      >
        {!lines.length ? (
          <div className="log-line log-line-empty"><span>{emptyText}</span></div>
        ) : lines.map((line, index) => (
          <ColoredLogLine line={line} compose={compose} key={index} />
        ))}
        {contextMenu && (
          <LogContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSelection={Boolean(contextMenu.selectedText.trim())}
            hasContent={Boolean(allValue)}
            onCopySelection={() => runContextAction(() => copyLogText(contextMenu.selectedText))}
            onCopyAll={() => runContextAction(() => copyLogText(allValue))}
            onExport={() => runContextAction(() => exportLogText(allValue, exportFileName))}
          />
        )}
      </div>
    )
  }
)

function ColoredLogLine({ line, compose }: { line: string; compose: boolean }) {
  const severity = detectSeverity(line)
  const prefixMatch = compose ? line.match(composePrefixPattern) : null
  const prefix = prefixMatch?.[1] ?? ''
  const separator = prefixMatch?.[2] ?? ''
  const body = prefixMatch ? line.slice(prefixMatch[0].length) : line

  return (
    <div className={`log-line log-line-${severity}`}>
      {prefix && (
        <>
          <span className={`log-service-prefix log-service-${hashBucket(prefix)}`}>{prefix}</span>
          <span className="log-service-separator">{separator}</span>
        </>
      )}
      <HighlightedText value={body} />
    </div>
  )
}

function HighlightedText({ value }: { value: string }) {
  const timestamp = value.match(timestampPattern)?.[0] ?? ''
  const remainder = timestamp ? value.slice(timestamp.length) : value
  const tokens = tokenize(remainder)

  return (
    <>
      {timestamp && <span className="log-token-timestamp">{timestamp}</span>}
      {tokens.map((token, index) => (
        <span className={token.className} key={index}>{token.text}</span>
      ))}
    </>
  )
}

function tokenize(value: string) {
  const markers: Array<{ start: number; end: number; className: string }> = []

  const addMatches = (pattern: RegExp, className: string, group = 0) => {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(value))) {
      const text = match[group] ?? match[0]
      const groupOffset = group > 0 ? match[0].indexOf(text) : 0
      const start = match.index + Math.max(0, groupOffset)
      markers.push({ start, end: start + text.length, className })
      if (pattern.lastIndex === match.index) pattern.lastIndex++
    }
  }

  addMatches(severityPattern, 'log-token-severity')
  addMatches(httpPattern, 'log-token-http', 1)
  addMatches(exceptionPattern, 'log-token-exception')

  if (stderrPattern.test(value)) {
    markers.push({
      start:value.search(/\[stderr\]/),
      end:value.search(/\[stderr\]/) + '[stderr]'.length,
      className:'log-token-stderr'
    })
  }

  markers.sort((a,b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))

  const nonOverlapping: typeof markers = []
  let cursor = 0
  for (const marker of markers) {
    if (marker.start < cursor) continue
    nonOverlapping.push(marker)
    cursor = marker.end
  }

  const tokens: Array<{ text: string; className?: string }> = []
  cursor = 0

  for (const marker of nonOverlapping) {
    if (marker.start > cursor) tokens.push({ text:value.slice(cursor, marker.start) })
    tokens.push({ text:value.slice(marker.start, marker.end), className:marker.className })
    cursor = marker.end
  }

  if (cursor < value.length) tokens.push({ text:value.slice(cursor) })
  if (!tokens.length) tokens.push({ text:value })

  return tokens
}

function detectSeverity(line: string): Severity {
  if (stderrPattern.test(line)) return 'error'
  if (/\b(?:FATAL|CRITICAL|PANIC|ERROR|ERR)\b/i.test(line)) return 'error'
  if (/\bWARN(?:ING)?\b/i.test(line)) return 'warn'
  if (/\b(?:DEBUG|DBG)\b/i.test(line)) return 'debug'
  if (/\b(?:TRACE|TRC|VERBOSE)\b/i.test(line)) return 'trace'
  if (/\b(?:INFO|NOTICE)\b/i.test(line)) return 'info'

  const http = line.match(/\b([1-5]\d{2})\b/)
  if (http?.[1]?.startsWith('5')) return 'error'
  if (http?.[1]?.startsWith('4')) return 'warn'

  return 'stdout'
}

function hashBucket(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % 6
}
