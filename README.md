# prompt-snap

Snapshot testing for LLM outputs with configurable fuzzy matching strategies.

[![npm version](https://img.shields.io/npm/v/prompt-snap.svg)](https://www.npmjs.com/package/prompt-snap)
[![npm downloads](https://img.shields.io/npm/dt/prompt-snap.svg)](https://www.npmjs.com/package/prompt-snap)
[![license](https://img.shields.io/npm/l/prompt-snap.svg)](https://github.com/SiluPanda/prompt-snap/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/prompt-snap.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

---

## Description

`prompt-snap` brings Jest-style snapshot testing to LLM outputs. Traditional snapshot testing demands exact string equality, which breaks down when LLM responses vary across runs despite conveying the same meaning. `prompt-snap` solves this by storing baseline outputs alongside their matching configuration -- strategy, threshold, and per-field rules -- so that future outputs are compared with configurable tolerance.

Snapshots are persisted as human-readable JSON files. The first test run creates the baseline. Subsequent runs compare new output against the stored value using the configured strategy. When a comparison fails, a detailed `MatchResult` reports what differed, the similarity score, and the strategy used. When an intentional change is made, update mode overwrites the baseline.

Seven built-in matching strategies cover the full range of comparison needs: exact equality, Jaccard token similarity, structural shape checking, substring containment, regex pattern matching, per-field composite matching, and custom user-defined logic. All strategies run with zero runtime dependencies.

---

## Installation

```bash
npm install prompt-snap
```

Requires Node.js >= 18. Zero external runtime dependencies.

---

## Quick Start

```typescript
import { matchSnapshot } from 'prompt-snap';

// First run: creates a snapshot baseline, returns pass=true
const result = await matchSnapshot(
  'The assistant was helpful and concise.',
  'response-1'
);
console.log(result.pass);   // true (baseline created)
console.log(result.score);  // 1.0

// Subsequent run: compares against stored baseline
const result2 = await matchSnapshot(
  'The assistant was helpful and concise.',
  'response-1'
);
console.log(result2.pass);  // true (exact match)

// Different output: comparison fails
const result3 = await matchSnapshot(
  'Completely different output.',
  'response-1'
);
console.log(result3.pass);  // false
console.log(result3.score); // 0.0
```

---

## Features

- **Seven matching strategies** -- exact, jaccard, structural, contains, regex, keyField, and custom -- each targeting a different kind of comparison tolerance.
- **Per-field matching** -- Apply different strategies to different fields of structured JSON output via a `FieldMatchSchema`.
- **Snapshot lifecycle** -- Auto-create on first run, compare on subsequent runs, update baselines programmatically or via the `update` flag.
- **Detailed match results** -- Every comparison returns a `MatchResult` with pass/fail, a 0-1 similarity score, timing, strategy-specific details, and an optional diff string.
- **Zero runtime dependencies** -- All strategies use built-in JavaScript APIs. No external packages required.
- **Configurable snapshot storage** -- Control the directory and filename for snapshot files. Defaults to `<cwd>/.prompt-snap/snapshots.json`.
- **Reusable snapshotter instances** -- `createSnapshotter()` binds shared configuration (strategy, threshold, storage paths) to a single instance for use across an entire test suite.
- **Full TypeScript support** -- Strict types for all public APIs, configuration objects, and result types. Ships `.d.ts` declarations.

---

## API Reference

### `matchSnapshot(actual, snapshotId, options?)`

Compare a value against a stored snapshot. If no snapshot exists for the given ID, the value is stored as the new baseline and the call returns `pass: true`.

```typescript
function matchSnapshot(
  actual: unknown,
  snapshotId: string,
  options?: MatchSnapshotOptions
): Promise<MatchResult>;
```

**Parameters:**

| Parameter    | Type                   | Description |
|--------------|------------------------|-------------|
| `actual`     | `unknown`              | The value to compare against the stored snapshot. |
| `snapshotId` | `string`               | Unique identifier for this snapshot. |
| `options`    | `MatchSnapshotOptions` | Optional configuration (see below). |

**Returns:** `Promise<MatchResult>`

```typescript
// Exact match (default strategy)
const result = await matchSnapshot({ role: 'assistant' }, 'snap-1');

// Jaccard similarity with custom threshold
const result = await matchSnapshot(
  'The quick brown fox leaps over the lazy dog',
  'snap-2',
  { strategy: 'jaccard', threshold: 0.7 }
);
```

---

### `updateSnapshot(snapshotId, value, options?)`

Force-update an existing snapshot baseline with a new value. Equivalent to calling `matchSnapshot` with `update: true`.

```typescript
function updateSnapshot(
  snapshotId: string,
  value: unknown,
  options?: Omit<MatchSnapshotOptions, 'update'>
): Promise<void>;
```

**Parameters:**

| Parameter    | Type                                     | Description |
|--------------|------------------------------------------|-------------|
| `snapshotId` | `string`                                 | The snapshot to update. |
| `value`      | `unknown`                                | The new baseline value. |
| `options`    | `Omit<MatchSnapshotOptions, 'update'>`   | Optional configuration. |

```typescript
import { updateSnapshot } from 'prompt-snap';

await updateSnapshot('response-1', 'Updated baseline text.');
```

---

### `createSnapshotter(config?)`

Create a reusable `Snapshotter` instance with shared configuration. All calls through the instance use the bound defaults, which can be overridden per call.

```typescript
function createSnapshotter(config?: SnapshotterConfig): Snapshotter;
```

**Parameters:**

| Parameter | Type               | Description |
|-----------|--------------------|-------------|
| `config`  | `SnapshotterConfig` | Optional shared configuration. |

**Returns:** `Snapshotter`

```typescript
import { createSnapshotter } from 'prompt-snap';

const snapper = createSnapshotter({
  strategy: 'jaccard',
  threshold: 0.75,
  snapshotDir: './test/snapshots',
  snapshotFile: 'suite-a.json',
});

const result = await snapper.match(output, 'response-a');
await snapper.update('response-a', newBaseline);
const ids = snapper.listSnapshots(); // ['response-a']
```

---

### `match(actual, expected, strategy, options?)`

Low-level matching function. Compares two values directly using a specified strategy, without any snapshot storage. Useful when you want to use the matching engine outside the snapshot lifecycle.

```typescript
function match(
  actual: unknown,
  expected: unknown,
  strategy: MatchStrategyId,
  options?: {
    threshold?: number;
    schema?: FieldMatchSchema;
    matcher?: CustomMatcherFn;
  }
): Promise<MatchResult>;
```

**Parameters:**

| Parameter  | Type              | Description |
|------------|-------------------|-------------|
| `actual`   | `unknown`         | The value to test. |
| `expected` | `unknown`         | The expected value to compare against. |
| `strategy` | `MatchStrategyId` | The matching strategy to use. |
| `options`  | `object`          | Strategy-specific options. |

```typescript
import { match } from 'prompt-snap';

const result = await match(
  'The output was helpful',
  ['helpful', 'accurate'],
  'contains'
);
console.log(result.pass);  // false ('accurate' is missing)
console.log(result.score); // 0.5
```

---

### Types

#### `MatchStrategyId`

```typescript
type MatchStrategyId = 'exact' | 'jaccard' | 'structural' | 'contains' | 'regex' | 'keyField' | 'custom';
```

#### `MatchResult`

Returned by all matching operations.

```typescript
interface MatchResult {
  pass: boolean;                    // Whether the comparison passed
  score: number;                    // Similarity score, 0.0 to 1.0
  strategy: MatchStrategyId;        // Strategy used for the comparison
  durationMs: number;               // Time taken in milliseconds
  details: Record<string, unknown>; // Strategy-specific details
  diff?: string;                    // Human-readable diff (when available)
}
```

#### `MatchSnapshotOptions`

Options for `matchSnapshot`.

```typescript
interface MatchSnapshotOptions {
  strategy?: MatchStrategyId;    // Matching strategy (default: 'exact')
  threshold?: number;            // Minimum score to pass (strategy-dependent)
  schema?: FieldMatchSchema;     // Per-field matching rules (for keyField strategy)
  embedFn?: EmbedFn;             // Embedding function (for semantic strategy)
  snapshotDir?: string;          // Directory for snapshot files (default: '<cwd>/.prompt-snap')
  snapshotFile?: string;         // Snapshot filename (default: 'snapshots.json')
  update?: boolean;              // Force-update the snapshot baseline
}
```

#### `SnapshotterConfig`

Configuration for `createSnapshotter`.

```typescript
interface SnapshotterConfig {
  strategy?: MatchStrategyId;    // Default matching strategy
  threshold?: number;            // Default threshold
  snapshotDir?: string;          // Snapshot directory
  snapshotFile?: string;         // Snapshot filename
  update?: boolean;              // Default update mode
}
```

#### `Snapshotter`

Instance returned by `createSnapshotter`.

```typescript
interface Snapshotter {
  match(actual: unknown, snapshotId: string, options?: MatchSnapshotOptions): Promise<MatchResult>;
  update(snapshotId: string, value: unknown, options?: Omit<MatchSnapshotOptions, 'update'>): Promise<void>;
  listSnapshots(): string[];
}
```

#### `FieldMatchSchema`

Maps field names to matching strategies for use with the `keyField` strategy.

```typescript
type FieldMatchSchema = Record<string, MatchStrategyId | FieldMatchConfig>;
```

#### `FieldMatchConfig`

Full configuration for a single field in a `FieldMatchSchema`.

```typescript
interface FieldMatchConfig {
  strategy: MatchStrategyId;     // Matching strategy for this field
  threshold?: number;            // Score threshold for this field
  matcher?: CustomMatcherFn;     // Custom matcher (for 'custom' strategy)
  caseSensitive?: boolean;       // Case sensitivity flag
  optional?: boolean;            // If true, field may be absent without failing
}
```

#### `SnapshotEntry`

A single stored snapshot.

```typescript
interface SnapshotEntry {
  id: string;
  value: unknown;
  strategy: MatchStrategyId;
  threshold?: number;
  schema?: FieldMatchSchema;
  updatedAt: string;
}
```

#### `SnapshotFile`

The on-disk format for a snapshot file.

```typescript
interface SnapshotFile {
  __meta: { version: string; createdBy: string; updatedAt: string };
  [snapshotId: string]: SnapshotEntry | any;
}
```

#### `EmbedFn`

Embedding function signature for semantic matching.

```typescript
type EmbedFn = (text: string) => Promise<number[]>;
```

#### `CustomMatcherFn`

Custom matcher function signature.

```typescript
type CustomMatcherFn = (
  actual: unknown,
  expected: unknown
) =>
  | { pass: boolean; score?: number; message?: string }
  | Promise<{ pass: boolean; score?: number; message?: string }>;
```

---

## Configuration

### Snapshot Storage

Snapshots are stored as JSON in a configurable directory. By default:

```
<cwd>/.prompt-snap/snapshots.json
```

Override the directory and filename:

```typescript
await matchSnapshot(value, 'my-snap', {
  snapshotDir: './test/__snapshots__',
  snapshotFile: 'llm-outputs.json',
});
```

The directory is created automatically if it does not exist.

### Default Strategy

When no strategy is specified, `exact` is used. Override the default per call or globally via `createSnapshotter`:

```typescript
const snapper = createSnapshotter({ strategy: 'jaccard', threshold: 0.7 });
```

### Per-Call Overrides

Options passed directly to `matchSnapshot` or `snapper.match` override the snapshotter defaults:

```typescript
const snapper = createSnapshotter({ strategy: 'exact' });

// This call uses jaccard instead of the default exact
await snapper.match(output, 'snap-1', { strategy: 'jaccard', threshold: 0.8 });
```

---

## Matching Strategies

### exact

Compares values using `JSON.stringify` equality. No tolerance for any difference. Score is 1.0 (identical) or 0.0 (different). On mismatch, the `diff` field reports the first differing character position.

```typescript
await matchSnapshot({ role: 'assistant', content: 'Hello' }, 'snap-1', {
  strategy: 'exact',
});
```

**Details returned:** `{ actualLength, expectedLength }`

### jaccard

Tokenizes both values (split on whitespace and non-word characters, lowercased), computes the Jaccard similarity coefficient (intersection / union of token sets), and passes if the score meets or exceeds the threshold.

Default threshold: `0.7`.

```typescript
await matchSnapshot(
  'The quick brown fox leaps over the lazy dog',
  'snap-2',
  { strategy: 'jaccard', threshold: 0.7 }
);
```

**Details returned:** `{ intersection, union, threshold, actualTokens, expectedTokens }`

### structural

Checks that two values have the same shape: same top-level keys, same value types at each key, same array lengths. Values themselves are ignored -- only the structure matters. Extra keys in the actual value are reported but do not cause failure. Missing keys and type mismatches cause failure.

```typescript
await matchSnapshot(
  { name: 'Alice', age: 30, tags: ['a', 'b'] },
  'snap-3',
  { strategy: 'structural' }
);
```

**Details returned:** `{ missingKeys, extraKeys, typeMismatches, matchedFields, totalFields }`

### contains

Checks that the actual value contains all expected substrings. The expected value can be a single string or an array of strings. Comparison is case-insensitive. Score is the fraction of substrings found.

```typescript
await matchSnapshot('The LLM output was helpful and accurate', 'snap-4', {
  strategy: 'contains',
});
```

**Details returned:** `{ matched, missing, total }`

### regex

Tests the actual value against a regular expression pattern. The expected value can be a pattern string or an object with `pattern` and `flags` properties. Invalid regex patterns fail gracefully with an error detail rather than throwing.

```typescript
// Pattern as string
await matchSnapshot('2024-01-15', 'snap-5', { strategy: 'regex' });
// Stored expected: '^\\d{4}-\\d{2}-\\d{2}$'

// Pattern as object with flags
// Stored expected: { pattern: 'hello', flags: 'i' }
```

**Details returned:** `{ pattern, flags, error }`

### keyField

Applies a different matching strategy to each field of a structured object. Requires a `schema` option that maps field names to strategies. Each field is matched independently. The overall result passes only if all non-optional fields pass. Score is the average of per-field scores.

```typescript
import type { FieldMatchSchema } from 'prompt-snap';

const schema: FieldMatchSchema = {
  id: 'exact',
  summary: { strategy: 'contains' },
  body: { strategy: 'jaccard', threshold: 0.6 },
  metadata: { strategy: 'structural', optional: true },
};

await matchSnapshot(actual, 'snap-6', { strategy: 'keyField', schema });
```

Fields can use string shorthand (`'exact'`) or full config objects (`{ strategy: 'jaccard', threshold: 0.5 }`). Mark fields as `optional: true` to skip them when absent from both sides.

**Details returned:** `{ fieldResults: Record<string, { pass, score, optional }> }`

### custom

Delegates comparison to a user-provided function. The function receives the actual and expected values and returns a result object with `pass`, optional `score`, and optional `message`. Async functions are supported.

```typescript
await matchSnapshot(actual, 'snap-7', {
  strategy: 'custom',
  matcher: async (actual, expected) => ({
    pass: someCheck(actual, expected),
    score: 0.9,
    message: 'Custom validation passed',
  }),
});
```

If `score` is omitted, it defaults to `1.0` when `pass` is `true` and `0.0` when `pass` is `false`.

**Details returned:** `{ message }`

---

## Error Handling

### Missing Schema for keyField

The `keyField` strategy requires a `schema` option. If omitted, an error is thrown:

```
Error: schema is required for keyField matching
```

### Missing Matcher for custom

The `custom` strategy requires a `matcher` function. If omitted, an error is thrown:

```
Error: matcher function is required for custom matching
```

### Invalid Regex Patterns

The `regex` strategy catches invalid patterns and returns a failed result with the error in `details.error`, rather than throwing an exception:

```typescript
const result = await match('test', '[invalid(', 'regex');
console.log(result.pass);           // false
console.log(result.details.error);  // 'Invalid regular expression: ...'
```

### Corrupt Snapshot Files

If a snapshot file contains invalid JSON, the store silently starts fresh rather than crashing. A new snapshot file is created on the next write.

### Unknown Strategy

Passing an unrecognized strategy ID results in a compile-time TypeScript error (exhaustive switch). At runtime, an `Error` is thrown with the message `Unknown strategy: <id>`.

---

## Advanced Usage

### Using with Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { matchSnapshot } from 'prompt-snap';

describe('LLM responses', () => {
  it('produces a semantically similar summary', async () => {
    const output = await callLLM('Summarize this article...');
    const result = await matchSnapshot(output, 'article-summary', {
      strategy: 'jaccard',
      threshold: 0.6,
    });
    expect(result.pass).toBe(true);
  });
});
```

### Structured Output Validation

Validate that an LLM's structured JSON response matches expectations at the field level:

```typescript
const output = await callLLM('Extract user profile');
// output = { name: 'Alice', bio: 'Loves hiking...', age: 30 }

const result = await matchSnapshot(output, 'user-profile', {
  strategy: 'keyField',
  schema: {
    name: 'exact',
    bio: { strategy: 'jaccard', threshold: 0.5 },
    age: 'structural',
  },
});
```

### Updating Baselines

When LLM output intentionally changes (prompt update, model upgrade), update the stored baseline:

```typescript
// Option 1: update flag
await matchSnapshot(newOutput, 'snap-id', { update: true });

// Option 2: updateSnapshot helper
import { updateSnapshot } from 'prompt-snap';
await updateSnapshot('snap-id', newOutput, { strategy: 'jaccard', threshold: 0.8 });
```

### Shared Configuration Across a Test Suite

Bind common settings once and reuse across all tests:

```typescript
import { createSnapshotter } from 'prompt-snap';

const snapper = createSnapshotter({
  strategy: 'jaccard',
  threshold: 0.7,
  snapshotDir: './test/__snapshots__',
  snapshotFile: 'llm-suite.json',
});

// All calls inherit the defaults
await snapper.match(output1, 'response-a');
await snapper.match(output2, 'response-b');

// Override per call when needed
await snapper.match(output3, 'response-c', { strategy: 'exact' });

// List all stored snapshot IDs
const ids = snapper.listSnapshots();
```

### Snapshot File Format

Snapshot files are human-readable JSON stored in the configured directory:

```json
{
  "__meta": {
    "version": "1",
    "createdBy": "prompt-snap",
    "updatedAt": "2026-03-22T10:00:00.000Z"
  },
  "response-a": {
    "id": "response-a",
    "value": "The assistant was helpful and concise.",
    "strategy": "jaccard",
    "threshold": 0.7,
    "updatedAt": "2026-03-22T10:00:00.000Z"
  }
}
```

These files are designed to be committed to version control. When a snapshot baseline changes, the diff in a pull request shows exactly what shifted.

---

## TypeScript

`prompt-snap` is written in strict TypeScript and ships with full type declarations. All public types are exported from the package entry point:

```typescript
import type {
  MatchStrategyId,
  MatchResult,
  MatchSnapshotOptions,
  SnapshotterConfig,
  Snapshotter,
  FieldMatchSchema,
  FieldMatchConfig,
  SnapshotEntry,
  SnapshotFile,
  EmbedFn,
  CustomMatcherFn,
} from 'prompt-snap';
```

The package targets ES2022 and uses CommonJS module output. TypeScript declaration maps are included for IDE navigation into source types.

---

## License

MIT
