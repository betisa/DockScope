import { useCallback, useState, type ReactNode } from 'react'
import { File02Icon } from '@hugeicons/core-free-icons'
import type { PageId } from '../navigation'
import { pageMeta } from '../navigation'
import { AppIcon } from './Icon'
import { PageGuideDrawer } from './PageGuideDrawer'

export function PageTitle({
  page,
  title,
  subtitle
}: {
  page: PageId
  title?: ReactNode
  subtitle?: ReactNode
}) {
  const meta = pageMeta(page)
  const [guideOpen, setGuideOpen] = useState(false)
  const closeGuide = useCallback(() => setGuideOpen(false), [])

  return (
    <>
      <div className="page-title">
        <div className="page-title-icon" aria-hidden="true">
          <AppIcon icon={meta.icon} size={22} />
        </div>
        <div className="page-title-copy">
          <div className="page-title-row">
            <h1>{title ?? meta.label}</h1>
            <button
              className="page-guide-trigger"
              onClick={() => setGuideOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={guideOpen}
              aria-label={`Open ${meta.label} guide`}
            >
              <AppIcon icon={File02Icon} size={15} />
              <span>Guide</span>
            </button>
          </div>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <PageGuideDrawer page={page} open={guideOpen} onClose={closeGuide} />
    </>
  )
}
