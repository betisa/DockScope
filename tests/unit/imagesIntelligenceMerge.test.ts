import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Images + Image Intelligence unified workspace', () => {
  const nav = readFileSync('src/renderer/src/navigation.ts','utf8')
  const app = readFileSync('src/renderer/src/App.tsx','utf8')
  const images = readFileSync('src/renderer/src/pages/ImagesPage.tsx','utf8')
  const modal = readFileSync('src/renderer/src/components/ImageIntelligenceModal.tsx','utf8')
  const productivity = readFileSync('src/renderer/src/productivity/model.ts','utf8')
  const graph = readFileSync('src/renderer/src/pages/ResourceGraphPage.tsx','utf8')
  const guides = readFileSync('src/renderer/src/pageGuides.ts','utf8')

  it('removes the standalone Image Intelligence navigation/page route', () => {
    expect(nav).not.toContain("'image-intelligence'")
    expect(nav).not.toContain("label: 'Image Intelligence'")
    expect(app).not.toContain('ImageIntelligencePage')
    expect(app).not.toContain("case 'image-intelligence'")
    expect(existsSync('src/renderer/src/pages/ImageIntelligencePage.tsx')).toBe(false)
  })

  it('adds Analyze directly to the Images inventory', () => {
    expect(images).toContain('Integrated Image Intelligence')
    expect(images).toContain('onClick={() => openAnalysis(image)}')
    expect(images).toContain('<ImageIntelligenceModal')
  })

  it('opens intelligence details in an accessible modal', () => {
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('aria-modal="true"')
    expect(modal).toContain("event.key === 'Escape'")
    expect(modal).toContain("event.key !== 'Tab'")
    expect(modal).toContain('previous?.focus()')
  })

  it('loads image history and optimization insight together', () => {
    expect(modal).toContain('window.dockerApi.imageInsights.history(image.id)')
    expect(modal).toContain('window.dockerApi.imageInsights.analyze(image.id)')
    expect(modal).toContain('Largest layer command')
    expect(modal).toContain('Layer history')
  })

  it('keeps analysis read-only and removal as a separate confirmed Images action', () => {
    expect(modal).toContain('Analysis uses Docker image history')
    expect(images).toContain('<ConfirmButton')
    expect(images).toContain('Remove ${image.repository}:${image.tag}?')
  })

  it('redirects image deep-links from Command Palette and Resource Graph into Images', () => {
    expect(productivity).toContain("page:'images', resourceId:img.id")
    expect(productivity).not.toContain("page:'image-intelligence'")
    expect(graph).toContain("page: 'images'")
    expect(graph).toContain("onNavigate('images')")
  })

  it('consumes image deep-link intent and automatically launches analysis', () => {
    expect(images).toContain("sessionStorage.getItem('dsm.m08.intent')")
    expect(images).toContain("if (intent.page !== 'images') return")
    expect(images).toContain('setAnalysisOpen(true)')
  })

  it('merges contextual documentation into the Images guide', () => {
    expect(guides).toContain("title: 'Images & Image Intelligence Guide'")
    expect(guides).not.toContain("'image-intelligence': {")
  })
})
