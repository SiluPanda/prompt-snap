import type { MatchResult } from '../types.js'

function getType(val: unknown): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

export function matchStructural(actual: unknown, expected: unknown): MatchResult {
  const start = Date.now()
  const missingKeys: string[] = []
  const extraKeys: string[] = []
  const typeMismatches: string[] = []
  let matchedFields = 0
  let totalFields = 0

  const actualType = getType(actual)
  const expectedType = getType(expected)

  if (actualType !== expectedType) {
    return {
      pass: false,
      score: 0.0,
      strategy: 'structural',
      durationMs: Date.now() - start,
      details: { typeMismatches: [`root: actual=${actualType} expected=${expectedType}`] },
    }
  }

  if (expectedType === 'array') {
    const actualArr = actual as unknown[]
    const expectedArr = expected as unknown[]
    totalFields = 1
    if (actualArr.length === expectedArr.length) {
      matchedFields = 1
    } else {
      typeMismatches.push(`array length: actual=${actualArr.length} expected=${expectedArr.length}`)
    }
  } else if (expectedType === 'object') {
    const actualObj = actual as Record<string, unknown>
    const expectedObj = expected as Record<string, unknown>
    const expectedKeys = Object.keys(expectedObj)
    const actualKeys = new Set(Object.keys(actualObj))

    for (const key of expectedKeys) {
      totalFields++
      if (!actualKeys.has(key)) {
        missingKeys.push(key)
      } else {
        const aType = getType(actualObj[key])
        const eType = getType(expectedObj[key])
        if (aType !== eType) {
          typeMismatches.push(`${key}: actual=${aType} expected=${eType}`)
        } else {
          matchedFields++
        }
      }
    }

    for (const key of actualKeys) {
      if (!expectedObj.hasOwnProperty(key)) {
        extraKeys.push(key)
      }
    }
  } else {
    // Primitive comparison
    totalFields = 1
    if (getType(actual) === getType(expected)) matchedFields = 1
  }

  const score = totalFields === 0 ? 1.0 : matchedFields / totalFields
  const pass = missingKeys.length === 0 && typeMismatches.length === 0

  return {
    pass,
    score,
    strategy: 'structural',
    durationMs: Date.now() - start,
    details: { missingKeys, extraKeys, typeMismatches, matchedFields, totalFields },
  }
}
