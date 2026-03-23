import { describe, it, expect } from 'vitest'
import { matchExact } from '../matchers/exact.js'
import { matchJaccard } from '../matchers/jaccard.js'
import { matchStructural } from '../matchers/structural.js'
import { matchContains } from '../matchers/contains.js'
import { matchRegex } from '../matchers/regex.js'
import { matchKeyField } from '../matchers/keyField.js'

describe('matchExact', () => {
  it('passes for identical primitive values', () => {
    const r = matchExact('hello world', 'hello world')
    expect(r.pass).toBe(true)
    expect(r.score).toBe(1.0)
    expect(r.strategy).toBe('exact')
  })

  it('passes for identical objects', () => {
    const r = matchExact({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })
    expect(r.pass).toBe(true)
    expect(r.score).toBe(1.0)
  })

  it('fails for different primitive values', () => {
    const r = matchExact('hello', 'world')
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0.0)
    expect(r.diff).toBeDefined()
  })

  it('fails for different objects', () => {
    const r = matchExact({ a: 1 }, { a: 2 })
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0.0)
  })

  it('passes for identical numbers', () => {
    expect(matchExact(42, 42).pass).toBe(true)
  })
})

describe('matchJaccard', () => {
  it('passes when token overlap exceeds default threshold', () => {
    const r = matchJaccard(
      'The quick brown fox jumps over the lazy dog',
      'The quick brown fox leaps over the lazy dog'
    )
    expect(r.pass).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0.7)
    expect(r.strategy).toBe('jaccard')
  })

  it('fails for completely unrelated text', () => {
    const r = matchJaccard('apple banana cherry', 'xyz uvw qrs', 0.7)
    expect(r.pass).toBe(false)
    expect(r.score).toBeLessThan(0.7)
  })

  it('uses custom threshold', () => {
    const r = matchJaccard('a b c', 'a b d', 0.5)
    expect(r.pass).toBe(true)
  })

  it('returns score=1 for identical text', () => {
    const r = matchJaccard('same same same', 'same same same')
    expect(r.score).toBe(1.0)
    expect(r.pass).toBe(true)
  })

  it('fails when overlap is below threshold', () => {
    const r = matchJaccard('token1 token2', 'token3 token4', 0.7)
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0)
  })
})

describe('matchStructural', () => {
  it('passes for objects with same keys and types', () => {
    const r = matchStructural({ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 })
    expect(r.pass).toBe(true)
    expect(r.score).toBeGreaterThan(0)
    expect(r.strategy).toBe('structural')
  })

  it('fails when a key is missing', () => {
    const r = matchStructural({ name: 'Alice' }, { name: 'Bob', age: 25 })
    expect(r.pass).toBe(false)
    const details = r.details as any
    expect(details.missingKeys).toContain('age')
  })

  it('fails when there is a type mismatch', () => {
    const r = matchStructural({ age: 'thirty' }, { age: 30 })
    expect(r.pass).toBe(false)
    const details = r.details as any
    expect(details.typeMismatches.length).toBeGreaterThan(0)
  })

  it('passes for arrays of same length', () => {
    const r = matchStructural([1, 2, 3], [4, 5, 6])
    expect(r.pass).toBe(true)
  })

  it('fails for arrays of different length', () => {
    const r = matchStructural([1, 2], [1, 2, 3])
    expect(r.pass).toBe(false)
  })

  it('reports extra keys but still passes if no missing keys or type mismatches', () => {
    const r = matchStructural({ name: 'Alice', extra: true }, { name: 'Bob' })
    expect(r.pass).toBe(true)
    const details = r.details as any
    expect(details.extraKeys).toContain('extra')
  })
})

describe('matchContains', () => {
  it('passes when string contains the expected substring', () => {
    const r = matchContains('The LLM output is helpful', 'helpful')
    expect(r.pass).toBe(true)
    expect(r.score).toBe(1.0)
    expect(r.strategy).toBe('contains')
  })

  it('fails when string does not contain expected substring', () => {
    const r = matchContains('The output is great', 'terrible')
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0.0)
  })

  it('is case-insensitive', () => {
    const r = matchContains('Hello World', 'hello')
    expect(r.pass).toBe(true)
  })

  it('passes when all array substrings are found', () => {
    const r = matchContains('The output is helpful and accurate', ['helpful', 'accurate'])
    expect(r.pass).toBe(true)
    expect(r.score).toBe(1.0)
  })

  it('partially fails when some array substrings are missing', () => {
    const r = matchContains('The output is helpful', ['helpful', 'accurate'])
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0.5)
  })

  it('fails when no array substrings are found', () => {
    const r = matchContains('irrelevant text', ['helpful', 'accurate'])
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0.0)
  })
})

describe('matchRegex', () => {
  it('passes when actual matches the pattern', () => {
    const r = matchRegex('Output: 42', '\\d+')
    expect(r.pass).toBe(true)
    expect(r.score).toBe(1.0)
    expect(r.strategy).toBe('regex')
  })

  it('fails when actual does not match the pattern', () => {
    const r = matchRegex('no digits here', '^\\d+$')
    expect(r.pass).toBe(false)
    expect(r.score).toBe(0.0)
  })

  it('accepts { pattern, flags } object', () => {
    const r = matchRegex('HELLO WORLD', { pattern: 'hello', flags: 'i' })
    expect(r.pass).toBe(true)
  })

  it('fails gracefully on invalid regex', () => {
    const r = matchRegex('test', '[invalid(')
    expect(r.pass).toBe(false)
    const details = r.details as any
    expect(details.error).toBeDefined()
  })

  it('passes for email-like pattern', () => {
    const r = matchRegex('user@example.com', '^[^@]+@[^@]+\\.[^@]+$')
    expect(r.pass).toBe(true)
  })
})

describe('matchKeyField', () => {
  it('passes when all fields match their configured strategies', () => {
    const actual = { name: 'Alice', bio: 'I love cats and dogs', count: 5 }
    const expected = { name: 'Alice', bio: 'I love cats and dogs', count: 5 }
    const r = matchKeyField(actual, expected, {
      name: 'exact',
      bio: 'jaccard',
      count: 'exact',
    })
    expect(r.pass).toBe(true)
    expect(r.score).toBeCloseTo(1.0, 1)
    expect(r.strategy).toBe('keyField')
  })

  it('fails when a required field does not match', () => {
    const actual = { name: 'Alice', age: 30 }
    const expected = { name: 'Bob', age: 30 }
    const r = matchKeyField(actual, expected, {
      name: { strategy: 'exact' },
      age: 'exact',
    })
    expect(r.pass).toBe(false)
  })

  it('ignores optional fields when they are missing from both sides', () => {
    const actual = { name: 'Alice' }
    const expected = { name: 'Alice' }
    const r = matchKeyField(actual, expected, {
      name: 'exact',
      extra: { strategy: 'exact', optional: true },
    })
    expect(r.pass).toBe(true)
  })

  it('uses threshold from FieldMatchConfig', () => {
    const actual = { bio: 'I love cats very much' }
    const expected = { bio: 'I enjoy cats a lot' }
    const r = matchKeyField(actual, expected, {
      bio: { strategy: 'jaccard', threshold: 0.2 },
    })
    // With a low threshold, common tokens should be enough
    expect(r.pass).toBe(true)
  })

  it('mixes exact and contains strategies', () => {
    const actual = { id: 'abc-123', summary: 'The assistant was helpful and concise' }
    const expected = { id: 'abc-123', summary: ['helpful', 'concise'] }
    const r = matchKeyField(actual, expected, {
      id: 'exact',
      summary: 'contains',
    })
    expect(r.pass).toBe(true)
  })
})

describe('regression: custom strategy via match()', () => {
  it('custom strategy works when matcher function is provided', async () => {
    const { match } = await import('../matchers/dispatch.js')
    const result = await match('hello', 'hello', 'custom', {
      matcher: async (actual, expected) => ({
        pass: actual === expected,
        score: actual === expected ? 1.0 : 0.0,
        message: 'custom check',
      }),
    })
    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    expect(result.strategy).toBe('custom')
  })

  it('custom strategy throws when matcher not provided', async () => {
    const { match } = await import('../matchers/dispatch.js')
    await expect(match('a', 'b', 'custom', {})).rejects.toThrow(
      'matcher function is required',
    )
  })
})
