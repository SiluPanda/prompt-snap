import type { MatchResult } from '../types.js'

export function matchRegex(actual: unknown, expected: unknown): MatchResult {
  const start = Date.now()
  const actualStr = String(actual)

  let pattern: string
  let flags: string | undefined

  if (typeof expected === 'string') {
    pattern = expected
    flags = undefined
  } else if (
    expected !== null &&
    typeof expected === 'object' &&
    'pattern' in expected
  ) {
    const exp = expected as { pattern: string; flags?: string }
    pattern = exp.pattern
    flags = exp.flags
  } else {
    pattern = String(expected)
    flags = undefined
  }

  let pass = false
  let errorMessage: string | undefined
  try {
    const re = new RegExp(pattern, flags)
    pass = re.test(actualStr)
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    pass = false
  }

  return {
    pass,
    score: pass ? 1.0 : 0.0,
    strategy: 'regex',
    durationMs: Date.now() - start,
    details: { pattern, flags, error: errorMessage },
  }
}
