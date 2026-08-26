type PreviewRedactor = (value: string) => string

function hasUnclosedOpening(source: string): boolean {
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (const character of source) {
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }

    if (character === '"') {
      inString = true
    } else if (character === '{' || character === '[') {
      stack.push(character)
    } else if (character === '}' || character === ']') {
      const expected = character === '}' ? '{' : '['
      if (stack.at(-1) === expected) stack.pop()
    }
  }

  return stack.length > 0
}

function balancedCandidates(source: string): string[] {
  const candidates: string[] = []

  for (let start = 0; start < source.length; start++) {
    if (source[start] !== '{' && source[start] !== '[') continue
    if (hasUnclosedOpening(source.slice(0, start))) continue

    const stack: string[] = []
    let inString = false
    let escaped = false

    for (let index = start; index < source.length; index++) {
      const character = source[index]

      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }

      if (character === '"') {
        inString = true
        continue
      }

      if (character === '{' || character === '[') {
        stack.push(character)
        continue
      }

      if (character !== '}' && character !== ']') continue
      const expected = character === '}' ? '{' : '['
      if (stack.at(-1) !== expected) break
      stack.pop()

      if (!stack.length) {
        candidates.push(source.slice(start, index + 1))
        break
      }
    }
  }

  return candidates
}

function removeTrailingCommas(value: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < value.length; index++) {
    const character = value[index]

    if (inString) {
      result += character
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }

    if (character === '"') {
      inString = true
      result += character
      continue
    }

    if (character === ',') {
      const remainder = value.slice(index + 1)
      if (/^\s*[}\]]/.test(remainder)) continue
    }

    result += character
  }

  return result
}

function escapeRawControlCharacters(value: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (const character of value) {
    const code = character.charCodeAt(0)

    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false

      if (code < 0x20) {
        result += code === 0x08 ? '\\b'
          : code === 0x09 ? '\\t'
            : code === 0x0a ? '\\n'
              : code === 0x0c ? '\\f'
                : code === 0x0d ? '\\r'
                  : `\\u${code.toString(16).padStart(4, '0')}`
      } else {
        result += character
      }
      continue
    }

    if (character === '"') inString = true
    result += character
  }

  return result
}

function normalizedCandidates(candidate: string): string[] {
  const withoutBom = candidate.replace(/^\uFEFF/, '')
  const withoutTrailingCommas = removeTrailingCommas(withoutBom)
  const values = [withoutBom, withoutTrailingCommas]

  for (const value of [...values]) {
    const escapedControls = escapeRawControlCharacters(value)
    values.push(escapedControls, escapeRawControlCharacters(removeTrailingCommas(value)))
  }

  return [...new Set(values)]
}

export function extractJson(text: string, redact: PreviewRedactor = value => value) {
  const trimmed = String(text ?? '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i)
  const sources = [fenced?.[1], trimmed]
    .filter((value): value is string => Boolean(value))
    .map(value => value.trim())

  for (const source of sources) {
    const candidates = [source, ...balancedCandidates(source)]

    for (const candidate of candidates) {
      for (const normalized of normalizedCandidates(candidate)) {
        try { return JSON.parse(normalized) }
        catch { /* Try the next bounded candidate or safe normalization. */ }
      }
    }
  }

  const preview = redact(trimmed).replace(/\s+/g, ' ').slice(0, 240)
  throw new Error(`AI provider returned a response that is not valid JSON.${preview ? ` Preview: ${preview}` : ''}`)
}
