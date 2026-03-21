# prompt-snap

Jest-like snapshot testing for LLM outputs with fuzzy matching strategies.

## Install

```bash
npm install prompt-snap
```

Zero external runtime dependencies.

## Quick Start

```typescript
import { matchSnapshot, createSnapshotter } from 'prompt-snap'

// First run: creates a snapshot baseline and returns pass=true
const result = await matchSnapshot('The assistant was helpful and concise.', 'response-1')
console.log(result.pass)   // true (baseline created)
console.log(result.score)  // 1.0

// Subsequent runs: compares against the stored baseline
const result2 = await matchSnapshot('The assistant was helpful and concise.', 'response-1')
console.log(result2.pass)  // true

const result3 = await matchSnapshot('Completely different output.', 'response-1')
console.log(result3.pass)  // false
```

## Strategies

| Strategy    | Description |
|-------------|-------------|
| `exact`     | Exact JSON equality (`JSON.stringify` comparison). Default. |
| `jaccard`   | Jaccard similarity on token sets. Pass if similarity >= threshold (default 0.7). |
| `structural`| Same top-level keys, same value types, same array lengths. |
| `contains`  | All expected substring(s) present in actual string (case-insensitive). |
| `regex`     | RegExp pattern test against string representation of actual. |
| `keyField`  | Per-field strategy configuration via a schema object. |
| `custom`    | Provide your own matcher function. |

### exact

```typescript
await matchSnapshot({ role: 'assistant', content: 'Hello' }, 'snap-1', { strategy: 'exact' })
```

### jaccard

```typescript
await matchSnapshot(
  'The quick brown fox leaps over the lazy dog',
  'snap-2',
  { strategy: 'jaccard', threshold: 0.7 }
)
```

### structural

```typescript
await matchSnapshot(
  { name: 'Alice', age: 30, tags: ['a', 'b'] },
  'snap-3',
  { strategy: 'structural' }
)
```

### contains

```typescript
// Expected is a single substring or array of substrings
await matchSnapshot('The LLM output was helpful and accurate', 'snap-4', {
  strategy: 'contains',
})
// Store: expected = ['helpful', 'accurate']
```

### regex

```typescript
await matchSnapshot('2024-01-15', 'snap-5', { strategy: 'regex' })
// Store: expected = '^\\d{4}-\\d{2}-\\d{2}$'

// Or with flags:
// Store: expected = { pattern: 'hello', flags: 'i' }
```

### keyField

```typescript
import type { FieldMatchSchema } from 'prompt-snap'

const schema: FieldMatchSchema = {
  id: 'exact',
  summary: { strategy: 'contains' },
  body: { strategy: 'jaccard', threshold: 0.6 },
  metadata: { strategy: 'structural', optional: true },
}

await matchSnapshot(actual, 'snap-6', { strategy: 'keyField', schema })
```

### custom

```typescript
await matchSnapshot(actual, 'snap-7', {
  strategy: 'custom',
  matcher: async (actual, expected) => ({
    pass: someCheck(actual, expected),
    score: 0.9,
    message: 'custom check result',
  }),
})
```

## Snapshot File Storage

Snapshots are stored as JSON files. Default location:

```
<cwd>/.prompt-snap/snapshots.json
```

Override with options:

```typescript
await matchSnapshot(value, 'my-snap', {
  snapshotDir: './test/__snapshots__',
  snapshotFile: 'llm-outputs.json',
})
```

## Update Mode

To overwrite an existing snapshot baseline:

```typescript
// Option 1: update flag
await matchSnapshot(newValue, 'snap-id', { update: true })

// Option 2: updateSnapshot helper
import { updateSnapshot } from 'prompt-snap'
await updateSnapshot('snap-id', newValue)
```

## createSnapshotter Factory

Bind shared configuration to a reusable `Snapshotter` instance:

```typescript
import { createSnapshotter } from 'prompt-snap'

const snapper = createSnapshotter({
  strategy: 'jaccard',
  threshold: 0.75,
  snapshotDir: './test/snapshots',
  snapshotFile: 'suite-a.json',
})

await snapper.match(output, 'response-a')
await snapper.update('response-a', newBaseline)
const ids = snapper.listSnapshots()  // ['response-a']
```

## MatchResult

```typescript
interface MatchResult {
  pass: boolean        // whether the match passed
  score: number        // similarity score 0.0–1.0
  strategy: string     // strategy used
  durationMs: number   // time taken
  details: Record<string, unknown>  // strategy-specific details
  diff?: string        // human-readable diff (exact strategy)
}
```

## License

MIT
