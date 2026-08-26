import { describe, expect, it } from 'vitest'
import { extractJson } from '../../src/main/services/aiJson'

describe('AI JSON extraction', () => {
  it('extracts JSON from provider prose and markdown fences', () => {
    expect(extractJson('Here is the analysis:\n```json\n{"summary":"ok"}\n```')).toEqual({ summary:'ok' })
  })

  it('repairs trailing commas and raw control characters inside strings', () => {
    expect(extractJson('{"summary":"line one\nline two", "items":[1,2,],}')).toEqual({
      summary:'line one\nline two',
      items:[1, 2]
    })
  })

  it('does not accept an incomplete response', () => {
    expect(() => extractJson('{"summary":"incomplete')).toThrow('not valid JSON')
    expect(() => extractJson('{"rootCauses":[{"title":"partial"}')).toThrow('not valid JSON')
  })
})
