import type { MatchResult } from '../types.js'

export function matchContains(actual: unknown, expected: unknown | string[]): MatchResult {
  const start = Date.now()
  const actualStr = typeof actual === 'string' ? actual : JSON.stringify(actual)
  const actualLower = actualStr.toLowerCase()

  let needles: string[]
  if (Array.isArray(expected)) {
    needles = expected.map(e => String(e))
  } else {
    needles = [typeof expected === 'string' ? expected : JSON.stringify(expected)]
  }

  const matched: string[] = []
  const missing: string[] = []

  for (const needle of needles) {
    if (actualLower.includes(needle.toLowerCase())) {
      matched.push(needle)
    } else {
      missing.push(needle)
    }
  }

  const score = needles.length === 0 ? 1.0 : matched.length / needles.length
  const pass = missing.length === 0

  return {
    pass,
    score,
    strategy: 'contains',
    durationMs: Date.now() - start,
    details: { matched, missing, total: needles.length },
  }
}
