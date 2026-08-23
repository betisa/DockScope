import type { ReactNode } from 'react'
import {
  Alert02Icon,
  Archive02Icon,
  ContainerIcon,
  Database01Icon,
  File02Icon,
  Globe02Icon,
  Image01Icon,
  Layers01Icon,
  Notification03Icon,
  PackageIcon,
  Search01Icon
} from '@hugeicons/core-free-icons'
import { AppIcon } from './Icon'

export function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`status-dot ${ok ? 'ok' : 'bad'}`} aria-label={ok ? 'Running' : 'Unavailable'} />
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EmptyState({
  title,
  text,
  icon
}: {
  title: string
  text: string
  icon?: any
}) {
  const resolvedIcon = icon ?? inferEmptyStateIcon(title)

  return (
    <div className="empty" role="status">
      <div className="empty-icon" aria-hidden="true">
        <AppIcon icon={resolvedIcon} size={28} />
      </div>
      <div className="empty-title">{title}</div>
      <div className="muted">{text}</div>
    </div>
  )
}

function inferEmptyStateIcon(title: string) {
  const value = title.toLowerCase()

  if (value.includes('container')) return ContainerIcon
  if (value.includes('image')) return Image01Icon
  if (value.includes('volume') || value.includes('snapshot')) return Database01Icon
  if (value.includes('network')) return Globe02Icon
  if (value.includes('builder') || value.includes('build') || value.includes('cache')) return Layers01Icon
  if (value.includes('compose') || value.includes('topology')) return PackageIcon
  if (value.includes('notification')) return Notification03Icon
  if (value.includes('audit') || value.includes('history')) return Archive02Icon
  if (value.includes('search') || value.includes('match')) return Search01Icon
  if (value.includes('file') || value.includes('config')) return File02Icon

  return Alert02Icon
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  compact = false
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <div className={`switch-field ${disabled ? 'disabled' : ''} ${compact ? 'compact' : ''}`}>
      <span className="switch-copy">
        <span className="switch-label">{label}</span>
        {description && <span className="switch-description">{description}</span>}
      </span>
      <button
        type="button"
        className={`switch-control ${checked ? 'checked' : ''}`}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" aria-hidden="true" />
      </button>
    </div>
  )
}

export function CodePanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="card code-card">
      <div className="section-heading">{title}</div>
      <pre>{value || 'No output.'}</pre>
    </section>
  )
}

export function ConfirmButton({
  children,
  message,
  onConfirm,
  danger = false
}: {
  children: ReactNode
  message: string
  onConfirm: () => void | Promise<void>
  danger?: boolean
}) {
  return (
    <button
      className={danger ? 'button danger' : 'button secondary'}
      onClick={async () => {
        if (window.confirm(message)) await onConfirm()
      }}
    >
      {children}
    </button>
  )
}


export function LoadingState({ label = 'Loading…', rows = 5 }: { label?: string; rows?: number }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton skeleton-lg" />
          <span className="skeleton skeleton-md" />
          <span className="skeleton skeleton-sm" />
        </div>
      ))}
    </div>
  )
}

export function InlineAlert({
  tone = 'info',
  title,
  children
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title: string
  children?: ReactNode
}) {
  return (
    <div className={`inline-alert inline-alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  )
}

export function LiveRegion({ message }: { message: string }) {
  return <div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div>
}
