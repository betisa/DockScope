import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Smart Cleanup Planning by Target', () => {
  const contracts = readFileSync('src/shared/contracts.ts', 'utf8')
  const service = readFileSync('src/main/services/dockerService.ts', 'utf8')
  const ipc = readFileSync('src/main/ipc.ts', 'utf8')
  const preload = readFileSync('src/preload/index.ts', 'utf8')
  const taskCenter = readFileSync('src/main/services/taskCenterService.ts', 'utf8')
  const page = readFileSync('src/renderer/src/pages/CleanupPage.tsx', 'utf8')
  const guide = readFileSync('src/renderer/src/pageGuides.ts', 'utf8')

  it('defines a target plan with selected potential and shortfall', () => {
    expect(contracts).toContain('export type SmartCleanupPlan')
    expect(contracts).toContain('targetBytes')
    expect(contracts).toContain('potentialBytes')
    expect(contracts).toContain('selectedBytes')
    expect(contracts).toContain('shortfallBytes')
  })

  it('plans low-risk categories before medium-risk unused images', () => {
    const build = service.indexOf("key: 'build-cache'")
    const dangling = service.indexOf("key: 'dangling-images'")
    const stopped = service.indexOf("key: 'stopped-containers'")
    const unused = service.indexOf("key: 'unused-images'")
    expect(build).toBeGreaterThan(-1)
    expect(dangling).toBeGreaterThan(build)
    expect(stopped).toBeGreaterThan(dangling)
    expect(unused).toBeGreaterThan(stopped)
    expect(service).toContain("risk: 'medium'")
  })

  it('subtracts dangling estimate from total unused image reclaim to avoid double counting', () => {
    expect(service).toContain('const unusedImagesAdditional = Math.max(0, imageReclaimable - danglingBytes)')
    expect(service).toContain("'image', 'ls', '--filter', 'dangling=true'")
  })

  it('never includes volumes in executable plan steps', () => {
    expect(contracts).not.toContain("| 'volumes'\n\nexport type SmartCleanupPlanStep")
    expect(service).toContain("key: 'volumes'")
    expect(service).toContain('Persistent volumes are never included in Smart Cleanup plans')
    expect(taskCenter).not.toContain("'volumes': ['volume', 'prune'")
  })

  it('validates target and step allowlist in Main before Task Center execution', () => {
    expect(ipc).toContain("ipcMain.handle('cleanup:plan'")
    expect(ipc).toContain("request.kind === 'smart-cleanup'")
    expect(ipc).toContain("const allowedSteps = new Set")
    expect(ipc).toContain("'build-cache'")
    expect(ipc).toContain("'unused-images'")
    expect(preload).toContain("plan: (targetBytes) => ipcRenderer.invoke('cleanup:plan', targetBytes)")
  })

  it('executes only selected Smart Cleanup commands through Task Center', () => {
    expect(taskCenter).toContain('private async runSmartCleanup')
    expect(taskCenter).toContain("'build-cache': ['builder', 'prune', '--force']")
    expect(taskCenter).toContain("'dangling-images': ['image', 'prune', '--force']")
    expect(taskCenter).toContain("'unused-images': ['image', 'prune', '--all', '--force']")
    expect(taskCenter).toContain('request.cleanupSteps ?? []')
  })

  it('provides target input, presets, plan preview and shortfall UX', () => {
    expect(page).toContain('How much space do you want to reclaim?')
    expect(page).toContain('[5, 10, 20, 50]')
    expect(page).toContain('Build plan')
    expect(page).toContain('Target-based execution plan')
    expect(page).toContain('Target exceeds current cleanup potential')
    expect(page).toContain('Run available ${plan.selected} plan')
  })

  it('documents estimation and persistent-volume boundaries', () => {
    expect(guide).toContain("title: 'Smart Cleanup Planner Guide'")
    expect(guide).toContain('Avoiding double counting')
    expect(guide).toContain('Volumes are never automatically included in a Smart Cleanup plan.')
  })
})
