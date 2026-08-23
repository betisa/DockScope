import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AppIcon } from './Icon'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Renderer boundary caught an error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="fatal-state" role="alert">
        <div className="fatal-state-card card">
          <AppIcon icon={Alert02Icon} size={28} label="Application error" />
          <div>
            <div className="eyebrow">Renderer recovery</div>
            <h1>Something went wrong</h1>
            <p>
              DockScope isolated an unexpected UI error instead of terminating the desktop process.
            </p>
            <pre className="fatal-error">{this.state.error.message}</pre>
            <button className="button primary" onClick={() => window.location.reload()}>
              <AppIcon icon={RefreshIcon} size={16} />
              Reload application
            </button>
          </div>
        </div>
      </main>
    )
  }
}
