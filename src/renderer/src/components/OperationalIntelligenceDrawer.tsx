import { useEffect } from 'react'
import { Cancel01Icon, Notification03Icon } from '@hugeicons/core-free-icons'
import { AppIcon } from './Icon'
import { OperationalIntelligencePanel } from './OperationalIntelligencePanel'

export function OperationalIntelligenceDrawer({ onNavigate, onClose }: { onNavigate: (page: string) => void; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="operational-intelligence-backdrop" onMouseDown={onClose}>
    <aside className="operational-intelligence-drawer" role="dialog" aria-modal="true" aria-labelledby="operational-intelligence-title" onMouseDown={event => event.stopPropagation()}>
      <header className="operational-intelligence-drawer-header">
        <div className="operational-intelligence-drawer-title">
          <span className="operational-intelligence-drawer-icon"><AppIcon icon={Notification03Icon} size={19} /></span>
          <div><div className="eyebrow">Dashboard panel</div><h2 id="operational-intelligence-title">Operational Intelligence</h2></div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close Operational Intelligence"><AppIcon icon={Cancel01Icon} /></button>
      </header>
      <div className="operational-intelligence-drawer-body">
        <OperationalIntelligencePanel onNavigate={onNavigate} compact />
      </div>
    </aside>
  </div>
}
