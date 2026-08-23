import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('DockScope product branding', () => {
  const packageJson=readFileSync('package.json','utf8')
  const main=readFileSync('src/main/index.ts','utf8')
  const app=readFileSync('src/renderer/src/App.tsx','utf8')
  const about=readFileSync('src/renderer/src/pages/AboutPage.tsx','utf8')
  const database=readFileSync('src/main/database/database.ts','utf8')

  it('uses DockScope product/package/application identity',()=>{
    expect(packageJson).toContain('"name": "dockscope-desktop"')
    expect(packageJson).toContain('"productName": "DockScope"')
    expect(packageJson).toContain('"appId": "com.dockscope.desktop"')
    expect(main).toContain("tray.setToolTip('DockScope')")
    expect(main).toContain("app.setAppUserModelId('com.dockscope.desktop')")
  })

  it('uses supplied graphic assets in renderer and packaging',()=>{
    for(const file of [
      'build/icon.ico','build/icon.png','build/icon-tray.png',
      'assets/branding/dockscope-brand-sheet.png',
      'assets/branding/dockscope-app-icon-master.png',
      'assets/branding/dockscope-logo-horizontal.png',
      'assets/branding/dockscope-banner.png',
      'src/renderer/src/assets/app-icon.png',
      'src/renderer/src/assets/dockscope-banner.png'
    ]) expect(existsSync(file)).toBe(true)
    expect(app).toContain('<strong>DockScope</strong>')
    expect(about).toContain("dockscope-banner.png")
  })

  it('migrates legacy local database into DockScope database when possible',()=>{
    expect(database).toContain("dockscope.sqlite3")
    expect(database).toContain("docker-space-manager.sqlite3")
    expect(database).toContain('migrateLegacyDatabaseFile')
    expect(database).toContain('fs.copyFile(legacy, target)')
  })
})
