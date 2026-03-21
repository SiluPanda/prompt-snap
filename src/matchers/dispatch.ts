import type { MatchResult, MatchStrategyId, FieldMatchSchema, CustomMatcherFn } from '../types.js'
import { matchExact } from './exact.js'
import { matchJaccard } from './jaccard.js'
import { matchStructural } from './structural.js'
import { matchContains } from './contains.js'
import { matchRegex } from './regex.js'
import { matchKeyField } from './keyField.js'

export async function match(
  actual: unknown,
  expected: unknown,
  strategy: MatchStrategyId,
  options?: {
    threshold?: number
    schema?: FieldMatchSchema
    matcher?: CustomMatcherFn
  }
): Promise<MatchResult> {
  const threshold = options?.threshold

  switch (strategy) {
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

    case 'keyField': {
      const schema = options?.schema
      if (!schema) {
        throw new Error('schema is required for keyField matching')
      }
      return matchKeyField(actual, expected, schema)
    }

    case 'custom': {
      const customFn = options?.matcher
      if (!customFn) {
        throw new Error('matcher function is required for custom matching')
      }
      const start = Date.now()
      const result = await customFn(actual, expected)
      return {
        pass: result.pass,
        score: result.score ?? (result.pass ? 1.0 : 0.0),
        strategy: 'custom',
        durationMs: Date.now() - start,
        details: { message: result.message },
      }
    }

    default: {
      // Exhaustive check — should never reach here with correct TS types
      const _exhaustive: never = strategy
      throw new Error(`Unknown strategy: ${String(_exhaustive)}`)
    }
  }
}
