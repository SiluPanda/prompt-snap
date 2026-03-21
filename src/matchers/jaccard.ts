import type { MatchResult } from '../types.js'

function tokenize(value: unknown): Set<string> {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  const tokens = str.toLowerCase().split(/[\s\W]+/).filter(t => t.length > 0)
  return new Set(tokens)
}

export function matchJaccard(actual: unknown, expected: unknown, threshold = 0.7): MatchResult {
  const start = Date.now()
  const setA = tokenize(actual)
  const setB = tokenize(expected)

  let intersectionCount = 0
  for (const token of setA) {
    if (setB.has(token)) intersectionCount++
  }

  const unionCount = setA.size + setB.size - intersectionCount
  const score = unionCount === 0 ? 1.0 : intersectionCount / unionCount
  const pass = score >= threshold

  return {
    pass,
    score,
    strategy: 'jaccard',
    durationMs: Date.now() - start,
    details: {
      intersection: intersectionCount,
      union: unionCount,
      threshold,
      actualTokens: setA.size,
      expectedTokens: setB.size,
    },
  }
}
