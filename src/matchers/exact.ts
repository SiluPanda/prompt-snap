import type { MatchResult } from '../types.js'

export function matchExact(actual: unknown, expected: unknown): MatchResult {
  const start = Date.now()
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  const pass = actualStr === expectedStr
  let diff: string | undefined
  if (!pass) {
    // Find first differing character position
    let pos = 0
    const minLen = Math.min(actualStr.length, expectedStr.length)
    while (pos < minLen && actualStr[pos] === expectedStr[pos]) pos++
    diff = `First difference at position ${pos}: actual[${pos}]=${JSON.stringify(actualStr[pos])} expected[${pos}]=${JSON.stringify(expectedStr[pos])}`
  }
  return {
    pass,
    score: pass ? 1.0 : 0.0,
    strategy: 'exact',
    durationMs: Date.now() - start,
    details: { actualLength: actualStr.length, expectedLength: expectedStr.length },
    diff,
  }
}
