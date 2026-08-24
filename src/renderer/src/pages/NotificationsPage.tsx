import type { PageId } from '../navigation'
import { PageTitle } from '../components/PageTitle'
import { OperationalIntelligencePanel } from '../components/OperationalIntelligencePanel'

export function NotificationsPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return <div className="page">
    <div className="page-heading">
      <PageTitle page="notifications" title="Operational Intelligence" subtitle="Health changes, exits, restart loops and Docker storage pressure." />
    </div>
    <OperationalIntelligencePanel onNavigate={page => onNavigate(page as PageId)} />
  </div>
}
