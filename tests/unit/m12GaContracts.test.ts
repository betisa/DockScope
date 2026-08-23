import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('M12 GA UX and performance contracts', () => {
  const app = readFileSync('src/renderer/src/App.tsx', 'utf8')
  const main = readFileSync('src/renderer/src/main.tsx', 'utf8')
  const logs = readFileSync('src/renderer/src/components/LiveLogsPanel.tsx', 'utf8')
  const styles = readFileSync('src/renderer/src/styles.css', 'utf8')
  const icon = readFileSync('src/renderer/src/components/Icon.tsx', 'utf8')

  it('isolates renderer crashes with an ErrorBoundary', () => {
    expect(main).toContain('<ErrorBoundary>')
  })

  it('lazy loads heavy resource workspaces', () => {
    expect(app).toContain("lazy(() => import('./pages/ComposePage')")
    expect(app).toContain("lazy(() => import('./pages/BuildKitPage')")
    expect(app).toContain('<Suspense')
  })

  it('batches live log updates instead of rendering every chunk', () => {
    expect(logs).toContain('incomingBuffer')
    expect(logs).toContain('setInterval')
    expect(logs).not.toContain('setText((old) => trimLog(old + chunk')
  })

  it('supports reduced motion, forced colors, and skip navigation', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain('@media (forced-colors: active)')
    expect(styles).toContain('.skip-link')
    expect(app).toContain('Skip to main content')
  })

  it('uses an app-level Hugeicons accessibility wrapper', () => {
    expect(icon).toContain("color = 'currentColor'")
    expect(icon).toContain("role={decorative ? undefined : 'img'}")
    expect(icon).toContain("aria-hidden={decorative ? true : undefined}")
  })
})
