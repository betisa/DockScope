import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('page and settings icon consistency', () => {
  const navigation = readFileSync('src/renderer/src/navigation.ts', 'utf8')
  const app = readFileSync('src/renderer/src/App.tsx', 'utf8')
  const settings = readFileSync('src/renderer/src/pages/SettingsPage.tsx', 'utf8')
  const pageFiles = readdirSync('src/renderer/src/pages').filter(name => name.endsWith('Page.tsx'))

  it('uses one shared navigation metadata source for sidebar icons', () => {
    expect(app).toContain("import { NAV_ITEMS } from './navigation'")
    expect(app).toContain('NAV_ITEMS.map')
    expect(navigation).toContain("id: 'containers'")
    expect(navigation).toContain('ContainerIcon')
    expect(navigation).toContain("id: 'volumes'")
    expect(navigation).toContain('Database01Icon')
  })

  it('renders all page headers through PageTitle', () => {
    const expected = [
      'DashboardPage.tsx','NotificationsPage.tsx','ActivityPage.tsx','ProductivityPage.tsx',
      'AuditPage.tsx','ContainersPage.tsx','ComposePage.tsx','ImagesPage.tsx',
      'ImageIntelligencePage.tsx','BuildKitPage.tsx','VolumesPage.tsx','NetworksPage.tsx',
      'CleanupPage.tsx','StoragePage.tsx','SettingsPage.tsx'
    ]
    for (const file of expected) {
      const source = readFileSync(path.join('src/renderer/src/pages', file), 'utf8')
      expect(source, file).toContain('<PageTitle page=')
      expect(source, file).not.toContain('<h1>')
    }
  })

  it('adds icons to every Settings navigation section and active section heading', () => {
    expect(settings).toContain("id:'general',label:'General',icon:Home01Icon")
    expect(settings).toContain("id:'docker',label:'Docker',icon:ContainerIcon")
    expect(settings).toContain("id:'monitoring',label:'Monitoring',icon:Alert02Icon")
    expect(settings).toContain("id:'cleanup',label:'Cleanup',icon:CleanIcon")
    expect(settings).toContain("id:'terminal',label:'Terminal & Logs',icon:Layers01Icon")
    expect(settings).toContain("id:'notifications',label:'Notifications',icon:Notification03Icon")
    expect(settings).toContain("id:'storage',label:'Storage',icon:HardDriveIcon")
    expect(settings).toContain("id:'security',label:'Security',icon:Database01Icon")
    expect(settings).toContain('<AppIcon icon={x.icon}')
    expect(settings).toContain('<Heading icon={Home01Icon}')
    expect(settings).toContain('<Heading icon={Database01Icon}')
  })

  it('uses icons on Settings profile cards', () => {
    expect(settings).toContain('profileIcon(profile.id)')
    expect(settings).toContain('Settings01Icon')
  })
})
