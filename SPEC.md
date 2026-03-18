# prompt-snap -- Specification

## 1. Overview

`prompt-snap` is a snapshot testing library for LLM outputs that provides Jest-like `toMatchPromptSnapshot()` assertions with configurable fuzzy matching strategies. It stores expected LLM outputs in snapshot files and compares new outputs against those snapshots using per-field matching rules -- semantic similarity, structural matching, key-field exact matching, Jaccard overlap, regex patterns, and custom matcher functions -- instead of the exact string equality that traditional snapshot testing demands.

The gap this package fills is specific and well-defined. Jest's `toMatchSnapshot()` is one of the most widely used testing patterns in JavaScript: it serializes an output, stores it in a `.snap` file, and on subsequent runs compares the new output character-by-character against the stored snapshot. If the output changed, the test fails. The developer reviews the diff, and if the change is intentional, runs `--updateSnapshot` to accept it. This workflow is elegant for deterministic code -- React component rendering, API response shapes, configuration serialization -- where the same input always produces the same output.

LLM outputs break this model entirely. Given the same prompt, temperature, and model, an LLM will produce different outputs on every call: different word choices, different sentence structures, different ordering of bullet points, different levels of detail. The outputs are semantically equivalent but textually different. "The capital of France is Paris" and "Paris is the capital city of France" convey the same information but fail a character-level comparison. Traditional snapshots force developers into a choice: either pin exact outputs (which means every test run requires snapshot updates, rendering the test meaningless) or abandon snapshot testing for LLM outputs entirely (which means no regression detection for prompt changes).

Existing tools address adjacent problems but not this one. Jest's `toMatchSnapshot()` and `toMatchInlineSnapshot()` are exact-match only. `jest-snapshot-serializer-raw` and `@jest/snapshot-utils` customize snapshot serialization but not comparison logic. `toMatchImageSnapshot` (from `jest-image-snapshot`) does fuzzy visual comparison for images using pixel-level thresholds -- the right idea, but for a different domain. `promptfoo` is a prompt evaluation framework that compares LLM outputs against expected results using various assertion types (contains, is-json, llm-rubric), but it is a standalone evaluation runner with its own configuration format, not a matcher that integrates into existing test suites. `jest-json-schema` validates structure but not content. `ai-output-assert` in this monorepo provides test-time assertions for LLM outputs but focuses on pass/fail quality checks, not snapshot-style regression detection with stored baselines. `output-grade` provides heuristic quality scores but does not store or compare against historical outputs.

`prompt-snap` provides the missing primitive: snapshot testing that expects change. A snapshot in `prompt-snap` stores not just the expected output but also the matching strategy to use when comparing. A snapshot can say "the `name` field must match exactly, the `description` field must be semantically similar (cosine similarity above 0.85), the `items` array must have the same structure, and the `reasoning` field just needs to be a non-empty string." When a new output arrives, `prompt-snap` applies the per-field matching rules and reports a detailed result: which fields passed, which failed, what the similarity scores were, and what specifically differed.

The snapshot lifecycle mirrors Jest: first run creates the snapshot, subsequent runs compare against it, `--update-snapshots` regenerates them. But the comparison is fuzzy, configurable, and LLM-aware. The result is a testing workflow where prompt engineers can make prompt changes, run tests, see which outputs shifted beyond acceptable thresholds, review the diffs with semantic context, and accept or reject changes -- the same review workflow that makes Jest snapshots powerful, adapted for the non-deterministic reality of LLM outputs.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `toMatchPromptSnapshot(options?)` custom matcher for Jest and Vitest via `expect.extend()`, enabling `expect(output).toMatchPromptSnapshot()` in test files with zero additional boilerplate.
- Provide a standalone `matchSnapshot(actual, snapshotId, options?)` function for framework-agnostic snapshot testing, returning a structured `MatchResult` with pass/fail, similarity scores, and per-field details.
- Support eight matching strategies: `exact`, `semantic`, `structural`, `keyField`, `contains`, `regex`, `jaccard`, and `custom`. Each strategy has documented behavior, configuration options, default thresholds, and clear use-case guidance.
- Support per-field matching for structured (JSON) outputs via a `FieldMatchSchema` that assigns different strategies to different fields, including nested field paths and array element matching.
- Store snapshots in a `.prompt-snap` directory alongside test files, in a human-readable JSON format with metadata (strategy, threshold, timestamp, version), enabling code review of snapshot changes.
- Provide a snapshot lifecycle matching Jest conventions: auto-create on first run, compare on subsequent runs, update via `--update-snapshots` flag or `PROMPT_SNAP_UPDATE=1` environment variable, and detect stale (unused) snapshots.
- Provide a `createSnapshotter(config)` factory for creating pre-configured instances with default strategies, thresholds, embedding functions, and snapshot directories, avoiding repeated configuration across test files.
- Produce detailed diff output on mismatch: per-field pass/fail with scores, semantic similarity breakdowns, structural diff highlighting, and terminal-formatted colored output for human review.
- Provide a pluggable `EmbedFn` interface `(text: string) => Promise<number[]>` for semantic similarity matching. Users supply their own embedding function using any provider. No built-in embedding provider -- the package is embedding-agnostic.
- Provide a CLI (`prompt-snap`) for snapshot management: list snapshots, show stale snapshots, update snapshots, clean unused snapshots.
- Keep runtime dependencies at zero for the core matching engine. Semantic similarity requires a user-provided embedding function but no built-in embedding dependency. All other strategies use only built-in JavaScript APIs.
- Ship complete TypeScript type definitions. All public types are exported. All configuration objects are fully typed.

### Non-Goals

- **Not an LLM evaluation framework.** This package does not compute faithfulness, relevance, hallucination rate, or other RAG metrics. It compares outputs against stored snapshots using configurable matching. For evaluation metrics, use `rag-eval-node-ts` or `output-grade` from this monorepo.
- **Not a prompt testing runner.** This package does not call LLMs, manage prompt templates, or orchestrate test execution. It is a matching library that receives an output value and compares it against a stored snapshot. For prompt testing orchestration, use `promptfoo` or build a test suite using Jest/Vitest with `prompt-snap` as the matcher.
- **Not an embedding provider.** This package does not ship an embedding model, call OpenAI's embedding API, or depend on any ML library. Semantic similarity requires the caller to provide an `EmbedFn`. Built-in adapters for common providers are offered as optional peer-dependency imports, not bundled into the core.
- **Not a visual snapshot tool.** This package compares text and structured data, not images, screenshots, or rendered components. For visual snapshot testing, use `jest-image-snapshot` or Playwright's visual comparisons.
- **Not a full-text search engine.** The Jaccard and semantic similarity computations are designed for comparing two strings (actual vs. expected), not for searching through a corpus. They are pairwise comparison operations, not indexing or retrieval operations.
- **Not a JSON Schema validator.** Structural matching checks that two JSON values have the same shape (same keys, same types). It does not validate against a formal JSON Schema specification. For JSON Schema validation, use `ajv` or `zod`.
- **Not a diff visualization library.** This package produces structured diff data (`MatchDetails`) and optionally formats it for the terminal. It does not generate HTML diffs, side-by-side views, or interactive diff UIs. The diff output is designed for test runner console output and CI logs.

---

## 3. Target Users and Use Cases

### Prompt Engineers Running Regression Tests

Engineers who iterate on prompts and need to know when a prompt change causes output to drift beyond acceptable bounds. They write test cases that call the LLM with a prompt, then `expect(output).toMatchPromptSnapshot({ strategy: 'semantic', threshold: 0.85 })`. On the first run, the snapshot is created. On subsequent runs after prompt changes, the test passes if the output is semantically similar (above threshold) and fails if it drifted too far. The snapshot acts as a regression guard: it does not demand identical output, but it catches meaningful changes. When the engineer intentionally changes the prompt's behavior (e.g., switching from formal to casual tone), they review the diff and run `--update-snapshots` to accept the new baseline.

### AI Application Developers Validating Structured Output

Developers building applications that rely on LLMs to produce structured JSON (user profiles, product descriptions, classification results, tool call arguments). They need field-level validation: the `status` field must be exactly `"success"`, the `confidence` field must be a number, the `explanation` field can vary in wording. They define a `FieldMatchSchema` that specifies per-field strategies and the test validates each field independently. When the LLM provider updates their model and the `explanation` wording changes slightly, the test still passes because `explanation` uses semantic matching. But if `status` changes from `"success"` to `"completed"`, the exact-match field catches it.

### CI/CD Pipelines with Prompt Quality Gates

Teams that run LLM-powered features and need automated quality gates in CI. The test suite calls the LLM with a fixed set of test prompts, compares against stored snapshots using configurable matching, and fails the build if any snapshot comparison drops below threshold. This catches regressions introduced by model updates, prompt template changes, or system prompt modifications. Heuristic matching strategies (Jaccard, contains, structural) run without embedding API calls, making them suitable for CI environments without API keys.

### Teams Migrating Between LLM Providers or Models

When switching from GPT-4 to Claude or upgrading from one model version to another, teams need to verify that the new model's outputs are functionally equivalent. They run their existing snapshot test suite against the new model -- exact fields must still match, semantic similarity must remain above threshold, structural output must maintain the same shape. The detailed per-field diff report shows exactly where the new model diverges, enabling targeted prompt adjustments.

### Test Authors Building Comprehensive LLM Test Suites

Developers who want to build thorough test coverage for LLM-powered features without the fragility of exact string matching. They combine `prompt-snap` with their test framework to write tests that cover: happy-path output validation (semantic snapshot), error response format (structural snapshot), specific required fields (key-field snapshot), and content requirements (contains/regex matching). The test suite runs deterministically against recorded outputs (using `llm-vcr` for recording) or live against the LLM with fuzzy matching tolerance.

---

## 4. Core Concepts

### Snapshot

A snapshot is a stored representation of an LLM output along with the matching configuration used to compare future outputs against it. A snapshot contains:

- `id`: A unique identifier derived from the test name and optional label, used to look up the stored snapshot on subsequent runs.
- `value`: The stored output -- either a string or a parsed JSON object -- captured on the first run or the most recent update.
- `strategy`: The matching strategy (or strategies, for per-field matching) that will be applied when comparing a new output against this stored value.
- `threshold`: The minimum similarity score required for the comparison to pass (applicable to strategies that produce continuous scores: `semantic`, `jaccard`).
- `metadata`: Timestamp of last update, `prompt-snap` version that created the snapshot, and an optional human-readable description.

Snapshots are not the same as expected values in traditional assertions. A traditional assertion says "the output must be exactly X." A snapshot says "the output should be similar to X, as measured by the configured strategy and threshold." The snapshot is a reference point, not a contract.

### Matching Strategy

A matching strategy defines how a new output is compared against a stored snapshot value. Each strategy answers a different question about the relationship between actual and expected:

- **exact**: Are they identical strings? (No tolerance for any difference.)
- **semantic**: Do they mean the same thing? (Tolerance for different wording.)
- **structural**: Do they have the same shape? (Tolerance for different values.)
- **keyField**: Does each field pass its own field-specific strategy? (Mixed tolerance per field.)
- **contains**: Does the actual output contain all required substrings from the expected? (Tolerance for additional content.)
- **regex**: Does the actual output match a pattern derived from the expected? (Pattern-based tolerance.)
- **jaccard**: Do they share enough words? (Tolerance measured by word overlap.)
- **custom**: Does a user-provided function say they match? (Arbitrary tolerance logic.)

Strategies produce a `MatchResult` that includes a boolean `pass`, a numeric `score` (0-1, where 1.0 is a perfect match), and `details` explaining how the comparison was computed.

### Field Match Schema

A field match schema (`FieldMatchSchema`) is a configuration object that maps field paths to matching strategies for structured (JSON) outputs. It enables different levels of matching tolerance for different parts of the output:

```typescript
const schema: FieldMatchSchema = {
  name: 'exact',
  description: { strategy: 'semantic', threshold: 0.85 },
  items: 'structural',
  reasoning: { strategy: 'custom', matcher: (actual) => actual.length > 0 },
  'metadata.version': 'exact',
};
```

The schema uses dot-notation for nested fields (`metadata.version`). Array fields can be matched element-wise, by length, or by any-order containment. Fields not listed in the schema use a configurable default strategy (default: `exact`).

### Snapshot File

A snapshot file is a JSON document stored in the `.prompt-snap` directory. Each test file has a corresponding snapshot file. The snapshot file contains all snapshots created by tests in that file, keyed by snapshot ID. The file is human-readable and designed for code review -- when a snapshot update changes the stored values, the diff in a pull request shows exactly what changed.

### Snapshot Lifecycle

The lifecycle of a snapshot follows four stages:

1. **Create**: The test runs for the first time with no stored snapshot. The actual output is stored as the new snapshot with the configured strategy and threshold. The test passes (first-run creation always passes).
2. **Compare**: The test runs with an existing snapshot. The actual output is compared against the stored value using the configured strategy. If the comparison passes (score above threshold), the test passes. If it fails, the test fails with a detailed diff report.
3. **Update**: The developer runs with `--update-snapshots` or `PROMPT_SNAP_UPDATE=1`. All snapshot comparisons are skipped; actual outputs replace stored values. The test always passes in update mode.
4. **Clean**: Stale snapshots (stored but never accessed during the test run) are detected and can be removed via the CLI or `--clean-snapshots` flag.

### Embedder Function

The embedder function (`EmbedFn`) is the integration point between `prompt-snap` and any embedding provider. It has the signature `(text: string) => Promise<number[]>` and returns a vector of floating-point numbers. `prompt-snap` calls this function on both the actual and expected texts, then computes cosine similarity between the resulting vectors. The user is responsible for authentication, rate limiting, caching, and choosing the embedding model. Built-in adapters (`createOpenAIEmbedder`, `createVoyageEmbedder`) construct the embedder from provider credentials as optional peer-dependency imports.

### Match Result

A `MatchResult` is the output of comparing an actual value against a stored snapshot. It contains:

- `pass`: Whether the comparison meets the configured threshold.
- `score`: A 0-1 similarity score (1.0 = perfect match). For strategies that are binary (exact, contains, regex), the score is either 0.0 or 1.0.
- `strategy`: Which strategy was used.
- `details`: A `MatchDetails` object with strategy-specific information -- per-field results for `keyField`, similarity breakdown for `semantic`, missing/extra keys for `structural`.
- `diff`: An optional human-readable diff string for terminal display.
- `durationMs`: Time taken to compute the match.

---

## 5. Matching Strategies

### 5.1 Exact

**Strategy ID**: `'exact'`

**What it does**: Compares the actual output to the stored snapshot using strict string equality (`===` for strings, deep equality for objects). This is equivalent to Jest's `toMatchSnapshot()` behavior. No tolerance for any difference -- a single character change fails the match.

**When to use**: Fields that must not change between runs -- status codes, error codes, enum values, IDs that are deterministically generated, boolean flags, fixed labels. Also useful as the default fallback when no strategy is specified and deterministic output is expected.

**Configuration**: None. Exact matching has no tunable parameters.

**Score behavior**: 1.0 if values are identical, 0.0 otherwise. No intermediate scores.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({ strategy: 'exact' });
```

**Comparison algorithm**:
1. If both values are strings, compare with `===`.
2. If both values are objects or arrays, perform a recursive deep equality check: same keys, same types, same values at every level. Key ordering does not matter for objects. Array element ordering matters.
3. If the types differ (string vs. object), the match fails with score 0.0.

---

### 5.2 Semantic

**Strategy ID**: `'semantic'`

**What it does**: Embeds both the actual output and the stored snapshot as vectors, then computes cosine similarity. If the similarity score meets or exceeds the configured threshold, the match passes. This strategy catches paraphrases, rewordings, and structural variations that preserve meaning.

**When to use**: Free-text fields where the wording varies between runs but the meaning should remain stable -- descriptions, explanations, summaries, reasoning text, natural-language responses. The primary strategy for comparing full LLM text outputs.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.85` | Minimum cosine similarity for a pass. |
| `embedFn` | `EmbedFn` | Required | The embedding function. Must be provided at the snapshotter level or per-match. |

**Score behavior**: Continuous 0.0 to 1.0, representing the cosine similarity between the two embedding vectors. Typical thresholds: 0.85 for "same meaning, different words", 0.90 for "very similar", 0.75 for "related topic".

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({
  strategy: 'semantic',
  threshold: 0.85,
});
```

**Comparison algorithm**:
1. Call `embedFn(actual)` and `embedFn(expected)` to produce vectors `a` and `b`.
2. Compute cosine similarity: `score = dot(a, b) / (norm(a) * norm(b))`.
3. If `score >= threshold`, pass. Otherwise fail.
4. If `embedFn` throws or returns a zero-length vector, the match fails with an error in the details.

**Embedding function requirements**: The function must return vectors of consistent dimensionality across calls. The package does not validate dimensionality -- if mismatched vectors are returned, cosine similarity will produce NaN, which is treated as a failed match.

**Performance note**: Semantic matching requires two embedding API calls per comparison (or one if caching is implemented in the embedder). For large test suites, consider using `embed-cache` from this monorepo to avoid redundant API calls when the snapshot value has not changed.

---

### 5.3 Structural

**Strategy ID**: `'structural'`

**What it does**: Compares the structure (shape) of two JSON values: same keys at every level, same types for each value, same array lengths. Values themselves are ignored -- only the skeleton matters. This catches cases where the LLM produces the right structure but with different content.

**When to use**: Structured outputs where the schema must remain stable but values are expected to vary -- JSON tool call responses where the shape matters but the data is dynamic, API responses where the contract is structural, configuration objects where the key set must be stable.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `allowExtraKeys` | `boolean` | `false` | Whether the actual output may contain keys not present in the snapshot. |
| `allowMissingKeys` | `boolean` | `false` | Whether the actual output may omit keys present in the snapshot. |
| `checkArrayLength` | `boolean` | `true` | Whether arrays must have the same length (true) or just the same element type (false). |

**Score behavior**: 1.0 if structures match perfectly. Score decreases proportionally to the fraction of structural mismatches: `score = 1.0 - (mismatchCount / totalFieldCount)`. A completely different structure scores near 0.0.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({ strategy: 'structural' });
```

**Comparison algorithm**:
1. Parse both values as JSON (if strings, attempt `JSON.parse`; if already objects, use directly).
2. If parsing fails for either value, the match fails with score 0.0.
3. Recursively walk both objects in parallel:
   a. For each key in the expected object, check that the key exists in the actual object and that the value has the same type (using `typeof` for primitives, `Array.isArray` for arrays, recursive check for nested objects).
   b. If `!allowExtraKeys`, check that the actual object has no keys absent from the expected.
   c. If `!allowMissingKeys`, check that the actual object has all keys present in the expected.
   d. For arrays: if `checkArrayLength`, verify lengths match. Check element types: if the expected array has at least one element, verify each actual element has the same type as the expected element (using the first element as the type exemplar).
4. Compute score: `matchedFields / totalFields`.
5. Collect structural diff details: list of missing keys, extra keys, type mismatches, array length differences, with their paths.

---

### 5.4 Key-Field

**Strategy ID**: `'keyField'`

**What it does**: Applies per-field matching strategies defined by a `FieldMatchSchema`. Each field in the JSON output is matched independently using its assigned strategy. Fields not in the schema use a configurable default strategy. This is the most powerful strategy for structured outputs -- it combines the precision of exact matching for critical fields with the flexibility of semantic matching for free-text fields.

**When to use**: Any structured output where different fields need different tolerance levels. The canonical use case: an LLM produces a JSON object where some fields are deterministic (IDs, status codes, types) and others are non-deterministic (descriptions, explanations, generated content).

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `schema` | `FieldMatchSchema` | Required | Per-field matching rules. |
| `defaultStrategy` | `MatchStrategyConfig` | `'exact'` | Strategy for fields not listed in the schema. |
| `ignoreExtraFields` | `boolean` | `false` | Whether to ignore fields in the actual output that are not in the schema. |

**Score behavior**: Weighted average of per-field scores. All fields have equal weight by default. The overall match passes only if every field passes its individual strategy threshold.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({
  strategy: 'keyField',
  schema: {
    name: 'exact',
    description: { strategy: 'semantic', threshold: 0.85 },
    tags: 'structural',
    confidence: { strategy: 'custom', matcher: (actual, expected) => Math.abs(actual - expected) < 0.1 },
  },
});
```

**Comparison algorithm**:
1. Parse both values as JSON.
2. For each field in the schema, extract the value from both actual and expected using dot-notation path resolution (`a.b.c` resolves to `obj.a.b.c`).
3. Apply the field's configured strategy:
   - String shorthand (`'exact'`, `'structural'`) resolves to a strategy with default configuration.
   - Object config (`{ strategy: 'semantic', threshold: 0.85 }`) uses the specified strategy with overridden options.
4. Collect per-field `MatchResult` objects.
5. If `!ignoreExtraFields`, check for fields in actual that are absent from the schema. Extra fields fail with the default strategy.
6. Compute overall score as the mean of per-field scores. Overall pass requires all fields to pass individually.
7. Return a `MatchResult` with `details.fields` containing the per-field results.

**Nested field handling**: Dot-notation paths (`metadata.version`, `items.0.name`) resolve through nested objects and arrays. The path `items.*.name` matches all elements of the `items` array, applying the strategy to each element's `name` field.

**Array field handling**: Arrays can be matched in three modes:
- **Element-wise** (default): Compare element at index 0 of actual with element at index 0 of expected, and so on. Arrays must have the same length.
- **Any-order**: Each expected element must have a match in the actual array (using the configured strategy), regardless of position. Configured by setting `arrayMode: 'any-order'` on the field.
- **Length-only**: Arrays must have the same length, but element values are not compared. Configured by setting `arrayMode: 'length-only'`.

---

### 5.5 Contains

**Strategy ID**: `'contains'`

**What it does**: Checks that the actual output contains all required substrings extracted from the stored snapshot. The snapshot value is split into expected substrings (by default, one per line or one per sentence), and each substring is checked for presence in the actual output. This catches cases where the LLM includes all required information but surrounds it with additional context.

**When to use**: Outputs where specific phrases, terms, or facts must be present, but the surrounding text can vary. Fact-checking prompts where the answer must mention specific entities. Instruction-following tests where the output must include specific keywords.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `substrings` | `string[]` | Derived from snapshot | Explicit list of required substrings. If not provided, the snapshot value is split into substrings by sentence boundaries. |
| `caseSensitive` | `boolean` | `false` | Whether substring matching is case-sensitive. |
| `minMatchRatio` | `number` | `1.0` | Minimum fraction of substrings that must be found (1.0 = all, 0.8 = at least 80%). |

**Score behavior**: `matchedSubstrings / totalSubstrings`. Score of 1.0 means all substrings found. Pass requires `score >= minMatchRatio`.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({
  strategy: 'contains',
  caseSensitive: false,
  minMatchRatio: 0.8,
});
```

**Comparison algorithm**:
1. Determine the list of expected substrings: use `substrings` option if provided, otherwise split the stored snapshot value into sentences using rule-based sentence boundary detection.
2. For each expected substring, check if it exists in the actual output:
   a. If `caseSensitive`, use `actual.includes(substring)`.
   b. If `!caseSensitive`, use `actual.toLowerCase().includes(substring.toLowerCase())`.
3. `score = matchedCount / totalCount`.
4. `pass = score >= minMatchRatio`.
5. Report missing substrings in `details.missing`.

---

### 5.6 Regex

**Strategy ID**: `'regex'`

**What it does**: Tests the actual output against a regular expression pattern. The pattern can be explicitly provided, or it can be auto-derived from the stored snapshot by replacing variable parts with wildcard patterns. This strategy is useful for outputs with a predictable structure but variable content.

**When to use**: Outputs that follow a known format -- dates, IDs, version strings, structured responses with variable data. Also useful for validating that the output matches a general pattern (e.g., "starts with a greeting, contains a numbered list, ends with a summary").

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `pattern` | `RegExp \| string` | Derived from snapshot | Explicit regex pattern. If not provided, the snapshot value is used as the pattern (interpreted as a regex string). |
| `flags` | `string` | `'s'` | Regex flags (e.g., `'i'` for case-insensitive, `'s'` for dotAll). |
| `fullMatch` | `boolean` | `false` | Whether the entire output must match (true) or just a substring (false, equivalent to `regex.test()`). |

**Score behavior**: 1.0 if the regex matches, 0.0 otherwise. Binary pass/fail.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({
  strategy: 'regex',
  pattern: /^Hello,?\s+\w+[.!]\s+/,
  flags: 'i',
});
```

**Comparison algorithm**:
1. Construct the regex: if `pattern` is provided, use it directly. If `pattern` is a string, compile it with `new RegExp(pattern, flags)`.
2. If no `pattern` is provided, use the stored snapshot value as the regex string.
3. If `fullMatch`, wrap the pattern in `^` and `$` anchors (if not already present).
4. Test: `regex.test(actual)`.
5. Score: 1.0 if matched, 0.0 if not.
6. If the regex is invalid (compilation throws), fail with error details.

---

### 5.7 Jaccard

**Strategy ID**: `'jaccard'`

**What it does**: Computes the word-level Jaccard similarity between the actual output and the stored snapshot: the size of the intersection of word sets divided by the size of the union. This is a lightweight, embedding-free measure of text overlap that does not require API calls or ML models.

**When to use**: When semantic matching is desirable but embedding API calls are not available or too expensive. When the expected and actual outputs should share most of the same vocabulary. When running in CI without API keys. As a cheaper approximation of semantic similarity for outputs where vocabulary overlap strongly correlates with meaning overlap (e.g., factual answers, technical descriptions).

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.6` | Minimum Jaccard similarity for a pass. |
| `caseSensitive` | `boolean` | `false` | Whether word comparison is case-sensitive. |
| `removeStopwords` | `boolean` | `true` | Whether to remove common English stopwords before comparison. |
| `stemWords` | `boolean` | `false` | Whether to apply Porter stemming before comparison. |

**Score behavior**: Continuous 0.0 to 1.0. `score = |A intersection B| / |A union B|` where A and B are the word sets (after optional stopword removal and stemming) of the actual and expected values.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({
  strategy: 'jaccard',
  threshold: 0.65,
  removeStopwords: true,
});
```

**Comparison algorithm**:
1. Tokenize both strings: split on whitespace and punctuation, lowercase (unless `caseSensitive`), filter empty tokens.
2. If `removeStopwords`, remove tokens that appear in the built-in English stopword list (~150 words).
3. If `stemWords`, apply Porter stemming to each token.
4. Compute word sets A (actual tokens) and B (expected tokens).
5. `intersection = A & B` (tokens present in both sets).
6. `union = A | B` (tokens present in either set).
7. `score = intersection.size / union.size` (0.0 if union is empty).
8. `pass = score >= threshold`.

**Limitations**: Jaccard similarity is purely lexical -- it does not understand synonyms, paraphrases, or semantic equivalence. "The capital of France is Paris" and "Paris serves as France's capital city" have a Jaccard score of approximately 0.5 (depending on stopword configuration), despite being semantically identical. For semantic matching, use the `semantic` strategy.

---

### 5.8 Custom

**Strategy ID**: `'custom'`

**What it does**: Delegates the matching decision to a user-provided function. The function receives the actual value, the expected (stored) value, and returns a `CustomMatchResult` indicating pass/fail and an optional score. This is the escape hatch for matching logic that does not fit any built-in strategy.

**When to use**: Domain-specific comparison logic -- numerical tolerance, date range checks, custom normalization, business rule validation. Any case where the comparison cannot be expressed as one of the built-in strategies.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `matcher` | `CustomMatcherFn` | Required | The matching function. |

The matcher function signature:
```typescript
type CustomMatcherFn = (
  actual: unknown,
  expected: unknown,
) => CustomMatchResult | Promise<CustomMatchResult>;

interface CustomMatchResult {
  pass: boolean;
  score?: number;       // 0-1, defaults to 1.0 if pass, 0.0 if fail
  message?: string;     // Human-readable explanation
}
```

**Score behavior**: Determined by the user's function. If `score` is not returned, it defaults to 1.0 for pass and 0.0 for fail.

**Example**:
```typescript
expect(output).toMatchPromptSnapshot({
  strategy: 'custom',
  matcher: (actual, expected) => {
    const actualNum = parseFloat(actual.confidence);
    const expectedNum = parseFloat(expected.confidence);
    return {
      pass: Math.abs(actualNum - expectedNum) < 0.1,
      score: 1.0 - Math.abs(actualNum - expectedNum),
      message: `Confidence difference: ${Math.abs(actualNum - expectedNum)}`,
    };
  },
});
```

---

## 6. Per-Field Matching

### Field Match Schema Design

The `FieldMatchSchema` is the core configuration surface for structured output matching. It maps field paths to matching strategies, enabling fine-grained control over how each part of a JSON output is compared.

**Schema format**:
```typescript
type FieldMatchSchema = Record<string, FieldMatchRule>;

type FieldMatchRule =
  | MatchStrategyId                       // shorthand: 'exact', 'semantic', etc.
  | FieldMatchConfig;                     // full config object

interface FieldMatchConfig {
  strategy: MatchStrategyId;
  threshold?: number;
  embedFn?: EmbedFn;
  matcher?: CustomMatcherFn;
  arrayMode?: 'element-wise' | 'any-order' | 'length-only';
  caseSensitive?: boolean;
  optional?: boolean;                     // field may be absent without failing
  [key: string]: unknown;                 // strategy-specific options
}
```

### Path Resolution

Field paths use dot-notation to address nested fields:

- `name` -- top-level field.
- `metadata.version` -- nested field.
- `items.0.name` -- specific array element by index.
- `items.*.name` -- all array elements (wildcard).

The path resolver handles:
- Missing intermediate keys: if the path `a.b.c` and `a.b` does not exist in the actual output, the field is treated as missing. If the field is `optional: true`, the match passes. If `optional: false` (default), the match fails for that field.
- Null values: `null` at any point in the path resolves to `null`. The strategy is applied to the `null` value -- for exact match, `null === null` passes.

### Nested Object Matching

When a field match rule targets a nested path, only that specific field is matched with the specified strategy. Sibling fields at the same nesting level are not affected. This enables mixing match strategies at arbitrary depth:

```typescript
const schema: FieldMatchSchema = {
  'response.status': 'exact',
  'response.data.title': 'exact',
  'response.data.description': { strategy: 'semantic', threshold: 0.80 },
  'response.data.items': 'structural',
  'response.metadata.generatedAt': { strategy: 'custom', matcher: () => ({ pass: true }) },
};
```

### Array Matching Modes

Arrays require special handling because LLMs may produce array elements in different orders or with slightly different content.

**Element-wise** (default): Arrays must have the same length. Element at index `i` in actual is compared with element at index `i` in expected, using the configured field strategy. This is the strictest mode -- both order and content matter.

**Any-order**: Both arrays must have the same length. For each element in the expected array, the algorithm finds the best-matching element in the actual array (using the configured strategy), removing matched elements to prevent double-counting. All expected elements must find a match above threshold. This handles cases where the LLM produces the same items but in a different order.

**Length-only**: Arrays must have the same length. Element content is not compared. This is useful for fields where the count matters (e.g., "produce exactly 5 suggestions") but the content is expected to vary.

### Optional Fields

Fields marked `optional: true` in the schema do not fail the match if they are absent from the actual output. If the field is present, it is matched normally against the stored value. If absent, it is excluded from the overall score calculation. This handles LLM outputs where certain fields are sometimes omitted.

### Default Strategy for Unlisted Fields

Fields present in the stored snapshot but not listed in the `FieldMatchSchema` are matched using the `defaultStrategy` option (default: `'exact'`). This provides a safety net: if the LLM adds a new field or the schema omits a field, it falls back to strict matching rather than silently accepting changes.

If `ignoreExtraFields` is true, fields present in the actual output but absent from both the schema and the stored snapshot are ignored entirely.

---

## 7. Snapshot File Format

### Directory Structure

Snapshot files are stored in a `.prompt-snap` directory alongside the test file:

```
src/
  __tests__/
    chat.test.ts
    .prompt-snap/
      chat.test.ts.snap.json
    classify.test.ts
    .prompt-snap/
      classify.test.ts.snap.json
```

The directory name `.prompt-snap` follows the convention of Jest's `__snapshots__` directory. The `.prompt-snap` prefix (with leading dot) keeps the directory hidden in most file explorers by default but visible in version control diffs.

Alternatively, all snapshots can be stored in a single configured directory (e.g., `<projectRoot>/.prompt-snap/`) when the `snapshotDir` option is set.

### File Format

Each snapshot file is a JSON document with the following structure:

```json
{
  "__meta": {
    "version": 1,
    "createdBy": "prompt-snap@0.1.0",
    "updatedAt": "2026-03-18T12:00:00.000Z"
  },
  "chat responds with greeting": {
    "value": "Hello! How can I assist you today?",
    "strategy": "semantic",
    "threshold": 0.85,
    "updatedAt": "2026-03-18T12:00:00.000Z"
  },
  "classify returns valid JSON": {
    "value": {
      "label": "positive",
      "confidence": 0.92,
      "explanation": "The text expresses satisfaction and approval."
    },
    "strategy": "keyField",
    "schema": {
      "label": "exact",
      "confidence": { "strategy": "custom" },
      "explanation": { "strategy": "semantic", "threshold": 0.80 }
    },
    "updatedAt": "2026-03-18T12:00:00.000Z"
  }
}
```

The format is designed to be:

1. **Human-readable**: JSON with meaningful keys (snapshot IDs are test names). Reviewers can inspect stored values directly.
2. **Diffable**: Changes to snapshot values produce clean diffs in pull requests. The JSON structure makes additions, deletions, and modifications easy to identify.
3. **Self-describing**: Each snapshot includes its strategy and threshold, so the comparison rules are visible in the snapshot file without consulting the test code.
4. **Versioned**: The `__meta.version` field enables format migrations in future versions.

### Snapshot ID Generation

The snapshot ID is derived from the test name and an optional label:

- **Default**: The full test name from the test framework (e.g., `"chat > responds with greeting"` in Vitest/Jest).
- **Custom label**: If the test creates multiple snapshots, each can have a label: `expect(output).toMatchPromptSnapshot({ label: 'english' })`.
- **Composed ID**: `"<test name> > <label>"` if a label is provided, just `"<test name>"` otherwise.
- **Sanitization**: IDs are sanitized to remove characters that are invalid in JSON keys, but no aggressive truncation -- the full test name is preserved for readability.

### Encoding

Snapshot values that are strings are stored as JSON strings. Values that are objects are stored as JSON objects. Binary data, functions, and non-serializable values are not supported -- they cause a descriptive error at snapshot creation time.

---

## 8. Snapshot Lifecycle

### First Run: Snapshot Creation

When `toMatchPromptSnapshot()` or `matchSnapshot()` is called and no stored snapshot exists for the given ID:

1. The actual value is serialized (strings as-is, objects via `JSON.parse` if string or direct if already an object).
2. The strategy, threshold, and any per-field schema are recorded alongside the value.
3. The snapshot is written to the snapshot file (creating the file and `.prompt-snap` directory if they do not exist).
4. The match passes with score 1.0 (trivially -- the actual matches itself).
5. A console message notes that a new snapshot was created: `"Snapshot created: <snapshot ID>"`.

This behavior mirrors Jest: the first run always passes and creates the baseline.

### Subsequent Runs: Comparison

When a stored snapshot exists:

1. The stored value and configuration are loaded from the snapshot file.
2. The actual value is compared against the stored value using the configured strategy.
3. If the match passes (score >= threshold), the test passes.
4. If the match fails, the test fails with a detailed `MatchResult` including score, per-field details (for `keyField`), and a formatted diff string.

The stored snapshot is never modified during comparison runs. Even if the actual output is "better" than the stored one, the snapshot remains unchanged until explicitly updated.

### Update Mode

Update mode is activated by:
- **CLI flag**: `--update-snapshots` when running the test framework (e.g., `vitest run --update-snapshots`, with `prompt-snap` detecting the flag via environment variable or framework API).
- **Environment variable**: `PROMPT_SNAP_UPDATE=1`.
- **Programmatic**: `setupPromptSnap({ update: true })` or `createSnapshotter({ update: true })`.

In update mode:
1. Comparison is skipped entirely.
2. The actual value replaces the stored snapshot value.
3. Strategy and threshold configuration is preserved (or updated if the test code changed them).
4. `updatedAt` is set to the current timestamp.
5. The match passes with score 1.0.
6. A console message notes the update: `"Snapshot updated: <snapshot ID>"`.

### Stale Snapshot Detection

After a full test run, any snapshots in the snapshot file that were never accessed (never compared or updated) are flagged as stale. Stale snapshots occur when test names change, tests are deleted, or snapshot labels are modified.

Stale snapshots are reported in the test run summary: `"3 stale snapshots in .prompt-snap/chat.test.ts.snap.json"`. They are not automatically deleted -- the developer must explicitly clean them via `prompt-snap clean` or `--clean-snapshots`.

The staleness tracker works by recording each snapshot ID that is accessed during the test run. After the run completes, any IDs in the snapshot file that were not accessed are stale. This requires a test-run-lifecycle hook (beforeAll/afterAll in the test framework) to track accesses.

---

## 9. API Surface

### Installation

```bash
npm install prompt-snap
```

For semantic matching with OpenAI embeddings:
```bash
npm install prompt-snap openai
```

### Test Framework Matcher: `toMatchPromptSnapshot`

The primary API for Jest and Vitest users. Registered via `expect.extend()`.

**Setup** (in test setup file or at the top of each test file):

```typescript
import { setupPromptSnap } from 'prompt-snap';

setupPromptSnap({
  strategy: 'semantic',
  threshold: 0.85,
  embedFn: myEmbedFn,
  snapshotDir: '.prompt-snap',
});
```

**Usage**:

```typescript
import { expect, it } from 'vitest';

it('generates a greeting', async () => {
  const output = await llm.generate('Say hello to the user');
  await expect(output).toMatchPromptSnapshot();
});

it('classifies sentiment', async () => {
  const output = await llm.generate('Classify: "I love this product"');
  await expect(JSON.parse(output)).toMatchPromptSnapshot({
    strategy: 'keyField',
    schema: {
      label: 'exact',
      confidence: { strategy: 'custom', matcher: (a, e) => ({ pass: Math.abs(a - e) < 0.15 }) },
      explanation: { strategy: 'semantic', threshold: 0.80 },
    },
  });
});
```

**Signature**:

```typescript
interface PromptSnapMatcherOptions {
  strategy?: MatchStrategyId;
  threshold?: number;
  label?: string;
  schema?: FieldMatchSchema;
  embedFn?: EmbedFn;
  // Strategy-specific options
  caseSensitive?: boolean;
  removeStopwords?: boolean;
  stemWords?: boolean;
  allowExtraKeys?: boolean;
  allowMissingKeys?: boolean;
  checkArrayLength?: boolean;
  arrayMode?: 'element-wise' | 'any-order' | 'length-only';
  defaultStrategy?: MatchStrategyConfig;
  ignoreExtraFields?: boolean;
  substrings?: string[];
  minMatchRatio?: number;
  pattern?: RegExp | string;
  flags?: string;
  fullMatch?: boolean;
  matcher?: CustomMatcherFn;
}

// Extends expect with:
// expect(actual).toMatchPromptSnapshot(options?: PromptSnapMatcherOptions): Promise<void>
```

### Standalone Function: `matchSnapshot`

For framework-agnostic use or when `expect.extend()` is not desirable.

```typescript
import { matchSnapshot } from 'prompt-snap';

const result = await matchSnapshot(actualOutput, 'my-snapshot-id', {
  strategy: 'semantic',
  threshold: 0.85,
  embedFn: myEmbedFn,
  snapshotDir: '/path/to/.prompt-snap',
  snapshotFile: 'my-test.snap.json',
});

if (!result.pass) {
  console.error(`Snapshot mismatch (score: ${result.score}):`, result.diff);
}
```

**Signature**:

```typescript
function matchSnapshot(
  actual: unknown,
  snapshotId: string,
  options: MatchSnapshotOptions,
): Promise<MatchResult>;

interface MatchSnapshotOptions extends PromptSnapMatcherOptions {
  snapshotDir?: string;
  snapshotFile?: string;
  update?: boolean;
}
```

### Update Function: `updateSnapshot`

Programmatically update a specific snapshot.

```typescript
import { updateSnapshot } from 'prompt-snap';

await updateSnapshot('my-snapshot-id', newValue, {
  snapshotDir: '/path/to/.prompt-snap',
  snapshotFile: 'my-test.snap.json',
  strategy: 'semantic',
  threshold: 0.85,
});
```

**Signature**:

```typescript
function updateSnapshot(
  snapshotId: string,
  value: unknown,
  options: UpdateSnapshotOptions,
): Promise<void>;

interface UpdateSnapshotOptions {
  snapshotDir?: string;
  snapshotFile?: string;
  strategy?: MatchStrategyId;
  threshold?: number;
  schema?: FieldMatchSchema;
}
```

### Factory: `createSnapshotter`

Creates a pre-configured instance for reuse across tests.

```typescript
import { createSnapshotter } from 'prompt-snap';

const snap = createSnapshotter({
  strategy: 'semantic',
  threshold: 0.85,
  embedFn: myEmbedFn,
  snapshotDir: '.prompt-snap',
});

// In tests:
const result = await snap.match(output, 'greeting-test');
const result2 = await snap.match(jsonOutput, 'classify-test', {
  strategy: 'keyField',
  schema: { label: 'exact', explanation: { strategy: 'semantic', threshold: 0.80 } },
});
```

**Signature**:

```typescript
function createSnapshotter(config: SnapshotterConfig): Snapshotter;

interface SnapshotterConfig {
  strategy?: MatchStrategyId;
  threshold?: number;
  embedFn?: EmbedFn;
  snapshotDir?: string;
  update?: boolean;
  defaultFieldStrategy?: MatchStrategyConfig;
}

interface Snapshotter {
  match(actual: unknown, snapshotId: string, options?: PromptSnapMatcherOptions): Promise<MatchResult>;
  update(snapshotId: string, value: unknown, options?: UpdateSnapshotOptions): Promise<void>;
  listSnapshots(snapshotFile?: string): SnapshotEntry[];
  cleanStale(snapshotFile: string, accessedIds: Set<string>): Promise<number>;
}
```

### Type Definitions

```typescript
// ── Strategy Types ──────────────────────────────────────────────────

type MatchStrategyId = 'exact' | 'semantic' | 'structural' | 'keyField' | 'contains' | 'regex' | 'jaccard' | 'custom';

type MatchStrategyConfig =
  | MatchStrategyId
  | { strategy: MatchStrategyId; [key: string]: unknown };

// ── Embedding ──────────────────────────────────────────────────────

type EmbedFn = (text: string) => Promise<number[]>;

// ── Custom Matcher ──────────────────────────────────────────────────

type CustomMatcherFn = (
  actual: unknown,
  expected: unknown,
) => CustomMatchResult | Promise<CustomMatchResult>;

interface CustomMatchResult {
  pass: boolean;
  score?: number;
  message?: string;
}

// ── Match Result ────────────────────────────────────────────────────

interface MatchResult {
  /** Whether the match passed the configured threshold. */
  pass: boolean;

  /** Similarity score, 0.0 (no match) to 1.0 (perfect match). */
  score: number;

  /** The strategy that was used. */
  strategy: MatchStrategyId;

  /** Strategy-specific match details. */
  details: MatchDetails;

  /** Human-readable diff for terminal display. Undefined when match passes. */
  diff?: string;

  /** Time taken to compute the match, in milliseconds. */
  durationMs: number;
}

/** Strategy-specific details. Discriminated by strategy. */
type MatchDetails =
  | ExactMatchDetails
  | SemanticMatchDetails
  | StructuralMatchDetails
  | KeyFieldMatchDetails
  | ContainsMatchDetails
  | RegexMatchDetails
  | JaccardMatchDetails
  | CustomMatchDetails;

interface ExactMatchDetails {
  strategy: 'exact';
  identical: boolean;
}

interface SemanticMatchDetails {
  strategy: 'semantic';
  cosineSimilarity: number;
  threshold: number;
  embeddingDimension: number;
}

interface StructuralMatchDetails {
  strategy: 'structural';
  missingKeys: string[];
  extraKeys: string[];
  typeMismatches: Array<{ path: string; expectedType: string; actualType: string }>;
  arrayLengthMismatches: Array<{ path: string; expectedLength: number; actualLength: number }>;
  totalFields: number;
  matchedFields: number;
}

interface KeyFieldMatchDetails {
  strategy: 'keyField';
  fields: Record<string, MatchResult>;
  missingFields: string[];
  extraFields: string[];
}

interface ContainsMatchDetails {
  strategy: 'contains';
  matchedSubstrings: string[];
  missingSubstrings: string[];
  totalSubstrings: number;
}

interface RegexMatchDetails {
  strategy: 'regex';
  pattern: string;
  flags: string;
  matched: boolean;
}

interface JaccardMatchDetails {
  strategy: 'jaccard';
  similarity: number;
  threshold: number;
  intersectionSize: number;
  unionSize: number;
  actualTokenCount: number;
  expectedTokenCount: number;
}

interface CustomMatchDetails {
  strategy: 'custom';
  message?: string;
}

// ── Snapshot Types ──────────────────────────────────────────────────

interface SnapshotEntry {
  id: string;
  value: unknown;
  strategy: MatchStrategyId;
  threshold?: number;
  schema?: FieldMatchSchema;
  updatedAt: string;
}

interface SnapshotFile {
  __meta: {
    version: number;
    createdBy: string;
    updatedAt: string;
  };
  [snapshotId: string]: SnapshotEntry | SnapshotFile['__meta'];
}

// ── Field Match Schema ──────────────────────────────────────────────

type FieldMatchSchema = Record<string, FieldMatchRule>;

type FieldMatchRule =
  | MatchStrategyId
  | FieldMatchConfig;

interface FieldMatchConfig {
  strategy: MatchStrategyId;
  threshold?: number;
  embedFn?: EmbedFn;
  matcher?: CustomMatcherFn;
  arrayMode?: 'element-wise' | 'any-order' | 'length-only';
  caseSensitive?: boolean;
  optional?: boolean;
  [key: string]: unknown;
}
```

---

## 10. Test Framework Integration

### Jest Integration

**Setup** (in `jest.setup.ts` or test file):

```typescript
import { setupPromptSnap } from 'prompt-snap';

setupPromptSnap({
  strategy: 'jaccard',
  threshold: 0.6,
  snapshotDir: '.prompt-snap',
});
```

`setupPromptSnap` calls `expect.extend()` internally, registering the `toMatchPromptSnapshot` matcher. In Jest, this must be called before any test uses the matcher. The recommended approach is to call it in the `setupFilesAfterFramework` configuration.

**jest.config.js**:
```javascript
module.exports = {
  setupFilesAfterFramework: ['./jest.setup.ts'],
};
```

**Snapshot update**: Jest's `--updateSnapshot` flag is detected by `prompt-snap` and activates update mode. Alternatively, set `PROMPT_SNAP_UPDATE=1`.

### Vitest Integration

**Setup** (in `vitest.setup.ts` or test file):

```typescript
import { setupPromptSnap } from 'prompt-snap';

setupPromptSnap({
  strategy: 'semantic',
  threshold: 0.85,
  embedFn: myEmbedFn,
});
```

**vitest.config.ts**:
```typescript
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

**Snapshot update**: Vitest's `--update` flag is detected by `prompt-snap`. Alternatively, set `PROMPT_SNAP_UPDATE=1`.

### Standalone Usage (No Framework)

For environments without Jest or Vitest, or for use in scripts, CLI tools, or custom test runners:

```typescript
import { matchSnapshot, createSnapshotter } from 'prompt-snap';

async function runTest(output: string) {
  const result = await matchSnapshot(output, 'my-test-case', {
    strategy: 'jaccard',
    threshold: 0.6,
    snapshotDir: './snapshots',
    snapshotFile: 'my-tests.snap.json',
  });

  if (!result.pass) {
    console.error(`FAIL: score ${result.score} below threshold`);
    console.error(result.diff);
    process.exit(1);
  }
  console.log(`PASS: score ${result.score}`);
}
```

### Framework Detection

`prompt-snap` auto-detects the test framework to determine snapshot update behavior:

1. Check for `PROMPT_SNAP_UPDATE` environment variable (highest priority).
2. Check for Jest's `--updateSnapshot` / `-u` flag via `process.argv`.
3. Check for Vitest's `--update` flag via `process.argv`.
4. Check for programmatic `update: true` in configuration.
5. Default: update mode is off.

---

## 11. Diff Output

### Mismatch Reporting

When a snapshot comparison fails, `prompt-snap` produces a structured diff that helps the developer understand what changed and by how much.

### Exact Match Diff

Shows a character-level diff between expected and actual, with additions and deletions highlighted:

```
Snapshot mismatch: "greeting response" (strategy: exact)

  Expected:
    "Hello! How can I assist you today?"
  Actual:
    "Hi there! How may I help you today?"
           ~~~~ ~~~~~~  ~~~~  ~~~
           +Hi   +may   +help -assist
           +there       -can

  Score: 0.00 (threshold: 1.00)
```

### Semantic Match Diff

Shows the cosine similarity score with a visual gauge and the two texts:

```
Snapshot mismatch: "explanation field" (strategy: semantic)

  Similarity: 0.72 [=========>----------] threshold: 0.85

  Expected:
    "The function calculates the sum of all array elements."
  Actual:
    "This method computes the total by adding each item in the list."

  Score: 0.72 (threshold: 0.85) -- FAIL by 0.13
```

### Structural Match Diff

Highlights the structural differences -- missing keys, extra keys, type mismatches:

```
Snapshot mismatch: "API response" (strategy: structural)

  Missing keys:
    - $.metadata.timestamp (expected: string)
  Extra keys:
    + $.metadata.requestId (actual: string)
  Type mismatches:
    $.data.count: expected number, got string

  Score: 0.80 (10/12 fields matched)
```

### Key-Field Match Diff

Per-field results with individual scores and pass/fail:

```
Snapshot mismatch: "classify result" (strategy: keyField)

  Field              Strategy   Score   Result
  ────────────────────────────────────────────
  label              exact      1.00    PASS
  confidence         custom     0.95    PASS
  explanation        semantic   0.71    FAIL (threshold: 0.80)
  tags               structural 0.83    PASS

  Overall: 0.87 -- FAIL (all fields must pass individually)

  Field "explanation" detail:
    Expected: "The text expresses satisfaction and approval of the product."
    Actual:   "User sentiment is positive based on word choice and enthusiasm."
    Similarity: 0.71 (threshold: 0.80)
```

### Terminal Formatting

Diff output uses ANSI color codes for terminal display:
- Red for removed/failing content.
- Green for added/passing content.
- Yellow for warnings and threshold misses.
- Cyan for score values.
- Bold for headings and field names.

Colors are disabled when `NO_COLOR` environment variable is set, when stdout is not a TTY, or when `--no-color` is passed. The `MatchResult.diff` field contains the formatted string including ANSI codes. A separate `formatDiff(result, { color: false })` function produces an uncolored version for logging.

---

## 12. Update Workflow

### CLI Flag

The primary update mechanism piggybacks on the test framework's snapshot update flag:

```bash
# Vitest
vitest run --update

# Jest
jest --updateSnapshot

# Environment variable (works with any framework)
PROMPT_SNAP_UPDATE=1 vitest run
```

In update mode, every snapshot comparison is skipped and the actual value overwrites the stored snapshot. All tests pass. The snapshot files are modified on disk.

### Selective Update

Not all snapshots should be updated at once. Selective update is supported through:

1. **Test filtering**: Run only the tests whose snapshots need updating: `vitest run -t "greeting"`. Only snapshots accessed by matching tests are updated.
2. **Snapshot ID filtering**: Set `PROMPT_SNAP_UPDATE_FILTER="greeting,classify"` to update only snapshots whose IDs contain one of the comma-separated substrings.
3. **Programmatic**: `snap.update(snapshotId, value)` updates a single snapshot.

### Review Before Accept

The recommended workflow for snapshot updates mirrors Jest best practice:

1. Make the prompt change.
2. Run tests without update: `vitest run`. See which snapshots fail and review the diffs.
3. Decide whether the changes are intentional and acceptable.
4. If yes, run with update: `vitest run --update`.
5. Review the snapshot file changes in `git diff` before committing.
6. Commit the updated snapshot files alongside the prompt changes.

This workflow ensures that snapshot updates are conscious decisions, not automatic acceptances. The snapshot file diff in the pull request makes the impact of the change visible to code reviewers.

### Interactive Update (Future)

An interactive update mode that presents each changed snapshot and asks the developer to accept or reject it (similar to Jest's `--watch` mode with `u` to update). This is a future enhancement, not in v1.

---

## 13. Configuration

### Global Configuration

Set defaults for all `toMatchPromptSnapshot()` calls via `setupPromptSnap()`:

```typescript
setupPromptSnap({
  // Default matching strategy for all snapshots.
  // Default: 'exact'
  strategy: 'semantic',

  // Default similarity threshold for continuous-score strategies.
  // Default: 0.85 for semantic, 0.6 for jaccard, 1.0 for exact/structural/contains/regex
  threshold: 0.85,

  // Embedding function for semantic matching.
  // Required when strategy is 'semantic' or when any field uses semantic matching.
  // Default: undefined (semantic matching fails with an error if not provided)
  embedFn: myEmbedFn,

  // Directory where snapshot files are stored.
  // Default: '.prompt-snap' (relative to the test file's directory)
  snapshotDir: '.prompt-snap',

  // Whether to activate update mode.
  // Default: false (auto-detected from test framework flags)
  update: false,

  // Default field matching strategy for keyField mode.
  // Default: 'exact'
  defaultFieldStrategy: 'exact',
});
```

### Per-Test Configuration

Override global defaults on individual snapshot calls:

```typescript
await expect(output).toMatchPromptSnapshot({
  strategy: 'jaccard',
  threshold: 0.5,
  label: 'low-threshold',
});
```

Per-test options override global options. Missing per-test options fall back to global defaults.

### Configuration Precedence

Options are resolved in order of specificity:

1. Per-test call options (highest priority).
2. `createSnapshotter(config)` instance-level options.
3. `setupPromptSnap(config)` global options.
4. Built-in defaults (lowest priority).

### Default Values

| Option | Default | Description |
|---|---|---|
| `strategy` | `'exact'` | Default matching strategy |
| `threshold` (exact) | `1.0` | Only exact match passes |
| `threshold` (semantic) | `0.85` | Cosine similarity threshold |
| `threshold` (jaccard) | `0.6` | Word overlap threshold |
| `threshold` (contains) | `1.0` | All substrings must be found |
| `threshold` (structural) | `1.0` | Perfect structural match |
| `snapshotDir` | `'.prompt-snap'` | Snapshot directory (relative to test file) |
| `update` | Auto-detected | Snapshot update mode |
| `defaultFieldStrategy` | `'exact'` | Fallback for unlisted fields in keyField mode |
| `caseSensitive` | `false` | For contains, jaccard strategies |
| `removeStopwords` | `true` | For jaccard strategy |
| `stemWords` | `false` | For jaccard strategy |
| `allowExtraKeys` | `false` | For structural strategy |
| `allowMissingKeys` | `false` | For structural strategy |
| `checkArrayLength` | `true` | For structural strategy |
| `ignoreExtraFields` | `false` | For keyField strategy |

---

## 14. CLI

### Command: `prompt-snap`

The CLI provides snapshot management commands separate from the test runner.

```bash
# Global install
npm install -g prompt-snap

# Or via npx
npx prompt-snap <command>
```

### Commands

**`prompt-snap list [dir]`**

List all snapshots in the given directory (default: `.prompt-snap`).

```
$ prompt-snap list

.prompt-snap/chat.test.ts.snap.json
  - "chat responds with greeting"       semantic (0.85)   updated 2026-03-18
  - "chat responds with farewell"        semantic (0.85)   updated 2026-03-18
  - "chat handles error"                 exact             updated 2026-03-15

.prompt-snap/classify.test.ts.snap.json
  - "classify returns valid JSON"        keyField          updated 2026-03-17
  - "classify handles empty input"       exact             updated 2026-03-17

Total: 5 snapshots in 2 files
```

**`prompt-snap stale [dir]`**

Show stale snapshots that were not accessed in the last test run. Requires a `.prompt-snap-accessed.json` file generated by the test run (written automatically when `setupPromptSnap()` is used).

```
$ prompt-snap stale

Stale snapshots (not accessed in last test run):

.prompt-snap/chat.test.ts.snap.json
  - "chat handles timeout"              exact             updated 2026-02-01

1 stale snapshot found. Run 'prompt-snap clean' to remove.
```

**`prompt-snap clean [dir]`**

Remove stale snapshots.

```
$ prompt-snap clean

Removed 1 stale snapshot:
  - "chat handles timeout" from chat.test.ts.snap.json
```

**`prompt-snap show <snapshot-id> [file]`**

Display the stored value of a specific snapshot.

```
$ prompt-snap show "chat responds with greeting" .prompt-snap/chat.test.ts.snap.json

Strategy: semantic (threshold: 0.85)
Updated: 2026-03-18T12:00:00.000Z

Value:
  "Hello! How can I assist you today?"
```

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Error (file not found, invalid snapshot file, no stale snapshots when expected) |
| 2 | Usage error (invalid arguments, unknown command) |

---

## 15. Integration with the npm-master Ecosystem

### prompt-version

`prompt-version` manages prompt template versioning. When a prompt version is bumped, the associated snapshot tests should be re-evaluated. Integration: tag snapshots with the prompt version in metadata, so `prompt-snap clean` can identify snapshots tied to old prompt versions:

```typescript
await expect(output).toMatchPromptSnapshot({
  strategy: 'semantic',
  threshold: 0.85,
  label: `v${promptVersion}`,
});
```

### prompt-diff

`prompt-diff` computes structural and semantic diffs between prompt template versions. The diff output can inform which snapshot tests are likely affected by a prompt change. Integration: run `prompt-diff` to identify changed prompts, then selectively run and review the snapshot tests for those prompts:

```bash
# Identify changed prompts
npx prompt-diff --from v1.2.0 --to v1.3.0

# Run only affected snapshot tests
vitest run --filter "chatbot" --update
```

### llm-vcr

`llm-vcr` records and replays LLM API calls for deterministic testing. `prompt-snap` and `llm-vcr` are complementary: `llm-vcr` makes the LLM calls deterministic, `prompt-snap` validates the output shape and content. For maximum test stability, record LLM responses with `llm-vcr` and validate them with `prompt-snap`:

```typescript
import { withCassette } from 'llm-vcr';
import { expect } from 'vitest';

it('generates a greeting', async () => {
  await withCassette('greeting', async () => {
    const output = await llm.generate('Say hello');
    // llm-vcr replays the recorded response
    // prompt-snap validates it against the snapshot
    await expect(output).toMatchPromptSnapshot({ strategy: 'semantic', threshold: 0.85 });
  });
});
```

When `llm-vcr` is recording (first run), the response is saved to the cassette and `prompt-snap` creates the snapshot. On replay, the response is deterministic and the snapshot comparison is exact. When re-recording after a prompt change, the new response is captured and the snapshot can be updated.

### output-grade

`output-grade` scores LLM output quality with heuristic signals. Use `output-grade` as a custom matcher within `prompt-snap` to enforce quality thresholds on snapshots:

```typescript
import { grade } from 'output-grade';

await expect(output).toMatchPromptSnapshot({
  strategy: 'custom',
  matcher: (actual) => {
    const report = grade(actual as string);
    return {
      pass: report.score >= 0.7,
      score: report.score,
      message: report.summary,
    };
  },
});
```

### ai-output-assert

`ai-output-assert` provides test-time assertions for LLM output (format validation, content checks). `prompt-snap` provides regression detection against stored baselines. They complement each other: `ai-output-assert` validates absolute quality ("the output must be valid JSON"), `prompt-snap` validates relative stability ("the output must be similar to what it was before"):

```typescript
it('generates valid user profile', async () => {
  const output = await llm.generate(prompt);

  // ai-output-assert: validate absolute quality
  assertJSON(output, UserSchema);

  // prompt-snap: validate against baseline
  await expect(JSON.parse(output)).toMatchPromptSnapshot({
    strategy: 'keyField',
    schema: { name: 'exact', bio: { strategy: 'semantic', threshold: 0.80 } },
  });
});
```

### embed-cache

`embed-cache` provides caching for embedding API calls. When using semantic matching in large test suites, the same snapshot values are embedded on every test run. Wrapping the embedding function with `embed-cache` avoids redundant API calls:

```typescript
import { createCache } from 'embed-cache';
import { createOpenAIEmbedder } from 'prompt-snap/adapters/openai';

const rawEmbed = createOpenAIEmbedder({ model: 'text-embedding-3-small' });
const cachedEmbed = createCache(rawEmbed, { dir: '.embed-cache' });

setupPromptSnap({
  strategy: 'semantic',
  embedFn: cachedEmbed,
});
```

---

## 16. Testing Strategy

### Unit Tests

Each matching strategy has its own test suite:

**Exact matcher tests**:
- Identical strings: pass, score 1.0.
- Different strings: fail, score 0.0.
- Identical objects (deep equal): pass, score 1.0.
- Objects with different key order: pass (key order does not matter).
- Objects with different values: fail, score 0.0.
- Type mismatch (string vs. object): fail.
- Null and undefined handling.

**Semantic matcher tests** (with mock embedder):
- Identical texts: score 1.0 (embeddings are identical).
- Similar texts (above threshold): pass.
- Dissimilar texts (below threshold): fail.
- Empty text handling.
- Embedder throws: fail with error details.
- Embedder returns zero vector: fail with error details.
- Threshold boundary: score exactly at threshold passes, score below fails.

**Structural matcher tests**:
- Identical structures: pass, score 1.0.
- Same keys, different values: pass (values ignored).
- Missing key: fail, reported in `missingKeys`.
- Extra key: fail when `allowExtraKeys: false`, pass when true.
- Type mismatch (number vs. string): fail, reported in `typeMismatches`.
- Nested objects: recursive structural check.
- Arrays: same length, different length, different element types.
- `allowMissingKeys`: missing key passes.
- `checkArrayLength: false`: different-length arrays pass if element types match.

**KeyField matcher tests**:
- All fields pass: overall pass.
- One field fails: overall fail, per-field results show which failed.
- Nested field paths: dot-notation resolution.
- Wildcard array paths: each element matched.
- Optional fields: absent optional field does not fail.
- Missing required field: fail.
- Extra fields with `ignoreExtraFields: true`: ignored.
- Extra fields with `ignoreExtraFields: false`: fail.
- Mixed strategies across fields.

**Contains matcher tests**:
- All substrings present: pass, score 1.0.
- Some substrings missing: partial score.
- Case sensitivity: insensitive by default.
- `minMatchRatio: 0.8` with 4/5 substrings: pass.
- Empty substrings list: pass (vacuously true).
- Empty actual output: fail if any substrings expected.

**Regex matcher tests**:
- Matching pattern: pass.
- Non-matching pattern: fail.
- `fullMatch: true`: must match entire string.
- Invalid regex: fail with error.
- Flags: case-insensitive matching.

**Jaccard matcher tests**:
- Identical texts: score 1.0.
- Completely different texts: score 0.0.
- Partial overlap: proportional score.
- Stopword removal: stopwords do not inflate similarity.
- Case sensitivity: insensitive by default.
- Empty texts: score 0.0.
- Threshold boundary testing.

**Custom matcher tests**:
- Matcher returns pass: pass, score from result.
- Matcher returns fail: fail.
- Async matcher: awaited correctly.
- Matcher throws: fail with error.
- Score defaults: 1.0 for pass, 0.0 for fail when not specified.

### Snapshot Lifecycle Tests

- First run with no existing snapshot: snapshot created, test passes.
- Second run with matching output: snapshot compared, test passes.
- Second run with non-matching output: test fails, diff produced.
- Update mode: snapshot overwritten, test passes.
- Stale detection: snapshots not accessed during run are flagged.
- Clean: stale snapshots are removed from file.
- Concurrent tests writing to the same snapshot file: file locking or serialized writes.

### Integration Tests

- End-to-end test with Vitest: `setupPromptSnap`, write a test with `toMatchPromptSnapshot`, run it, verify snapshot file created, run again, verify comparison.
- Update workflow: create snapshot, modify expected output, run without update (fail), run with update (pass, snapshot updated), run again (pass with new snapshot).
- Multiple snapshots in one test file: each has a unique ID, all stored in one snapshot file.
- Mixed strategies in one test file: different tests use different strategies.

### Edge Cases

- Snapshot file does not exist (first run): created automatically.
- `.prompt-snap` directory does not exist: created automatically.
- Snapshot file is corrupt (invalid JSON): error with clear message.
- Snapshot ID collision: deterministic -- same test name always produces the same ID.
- Very large output (100KB+): completes without timeout.
- Unicode and emoji in outputs: handled correctly in all strategies.
- Binary-like content: fails with a descriptive error at serialization time.
- Circular references in output: detected and reported as error.

### Test Framework

Tests use Vitest, matching the project's existing `vitest run` configuration in `package.json`.

---

## 17. Performance

### Matching Strategy Performance

| Strategy | Expected Latency | Notes |
|---|---|---|
| `exact` | < 0.1ms | String comparison, O(n) in string length |
| `structural` | < 1ms | Recursive object traversal, O(k) in key count |
| `keyField` | < 1ms + strategy cost per field | Sum of per-field strategy costs |
| `contains` | < 0.5ms | Substring search, O(n * m) for n substrings in m-length text |
| `regex` | < 0.5ms | Single regex test |
| `jaccard` | < 2ms | Tokenization + set operations, O(n) in word count |
| `semantic` | 100-500ms | Dominated by embedding API round-trip latency |
| `custom` | User-defined | Depends on the matcher function |

### Snapshot File I/O

Snapshot files are read once per test file (cached in memory for the duration of the test run). Writes occur only on snapshot creation or update. File reads use `fs.readFileSync` for simplicity (test setup is synchronous in most frameworks). File writes use `fs.writeFileSync` with atomic rename to prevent corruption.

### Embedding Caching

`prompt-snap` does not implement embedding caching internally. The stored snapshot value's embedding could be cached, but this is delegated to the user's `embedFn` implementation or the `embed-cache` package. Each comparison requires at minimum one embedding call (for the actual value; the expected value's embedding could be cached externally).

### Large Test Suites

For test suites with 500+ snapshot comparisons using semantic matching, the embedding API becomes the bottleneck. Mitigations:
1. Use `embed-cache` to cache embeddings of stable snapshot values.
2. Use `jaccard` instead of `semantic` for tests where vocabulary overlap is a sufficient proxy.
3. Run semantic tests in a separate CI job with higher timeout.
4. Batch embedding calls if the embedding provider supports batch APIs (implement in the `embedFn`).

---

## 18. Dependencies

### Runtime Dependencies

None. The core matching engine (exact, structural, keyField, contains, regex, jaccard) uses only built-in JavaScript APIs. No external packages at runtime.

### Peer Dependencies (Optional)

| Package | Version | Purpose | When Required |
|---|---|---|---|
| `openai` | `^4.0.0` | OpenAI embedding adapter | When using `createOpenAIEmbedder` from `prompt-snap/adapters/openai` |

### Development Dependencies

| Package | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linter |

### Compatibility

- Node.js >= 18 (uses ES2022 features, `fs.readFileSync`/`fs.writeFileSync`, `structuredClone`).
- TypeScript >= 5.0.
- Compatible with Jest >= 29 and Vitest >= 1.0 as test framework hosts.
- No browser-specific APIs. Works in Node.js, Bun (Node.js compat), and Deno (Node.js compat).

---

## 19. File Structure

```
prompt-snap/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── src/
│   ├── index.ts                     # Public API exports
│   ├── types.ts                     # All TypeScript type definitions
│   ├── setup.ts                     # setupPromptSnap() -- test framework integration
│   ├── matcher.ts                   # toMatchPromptSnapshot() matcher implementation
│   ├── snapshot.ts                  # matchSnapshot(), updateSnapshot() -- core snapshot logic
│   ├── snapshotter.ts              # createSnapshotter() factory
│   ├── strategies/
│   │   ├── exact.ts                # Exact matching strategy
│   │   ├── semantic.ts             # Semantic (embedding) matching strategy
│   │   ├── structural.ts           # Structural matching strategy
│   │   ├── key-field.ts            # Per-field matching strategy
│   │   ├── contains.ts            # Contains matching strategy
│   │   ├── regex.ts                # Regex matching strategy
│   │   ├── jaccard.ts              # Jaccard similarity strategy
│   │   └── custom.ts              # Custom matcher strategy
│   ├── snapshot-store/
│   │   ├── store.ts                # Snapshot file read/write
│   │   ├── file-format.ts          # Snapshot file serialization/deserialization
│   │   └── stale-tracker.ts        # Stale snapshot detection
│   ├── diff/
│   │   ├── formatter.ts            # Terminal diff formatting
│   │   └── colors.ts               # ANSI color utilities
│   ├── utils/
│   │   ├── tokenizer.ts            # Word tokenization for jaccard
│   │   ├── stopwords.ts            # English stopword list
│   │   ├── cosine.ts               # Cosine similarity computation
│   │   ├── deep-equal.ts           # Deep equality for exact matching
│   │   ├── path-resolve.ts         # Dot-notation field path resolver
│   │   └── sentences.ts            # Sentence boundary detection for contains
│   ├── adapters/
│   │   └── openai.ts               # createOpenAIEmbedder adapter (optional peer dep)
│   └── cli.ts                       # CLI entry point
├── src/__tests__/
│   ├── strategies/
│   │   ├── exact.test.ts
│   │   ├── semantic.test.ts
│   │   ├── structural.test.ts
│   │   ├── key-field.test.ts
│   │   ├── contains.test.ts
│   │   ├── regex.test.ts
│   │   ├── jaccard.test.ts
│   │   └── custom.test.ts
│   ├── snapshot.test.ts             # Snapshot lifecycle tests
│   ├── matcher.test.ts              # toMatchPromptSnapshot integration tests
│   ├── snapshotter.test.ts          # createSnapshotter tests
│   ├── snapshot-store.test.ts       # File I/O and format tests
│   ├── stale-tracker.test.ts        # Stale snapshot detection tests
│   ├── diff.test.ts                 # Diff formatting tests
│   ├── path-resolve.test.ts         # Dot-notation path resolution tests
│   └── cli.test.ts                  # CLI command tests
└── dist/                            # Compiled output (gitignored)
```

The `src/index.ts` exports:

```typescript
// Core functions
export { matchSnapshot } from './snapshot';
export { updateSnapshot } from './snapshot';
export { createSnapshotter } from './snapshotter';
export { setupPromptSnap } from './setup';

// Types
export type {
  MatchResult,
  MatchDetails,
  MatchStrategyId,
  MatchStrategyConfig,
  FieldMatchSchema,
  FieldMatchRule,
  FieldMatchConfig,
  SnapshotEntry,
  SnapshotFile,
  SnapshotterConfig,
  Snapshotter,
  PromptSnapMatcherOptions,
  MatchSnapshotOptions,
  UpdateSnapshotOptions,
  EmbedFn,
  CustomMatcherFn,
  CustomMatchResult,
  ExactMatchDetails,
  SemanticMatchDetails,
  StructuralMatchDetails,
  KeyFieldMatchDetails,
  ContainsMatchDetails,
  RegexMatchDetails,
  JaccardMatchDetails,
  CustomMatchDetails,
} from './types';

// Diff formatting
export { formatDiff } from './diff/formatter';
```

Adapter imports are subpath exports:

```typescript
import { createOpenAIEmbedder } from 'prompt-snap/adapters/openai';
```

---

## 20. Implementation Roadmap

### Phase 1: Core Matching Engine (v0.1.0)

**Deliverables**: All eight matching strategies, `MatchResult` type, strategy dispatch.

**Order of implementation**:

1. **Types and interfaces** (`types.ts`): Define all public types -- `MatchResult`, `MatchDetails` (all variants), `MatchStrategyId`, `FieldMatchSchema`, `EmbedFn`, `CustomMatcherFn`, `SnapshotEntry`, `SnapshotFile`.
2. **Utility functions** (`utils/`): Deep equality, tokenizer, stopwords, cosine similarity, dot-notation path resolver, sentence splitter.
3. **Individual strategies** (in order of complexity):
   a. `exact.ts` -- simplest, foundational.
   b. `contains.ts` -- substring checks, uses sentence splitter.
   c. `regex.ts` -- regex compilation and test.
   d. `jaccard.ts` -- tokenizer + set operations.
   e. `structural.ts` -- recursive object traversal.
   f. `semantic.ts` -- embedder call + cosine similarity.
   g. `custom.ts` -- delegation to user function.
   h. `key-field.ts` -- orchestrates per-field strategy dispatch (depends on all other strategies).
4. **Strategy dispatcher**: A function that takes a strategy ID and options and returns a strategy executor.

### Phase 2: Snapshot Store (v0.1.0)

**Deliverables**: Snapshot file read/write, lifecycle management.

1. **File format** (`snapshot-store/file-format.ts`): JSON serialization/deserialization, schema validation, version checking.
2. **Store** (`snapshot-store/store.ts`): Read snapshot file, write snapshot file with atomic rename, create directory if missing.
3. **Stale tracker** (`snapshot-store/stale-tracker.ts`): Track accessed snapshot IDs, compute stale set, write access log.
4. **Core functions** (`snapshot.ts`): `matchSnapshot` (load snapshot, compare, return result) and `updateSnapshot` (write new value to snapshot file).

### Phase 3: Test Framework Integration (v0.1.0)

**Deliverables**: `toMatchPromptSnapshot` matcher, `setupPromptSnap`, framework detection.

1. **Setup** (`setup.ts`): `setupPromptSnap` that calls `expect.extend()`, stores global configuration, wires up afterAll hook for stale tracking.
2. **Matcher** (`matcher.ts`): `toMatchPromptSnapshot` implementation that resolves snapshot ID from test context, calls `matchSnapshot`, and returns Jest/Vitest-compatible matcher result.
3. **Factory** (`snapshotter.ts`): `createSnapshotter` that creates a configured instance with `.match()`, `.update()`, `.listSnapshots()`, `.cleanStale()`.

### Phase 4: Diff Output (v0.2.0)

**Deliverables**: Formatted diff output for all strategies, ANSI color support.

1. **Color utilities** (`diff/colors.ts`): ANSI code helpers, NO_COLOR detection, TTY detection.
2. **Diff formatter** (`diff/formatter.ts`): Per-strategy diff formatters, overall mismatch report composition.

### Phase 5: CLI (v0.2.0)

**Deliverables**: `prompt-snap` CLI with list, stale, clean, show commands.

1. **Argument parsing**: Built-in `util.parseArgs` (Node.js 18+).
2. **Commands**: list, stale, clean, show.
3. **Output formatting**: Human-readable console output.

### Phase 6: Adapters (v0.3.0)

**Deliverables**: Optional embedding adapters for common providers.

1. **OpenAI adapter** (`adapters/openai.ts`): `createOpenAIEmbedder` using `openai` peer dependency.
2. **Subpath export configuration** in `package.json`.

### Phase 7: Testing and Documentation (v0.3.0)

**Deliverables**: Full test suite, README, API documentation.

1. Unit tests for all strategies with the test cases described in section 16.
2. Integration tests for the full snapshot lifecycle.
3. Performance benchmarks for each strategy.
4. README with quick start, strategy guide, and API reference.
5. JSDoc comments on all public exports.

---

## 21. Example Use Cases

### Example 1: CI Regression Testing for Prompt Changes

A team maintains a chatbot that uses a system prompt to generate customer support responses. They have 50 test cases that call the chatbot and validate the responses.

**Test setup**:
```typescript
import { setupPromptSnap } from 'prompt-snap';

setupPromptSnap({
  strategy: 'semantic',
  threshold: 0.82,
  embedFn: cachedOpenAIEmbed,
});
```

**Test case**:
```typescript
it('responds to refund request', async () => {
  const response = await chatbot.respond('I want a refund for order #1234');
  await expect(response).toMatchPromptSnapshot();
});
```

**Workflow**:
1. First run: 50 snapshots created, all tests pass.
2. Engineer modifies the system prompt to be more empathetic.
3. Run tests: 47 tests pass (outputs are semantically similar). 3 tests fail because the new responses address different aspects of the query. Engineer reviews the diffs, confirms the 3 changes are intentional, and runs `vitest run --update`.
4. Pull request shows the snapshot file changes -- reviewers can see exactly how the chatbot's responses shifted.

### Example 2: Structured Output Validation

An application uses an LLM to classify customer feedback into categories.

**Test case**:
```typescript
it('classifies positive feedback', async () => {
  const output = await classify('This product is amazing, I love it!');
  const parsed = JSON.parse(output);

  await expect(parsed).toMatchPromptSnapshot({
    strategy: 'keyField',
    schema: {
      sentiment: 'exact',                                     // must be "positive"
      confidence: {
        strategy: 'custom',
        matcher: (actual, expected) => ({
          pass: typeof actual === 'number' && actual > 0.7,
          score: typeof actual === 'number' ? actual : 0,
        }),
      },
      keywords: { strategy: 'structural', checkArrayLength: false },  // array of strings, length may vary
      explanation: { strategy: 'semantic', threshold: 0.75 },         // wording can vary
    },
  });
});
```

**Behavior**: `sentiment` must be exactly `"positive"`. `confidence` must be a number above 0.7. `keywords` must be an array of strings (length and content may differ). `explanation` must be semantically similar to the stored explanation.

### Example 3: Model Migration Validation

A team is migrating from GPT-4 to Claude for their summarization feature. They have 200 test summaries stored as snapshots.

**Migration workflow**:
1. Run existing test suite against Claude: `LLM_PROVIDER=claude vitest run`.
2. Review failures: most tests pass (semantic similarity above 0.85). 15 tests fail. The diff output shows Claude's summaries are slightly shorter and use different terminology.
3. For each failure, decide: adjust the threshold (`0.80`), update the snapshot, or adjust the prompt for Claude.
4. After fixes, run with update: `PROMPT_SNAP_UPDATE=1 vitest run`.
5. The snapshot files now contain Claude's output as the new baseline.

### Example 4: Zero-API-Cost CI Testing with Jaccard

A team wants snapshot testing in CI without embedding API costs.

**Test setup**:
```typescript
setupPromptSnap({
  strategy: 'jaccard',
  threshold: 0.55,
  removeStopwords: true,
});
```

**Test case**:
```typescript
it('generates product description', async () => {
  const description = await generateDescription(product);
  await expect(description).toMatchPromptSnapshot();
});
```

**Behavior**: Jaccard similarity compares word overlap without any API calls. The threshold of 0.55 allows moderate vocabulary variation while catching completely different outputs. This runs in milliseconds with zero external dependencies, making it suitable for every CI run.

### Example 5: Chatbot Response Testing with llm-vcr

Combining `prompt-snap` with `llm-vcr` for fully deterministic tests that still validate output quality:

```typescript
import { withCassette } from 'llm-vcr';

it('handles multi-turn conversation', async () => {
  await withCassette('multi-turn', async () => {
    const turn1 = await chat.send('What is TypeScript?');
    await expect(turn1).toMatchPromptSnapshot({
      strategy: 'contains',
      substrings: ['TypeScript', 'JavaScript', 'typed'],
      label: 'turn-1',
    });

    const turn2 = await chat.send('How is it different from JavaScript?');
    await expect(turn2).toMatchPromptSnapshot({
      strategy: 'semantic',
      threshold: 0.80,
      label: 'turn-2',
    });
  });
});
```

The `llm-vcr` cassette replays the exact API responses from a previous recording. `prompt-snap` validates that the responses contain the expected information (turn 1) and are semantically similar to the baseline (turn 2). When the cassette is re-recorded (after a model update), the snapshots serve as regression guards.
