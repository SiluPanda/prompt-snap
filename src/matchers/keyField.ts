import type { MatchResult, FieldMatchSchema, FieldMatchConfig, MatchStrategyId } from '../types.js'
import { matchExact } from './exact.js'
import { matchJaccard } from './jaccard.js'
import { matchStructural } from './structural.js'
import { matchContains } from './contains.js'
import { matchRegex } from './regex.js'

function runStrategy(
  actual: unknown,
  expected: unknown,
  config: FieldMatchConfig
): { pass: boolean; score: number } {
  const threshold = config.threshold
  switch (config.strategy) {
    case 'exact':
      return matchExact(actual, expected)
    case 'jaccard':
      return matchJaccard(actual, expected, threshold ?? 0.7)
    case 'structural':
      return matchStructural(actual, expected)
    case 'contains':
      return matchContains(actual, expected)
    case 'regex':
      return matchRegex(actual, expected)
    default:
      return matchExact(actual, expected)
  }
}

export function matchKeyField(
  actual: unknown,
  expected: unknown,
  schema: FieldMatchSchema
): MatchResult {
  const start = Date.now()
  const actualObj = (actual !== null && typeof actual === 'object' ? actual : {}) as Record<string, unknown>
  const expectedObj = (expected !== null && typeof expected === 'object' ? expected : {}) as Record<string, unknown>

  const fieldResults: Record<string, { pass: boolean; score: number; optional: boolean }> = {}
  let totalScore = 0
  let fieldCount = 0

  for (const [field, rawConfig] of Object.entries(schema)) {
    const config: FieldMatchConfig =
      typeof rawConfig === 'string'
        ? { strategy: rawConfig as MatchStrategyId }
        : rawConfig

    const isOptional = config.optional === true
    const actualVal = actualObj[field]
    const expectedVal = expectedObj[field]

    // If optional and both sides are missing/undefined, skip scoring
    if (isOptional && actualVal === undefined && expectedVal === undefined) {
      fieldResults[field] = { pass: true, score: 1.0, optional: true }
      continue
    }

    const result = runStrategy(actualVal, expectedVal, config)
    fieldResults[field] = { pass: result.pass, score: result.score, optional: isOptional }
    totalScore += result.score
    fieldCount++
  }

  const score = fieldCount === 0 ? 1.0 : totalScore / fieldCount
  const pass = Object.entries(fieldResults).every(
    ([, r]) => r.optional || r.pass
  )

  return {
    pass,
    score,
    strategy: 'keyField',
    durationMs: Date.now() - start,
    details: { fieldResults },
  }
}
