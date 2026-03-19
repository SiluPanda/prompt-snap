# prompt-snap — Task Breakdown

This file tracks all implementation tasks derived from SPEC.md. Each task is granular, actionable, and grouped by logical phase.

---

## Phase 1: Project Scaffolding and Configuration

- [ ] **Install dev dependencies** — Add `typescript`, `vitest`, and `eslint` as devDependencies in `package.json`. Verify `npm install` succeeds. | Status: not_done
- [ ] **Add bin entry for CLI** — Add `"bin": { "prompt-snap": "dist/cli.js" }` to `package.json` so the CLI is available via `npx prompt-snap`. | Status: not_done
- [ ] **Configure subpath exports for adapters** — Add `"exports"` field to `package.json` with subpath `"./adapters/openai"` pointing to `dist/adapters/openai.js` and a main entry `"."` pointing to `dist/index.js`. | Status: not_done
- [ ] **Add optional peer dependency for openai** — Add `"peerDependencies": { "openai": "^4.0.0" }` and `"peerDependenciesMeta": { "openai": { "optional": true } }` to `package.json`. | Status: not_done
- [ ] **Create directory structure** — Create all source directories: `src/strategies/`, `src/snapshot-store/`, `src/diff/`, `src/utils/`, `src/adapters/`, and `src/__tests__/strategies/`. | Status: not_done

---

## Phase 2: Type Definitions (`src/types.ts`)

- [ ] **Define MatchStrategyId type** — Union type of the eight strategy string literals: `'exact' | 'semantic' | 'structural' | 'keyField' | 'contains' | 'regex' | 'jaccard' | 'custom'`. | Status: not_done
- [ ] **Define MatchStrategyConfig type** — Union of `MatchStrategyId` or object with `strategy: MatchStrategyId` and arbitrary additional keys. | Status: not_done
- [ ] **Define EmbedFn type** — `(text: string) => Promise<number[]>` function signature for embedding providers. | Status: not_done
- [ ] **Define CustomMatcherFn type** — `(actual: unknown, expected: unknown) => CustomMatchResult | Promise<CustomMatchResult>`. | Status: not_done
- [ ] **Define CustomMatchResult interface** — Fields: `pass: boolean`, `score?: number`, `message?: string`. | Status: not_done
- [ ] **Define MatchResult interface** — Fields: `pass`, `score`, `strategy`, `details: MatchDetails`, `diff?: string`, `durationMs`. | Status: not_done
- [ ] **Define MatchDetails discriminated union** — Union of all eight strategy-specific detail interfaces: `ExactMatchDetails`, `SemanticMatchDetails`, `StructuralMatchDetails`, `KeyFieldMatchDetails`, `ContainsMatchDetails`, `RegexMatchDetails`, `JaccardMatchDetails`, `CustomMatchDetails`. | Status: not_done
- [ ] **Define ExactMatchDetails interface** — Fields: `strategy: 'exact'`, `identical: boolean`. | Status: not_done
- [ ] **Define SemanticMatchDetails interface** — Fields: `strategy: 'semantic'`, `cosineSimilarity`, `threshold`, `embeddingDimension`. | Status: not_done
- [ ] **Define StructuralMatchDetails interface** — Fields: `strategy: 'structural'`, `missingKeys`, `extraKeys`, `typeMismatches`, `arrayLengthMismatches`, `totalFields`, `matchedFields`. | Status: not_done
- [ ] **Define KeyFieldMatchDetails interface** — Fields: `strategy: 'keyField'`, `fields: Record<string, MatchResult>`, `missingFields`, `extraFields`. | Status: not_done
- [ ] **Define ContainsMatchDetails interface** — Fields: `strategy: 'contains'`, `matchedSubstrings`, `missingSubstrings`, `totalSubstrings`. | Status: not_done
- [ ] **Define RegexMatchDetails interface** — Fields: `strategy: 'regex'`, `pattern`, `flags`, `matched`. | Status: not_done
- [ ] **Define JaccardMatchDetails interface** — Fields: `strategy: 'jaccard'`, `similarity`, `threshold`, `intersectionSize`, `unionSize`, `actualTokenCount`, `expectedTokenCount`. | Status: not_done
- [ ] **Define CustomMatchDetails interface** — Fields: `strategy: 'custom'`, `message?: string`. | Status: not_done
- [ ] **Define FieldMatchSchema type** — `Record<string, FieldMatchRule>`. | Status: not_done
- [ ] **Define FieldMatchRule type** — Union of `MatchStrategyId` (string shorthand) and `FieldMatchConfig` (full object). | Status: not_done
- [ ] **Define FieldMatchConfig interface** — Fields: `strategy`, `threshold?`, `embedFn?`, `matcher?`, `arrayMode?`, `caseSensitive?`, `optional?`, plus index signature for strategy-specific options. | Status: not_done
- [ ] **Define SnapshotEntry interface** — Fields: `id`, `value: unknown`, `strategy`, `threshold?`, `schema?`, `updatedAt`. | Status: not_done
- [ ] **Define SnapshotFile interface** — `__meta` object (version, createdBy, updatedAt) plus snapshot entries keyed by ID. | Status: not_done
- [ ] **Define PromptSnapMatcherOptions interface** — All per-test options: `strategy?`, `threshold?`, `label?`, `schema?`, `embedFn?`, and all strategy-specific options. | Status: not_done
- [ ] **Define MatchSnapshotOptions interface** — Extends `PromptSnapMatcherOptions` with `snapshotDir?`, `snapshotFile?`, `update?`. | Status: not_done
- [ ] **Define UpdateSnapshotOptions interface** — Fields: `snapshotDir?`, `snapshotFile?`, `strategy?`, `threshold?`, `schema?`. | Status: not_done
- [ ] **Define SnapshotterConfig interface** — Fields: `strategy?`, `threshold?`, `embedFn?`, `snapshotDir?`, `update?`, `defaultFieldStrategy?`. | Status: not_done
- [ ] **Define Snapshotter interface** — Methods: `match()`, `update()`, `listSnapshots()`, `cleanStale()`. | Status: not_done

---

## Phase 3: Utility Functions

### 3a: Deep Equality (`src/utils/deep-equal.ts`)

- [ ] **Implement deepEqual function** — Recursive deep equality check for objects and arrays. Key ordering does not matter for objects, array element ordering matters. Handle primitives, null, undefined, nested objects, and arrays. | Status: not_done
- [ ] **Write tests for deepEqual** — Identical primitives, different primitives, identical objects, object key reordering, nested objects, arrays (same order, different order), null/undefined, type mismatches. | Status: not_done

### 3b: Cosine Similarity (`src/utils/cosine.ts`)

- [ ] **Implement cosineSimilarity function** — Compute dot product divided by product of magnitudes for two number arrays. Return NaN for zero-length or zero-magnitude vectors. | Status: not_done
- [ ] **Write tests for cosineSimilarity** — Identical vectors (score 1.0), orthogonal vectors (score 0.0), opposite vectors (score -1.0), zero vector handling (NaN), mismatched dimensions. | Status: not_done

### 3c: Tokenizer (`src/utils/tokenizer.ts`)

- [ ] **Implement tokenize function** — Split text on whitespace and punctuation, lowercase by default (configurable), filter empty tokens. Return array of tokens. | Status: not_done
- [ ] **Write tests for tokenizer** — Simple sentence, punctuation handling, case normalization, empty input, unicode text. | Status: not_done

### 3d: Stopwords (`src/utils/stopwords.ts`)

- [ ] **Define English stopword list** — Approximately 150 common English stopwords (the, a, an, is, are, etc.). Export as a Set for O(1) lookup. | Status: not_done
- [ ] **Implement removeStopwords function** — Filter token array to remove stopwords. | Status: not_done
- [ ] **Write tests for stopwords** — Known stopwords removed, content words preserved, empty input. | Status: not_done

### 3e: Dot-Notation Path Resolver (`src/utils/path-resolve.ts`)

- [ ] **Implement resolvePath function** — Given an object and a dot-notation path string (e.g., `"a.b.c"`), return the value at that path. Handle missing intermediate keys (return undefined), null values, numeric indices for arrays, and wildcard `*` for array iteration. | Status: not_done
- [ ] **Write tests for path resolver** — Top-level field, nested field, array index, wildcard array path (`items.*.name`), missing intermediate key, null at intermediate key, deeply nested path. | Status: not_done

### 3f: Sentence Splitter (`src/utils/sentences.ts`)

- [ ] **Implement splitSentences function** — Rule-based sentence boundary detection: split on `.`, `!`, `?` followed by whitespace or end-of-string. Handle common abbreviations (Mr., Dr., etc.) to avoid false splits. Return array of sentence strings. | Status: not_done
- [ ] **Write tests for sentence splitter** — Single sentence, multiple sentences, abbreviations, question marks, exclamation marks, empty input, text without sentence terminators. | Status: not_done

---

## Phase 4: Matching Strategies

### 4a: Exact Strategy (`src/strategies/exact.ts`)

- [ ] **Implement exact matching function** — Compare with `===` for strings. Use deepEqual for objects/arrays. Return `MatchResult` with score 1.0 (identical) or 0.0 (different) and `ExactMatchDetails`. | Status: not_done
- [ ] **Handle type mismatches** — If one value is a string and the other is an object, fail with score 0.0. | Status: not_done
- [ ] **Write tests for exact strategy** — Identical strings pass (1.0), different strings fail (0.0), identical objects pass, objects with different key order pass, objects with different values fail, type mismatch fails, null/undefined handling. | Status: not_done

### 4b: Contains Strategy (`src/strategies/contains.ts`)

- [ ] **Implement contains matching function** — Accept optional `substrings` array; if not provided, split snapshot value into sentences using `splitSentences`. Check each substring against actual output. Support `caseSensitive` option (default false). Compute score as `matchedCount / totalCount`. Pass if `score >= minMatchRatio`. Return `ContainsMatchDetails` with matched/missing substring lists. | Status: not_done
- [ ] **Write tests for contains strategy** — All substrings present (score 1.0), some missing (partial score), case insensitivity, `minMatchRatio: 0.8` with 4/5 found (pass), empty substrings list (vacuously true), empty actual (fail if substrings expected). | Status: not_done

### 4c: Regex Strategy (`src/strategies/regex.ts`)

- [ ] **Implement regex matching function** — Accept optional `pattern` (RegExp or string) and `flags`. If no pattern provided, use stored snapshot value as regex string. If `fullMatch`, wrap in `^...$`. Compile regex and test against actual. Return `RegexMatchDetails`. Handle invalid regex with error details. | Status: not_done
- [ ] **Write tests for regex strategy** — Matching pattern (pass), non-matching (fail), `fullMatch: true` enforcement, invalid regex (fail with error), case-insensitive flag, pattern as string vs RegExp, snapshot-derived pattern. | Status: not_done

### 4d: Jaccard Strategy (`src/strategies/jaccard.ts`)

- [ ] **Implement Jaccard matching function** — Tokenize both texts, optionally remove stopwords and apply stemming, compute word set intersection and union, return `score = |intersection| / |union|`. Pass if `score >= threshold`. Return `JaccardMatchDetails`. | Status: not_done
- [ ] **Implement optional Porter stemming** — Basic Porter stemming algorithm for English words when `stemWords: true`. | Status: not_done
- [ ] **Write tests for Jaccard strategy** — Identical texts (1.0), completely different texts (0.0), partial overlap (proportional score), stopword removal effect, case sensitivity, empty texts (0.0), threshold boundary. | Status: not_done

### 4e: Structural Strategy (`src/strategies/structural.ts`)

- [ ] **Implement structural matching function** — Recursively compare two JSON values for same shape: same keys, same types, same array lengths. Ignore actual values. Support `allowExtraKeys`, `allowMissingKeys`, `checkArrayLength` options. Compute score as `matchedFields / totalFields`. Collect structural diff details (missing keys, extra keys, type mismatches, array length mismatches with paths). | Status: not_done
- [ ] **Handle JSON parsing** — If values are strings, attempt `JSON.parse`. If parsing fails, fail with score 0.0. | Status: not_done
- [ ] **Handle arrays** — Check element types using first element as type exemplar. When `checkArrayLength: true`, verify lengths match. | Status: not_done
- [ ] **Write tests for structural strategy** — Identical structures pass (1.0), same keys different values pass, missing key fail, extra key fail/pass depending on config, type mismatch fail, nested objects, arrays (same length, different length, different element types), `allowMissingKeys`, `checkArrayLength: false`. | Status: not_done

### 4f: Semantic Strategy (`src/strategies/semantic.ts`)

- [ ] **Implement semantic matching function** — Call `embedFn` on both actual and expected texts, compute cosine similarity, compare against threshold. Return `SemanticMatchDetails`. Handle embedFn errors (catch and fail with error details) and zero-vector results (treat as failed match). | Status: not_done
- [ ] **Validate embedFn is provided** — If no embedFn is available (not in options or global config), fail with a descriptive error message. | Status: not_done
- [ ] **Write tests for semantic strategy (with mock embedder)** — Identical texts (score 1.0), similar texts above threshold (pass), dissimilar texts below threshold (fail), empty text handling, embedder throws (fail with error), embedder returns zero vector (fail), threshold boundary (score exactly at threshold passes). | Status: not_done

### 4g: Custom Strategy (`src/strategies/custom.ts`)

- [ ] **Implement custom matching function** — Call user-provided `matcher(actual, expected)`, await if promise, extract `pass`, `score` (default 1.0 if pass, 0.0 if fail), and `message`. Return `CustomMatchDetails`. Catch matcher errors and fail with error details. | Status: not_done
- [ ] **Write tests for custom strategy** — Matcher returns pass (pass, score from result), matcher returns fail (fail), async matcher (awaited correctly), matcher throws (fail with error), score defaults (1.0 for pass, 0.0 for fail when not specified). | Status: not_done

### 4h: Key-Field Strategy (`src/strategies/key-field.ts`)

- [ ] **Implement keyField matching function** — Parse both values as JSON. For each field in the schema, resolve the field path in both actual and expected using dot-notation resolver. Apply the field-specific strategy. Collect per-field `MatchResult` objects. Handle `ignoreExtraFields` option. Compute overall score as mean of per-field scores. Overall pass requires all fields to pass individually. Return `KeyFieldMatchDetails`. | Status: not_done
- [ ] **Implement strategy dispatch** — Resolve string shorthand (`'exact'`) to strategy with default config. Resolve object config (`{ strategy: 'semantic', threshold: 0.85 }`) to strategy with overridden options. | Status: not_done
- [ ] **Implement defaultStrategy for unlisted fields** — Fields in expected but not in schema use `defaultStrategy` (default: `'exact'`). | Status: not_done
- [ ] **Implement wildcard array path matching** — For paths like `items.*.name`, iterate over all array elements and apply the strategy to each element's field. | Status: not_done
- [ ] **Implement array matching modes** — Support `element-wise` (compare by index), `any-order` (best match pairing), and `length-only` (compare lengths only) modes per field. | Status: not_done
- [ ] **Handle optional fields** — Fields marked `optional: true` do not fail when absent from actual output. Absent optional fields are excluded from score calculation. | Status: not_done
- [ ] **Write tests for keyField strategy** — All fields pass (overall pass), one field fails (overall fail, per-field results), nested field paths (dot-notation), wildcard array paths, optional field absent (pass), missing required field (fail), extra fields with `ignoreExtraFields: true` (ignored) vs false (fail), mixed strategies across fields, defaultStrategy fallback. | Status: not_done

### 4i: Strategy Dispatcher

- [ ] **Implement strategy dispatcher function** — Given a `MatchStrategyId` and options, invoke the correct strategy function and return `MatchResult`. Used by `matchSnapshot`, keyField strategy, and the matcher. Include timing measurement (`durationMs`). | Status: not_done
- [ ] **Write tests for strategy dispatcher** — Dispatch to each of the eight strategies, verify correct strategy function is called, verify unknown strategy ID throws descriptive error. | Status: not_done

---

## Phase 5: Snapshot Store

### 5a: File Format (`src/snapshot-store/file-format.ts`)

- [ ] **Implement serializeSnapshotFile function** — Convert a `SnapshotFile` object to a formatted JSON string (2-space indent) for human-readable storage. | Status: not_done
- [ ] **Implement deserializeSnapshotFile function** — Parse JSON string to `SnapshotFile` object. Validate `__meta.version`. Handle invalid JSON with descriptive error messages. | Status: not_done
- [ ] **Write tests for file format** — Round-trip serialization/deserialization, invalid JSON error, missing `__meta`, version mismatch handling. | Status: not_done

### 5b: Store (`src/snapshot-store/store.ts`)

- [ ] **Implement readSnapshotFile function** — Read a snapshot JSON file from disk. Return parsed `SnapshotFile`. If file does not exist, return null (indicating first run). Use `fs.readFileSync`. | Status: not_done
- [ ] **Implement writeSnapshotFile function** — Write `SnapshotFile` to disk as formatted JSON. Use atomic write (write to temp file, then rename) to prevent corruption. Create `.prompt-snap` directory if it does not exist using `fs.mkdirSync({ recursive: true })`. | Status: not_done
- [ ] **Implement getSnapshotEntry function** — Look up a snapshot by ID from a `SnapshotFile`. Return `SnapshotEntry` or null. | Status: not_done
- [ ] **Implement setSnapshotEntry function** — Add or update a snapshot entry in a `SnapshotFile`. Set `updatedAt` to current timestamp. Update `__meta.updatedAt`. | Status: not_done
- [ ] **Implement resolveSnapshotPath function** — Given test file path and optional `snapshotDir`, compute the snapshot file path. Default: `<testFileDir>/.prompt-snap/<testFileName>.snap.json`. | Status: not_done
- [ ] **Write tests for store** — Read existing file, read non-existent file (returns null), write and read back, atomic write integrity, directory creation, getSnapshotEntry found/not-found, setSnapshotEntry add new/update existing. | Status: not_done

### 5c: Stale Tracker (`src/snapshot-store/stale-tracker.ts`)

- [ ] **Implement stale tracker** — Track which snapshot IDs are accessed during a test run. Provide `recordAccess(snapshotId)` method. After the run, compute stale IDs as those in the snapshot file but not in the accessed set. Write `.prompt-snap-accessed.json` file for CLI consumption. | Status: not_done
- [ ] **Implement getStaleSnapshots function** — Given a snapshot file and a set of accessed IDs, return the list of stale snapshot IDs. | Status: not_done
- [ ] **Implement removeStaleSnapshots function** — Remove stale entries from a snapshot file and write the updated file. Return count of removed entries. | Status: not_done
- [ ] **Write tests for stale tracker** — All accessed (none stale), some not accessed (those are stale), snapshot file with no accesses (all stale), clean removes correct entries, access log file written correctly. | Status: not_done

---

## Phase 6: Core Snapshot Logic (`src/snapshot.ts`)

- [ ] **Implement matchSnapshot function** — Load snapshot from file (via store). If no snapshot exists, create it (first run: store actual value, return pass with score 1.0, log creation message). If snapshot exists and update mode is active, overwrite with actual value and return pass. If snapshot exists and not in update mode, compare actual against stored using configured strategy via dispatcher. Return `MatchResult`. Record snapshot access for stale tracking. | Status: not_done
- [ ] **Implement updateSnapshot function** — Programmatically update a specific snapshot by ID. Write new value, strategy, and threshold to snapshot file. Set `updatedAt`. | Status: not_done
- [ ] **Implement update mode detection** — Check `PROMPT_SNAP_UPDATE` env var, `process.argv` for `--updateSnapshot` / `-u` (Jest) and `--update` (Vitest), and programmatic `update: true` config. Precedence: env var > argv > config > default (off). | Status: not_done
- [ ] **Implement selective update filtering** — Support `PROMPT_SNAP_UPDATE_FILTER` env var: comma-separated substrings, only update snapshots whose IDs contain one of the substrings. | Status: not_done
- [ ] **Handle snapshot value serialization** — Strings stored as-is. Objects stored as JSON objects. Detect and reject non-serializable values (functions, circular references, binary data) with descriptive errors. | Status: not_done
- [ ] **Write tests for matchSnapshot** — First run creates snapshot and passes, second run with matching output passes, second run with non-matching output fails with diff, update mode overwrites and passes, selective update filtering, non-serializable value error. | Status: not_done

---

## Phase 7: Test Framework Integration

### 7a: Setup (`src/setup.ts`)

- [ ] **Implement setupPromptSnap function** — Accept global config (strategy, threshold, embedFn, snapshotDir, update, defaultFieldStrategy). Call `expect.extend()` to register `toMatchPromptSnapshot`. Store global config in a module-level variable accessible by the matcher. Wire up `afterAll` hook for stale snapshot tracking (write access log). | Status: not_done
- [ ] **Implement configuration precedence** — Per-test options override instance-level (createSnapshotter) options, which override global (setupPromptSnap) options, which override built-in defaults. | Status: not_done
- [ ] **Write tests for setupPromptSnap** — Config is stored and accessible, `expect.extend` is called, afterAll hook is registered. | Status: not_done

### 7b: Matcher (`src/matcher.ts`)

- [ ] **Implement toMatchPromptSnapshot matcher** — Resolve snapshot ID from test context (test name + optional label). Resolve snapshot file path from test file path. Merge per-test options with global config. Call `matchSnapshot`. Return Jest/Vitest-compatible matcher result (`{ pass, message }`) with formatted diff on failure. | Status: not_done
- [ ] **Implement snapshot ID generation** — Derive from full test name (e.g., `"describe > test name"`). If `label` is provided, compose as `"<test name> > <label>"`. Sanitize for JSON key safety. | Status: not_done
- [ ] **Write tests for matcher** — Snapshot creation on first run, comparison on subsequent run, update mode, label-based ID generation, diff output on failure. | Status: not_done

### 7c: Factory (`src/snapshotter.ts`)

- [ ] **Implement createSnapshotter function** — Accept `SnapshotterConfig`. Return `Snapshotter` object with `match()`, `update()`, `listSnapshots()`, `cleanStale()` methods. Each method merges call-level options with instance-level config. | Status: not_done
- [ ] **Implement Snapshotter.match method** — Delegate to `matchSnapshot` with instance config merged. | Status: not_done
- [ ] **Implement Snapshotter.update method** — Delegate to `updateSnapshot` with instance config. | Status: not_done
- [ ] **Implement Snapshotter.listSnapshots method** — Read snapshot file, return array of `SnapshotEntry` objects. | Status: not_done
- [ ] **Implement Snapshotter.cleanStale method** — Given a set of accessed IDs, remove stale snapshots from file, return count removed. | Status: not_done
- [ ] **Write tests for createSnapshotter** — Instance creation with config, match delegates correctly, update delegates correctly, listSnapshots returns entries, cleanStale removes stale entries. | Status: not_done

---

## Phase 8: Diff Output

### 8a: Color Utilities (`src/diff/colors.ts`)

- [ ] **Implement ANSI color helpers** — Functions for `red()`, `green()`, `yellow()`, `cyan()`, `bold()` that wrap text in ANSI escape codes. | Status: not_done
- [ ] **Implement color detection** — Disable colors when `NO_COLOR` env var is set, stdout is not a TTY, or `--no-color` is in `process.argv`. | Status: not_done
- [ ] **Write tests for color utilities** — Color wrapping, NO_COLOR detection, non-TTY detection. | Status: not_done

### 8b: Diff Formatter (`src/diff/formatter.ts`)

- [ ] **Implement formatDiff function** — Accept `MatchResult` and options (including `color: boolean`). Dispatch to strategy-specific formatter. Return formatted string. | Status: not_done
- [ ] **Implement exact match diff formatter** — Show expected vs actual with character-level diff highlighting. Include score and threshold. | Status: not_done
- [ ] **Implement semantic match diff formatter** — Show similarity score with visual gauge bar, expected/actual texts, score vs threshold, fail margin. | Status: not_done
- [ ] **Implement structural match diff formatter** — List missing keys, extra keys, type mismatches with paths. Show score as matched/total fields. | Status: not_done
- [ ] **Implement keyField match diff formatter** — Table of fields with strategy, score, and pass/fail result. Expand failing fields with detail. Show overall score. | Status: not_done
- [ ] **Implement contains match diff formatter** — List matched and missing substrings. Show score and minMatchRatio. | Status: not_done
- [ ] **Implement regex match diff formatter** — Show pattern, flags, and match result. | Status: not_done
- [ ] **Implement jaccard match diff formatter** — Show similarity score, threshold, intersection/union sizes, token counts. | Status: not_done
- [ ] **Implement custom match diff formatter** — Show user message, pass/fail, score. | Status: not_done
- [ ] **Write tests for diff formatters** — Each strategy produces correct output format, color vs no-color mode, all required information present in output. | Status: not_done

---

## Phase 9: CLI (`src/cli.ts`)

- [ ] **Implement CLI entry point** — Parse arguments using `util.parseArgs` (Node.js 18+). Dispatch to command handlers. Handle unknown commands with usage error (exit code 2). Add shebang line `#!/usr/bin/env node`. | Status: not_done
- [ ] **Implement `list` command** — Accept optional `[dir]` argument (default `.prompt-snap`). Find all `.snap.json` files. For each file, list snapshot entries with ID, strategy, threshold, and updated date. Show total count. Exit code 0 on success, 1 on error. | Status: not_done
- [ ] **Implement `stale` command** — Accept optional `[dir]` argument. Read `.prompt-snap-accessed.json` for access log. Compare against snapshot files. List stale snapshots. Exit code 0 if stale found, 1 if no access log or error. | Status: not_done
- [ ] **Implement `clean` command** — Accept optional `[dir]` argument. Remove stale snapshots from snapshot files. Report removed entries. Exit code 0 on success, 1 on error. | Status: not_done
- [ ] **Implement `show` command** — Accept `<snapshot-id>` and optional `[file]` arguments. Display strategy, threshold, updated date, and stored value. Exit code 0 on success, 1 if not found. | Status: not_done
- [ ] **Write tests for CLI** — Each command with valid args, missing args, file not found, invalid snapshot file, exit codes. | Status: not_done

---

## Phase 10: Adapters

- [ ] **Implement OpenAI embedding adapter** — `createOpenAIEmbedder(options)` in `src/adapters/openai.ts`. Accept `model` (default `text-embedding-3-small`), `apiKey` (default from `OPENAI_API_KEY` env var). Return `EmbedFn` that calls OpenAI embedding API. Use dynamic `import('openai')` to avoid hard dependency. Throw descriptive error if `openai` package is not installed. | Status: not_done
- [ ] **Write tests for OpenAI adapter** — Mock `openai` module: successful embedding call returns vector, missing API key throws, missing `openai` package throws descriptive error, embedding dimensions consistent. | Status: not_done

---

## Phase 11: Public API Exports (`src/index.ts`)

- [ ] **Export core functions** — `matchSnapshot`, `updateSnapshot`, `createSnapshotter`, `setupPromptSnap` from their respective modules. | Status: not_done
- [ ] **Export all public types** — All interfaces and type aliases from `types.ts`: `MatchResult`, `MatchDetails`, `MatchStrategyId`, `MatchStrategyConfig`, `FieldMatchSchema`, `FieldMatchRule`, `FieldMatchConfig`, `SnapshotEntry`, `SnapshotFile`, `SnapshotterConfig`, `Snapshotter`, `PromptSnapMatcherOptions`, `MatchSnapshotOptions`, `UpdateSnapshotOptions`, `EmbedFn`, `CustomMatcherFn`, `CustomMatchResult`, and all `*MatchDetails` interfaces. | Status: not_done
- [ ] **Export formatDiff** — `formatDiff` from `diff/formatter.ts`. | Status: not_done

---

## Phase 12: Snapshot Lifecycle Integration Tests

- [ ] **Test first-run snapshot creation** — No snapshot file exists. Call `matchSnapshot`. Verify snapshot file is created with correct structure, value, strategy, threshold, and metadata. Verify test passes with score 1.0. | Status: not_done
- [ ] **Test comparison run with matching output** — Snapshot exists. Call `matchSnapshot` with a similar value. Verify pass based on strategy and threshold. | Status: not_done
- [ ] **Test comparison run with non-matching output** — Snapshot exists. Call `matchSnapshot` with a different value. Verify fail, verify diff is produced, verify score is reported. | Status: not_done
- [ ] **Test update mode** — Snapshot exists. Activate update mode. Call `matchSnapshot` with new value. Verify snapshot is overwritten, updatedAt is updated, test passes. | Status: not_done
- [ ] **Test stale snapshot detection** — Create snapshot file with 3 entries. Access only 2 during a test run. Verify the third is detected as stale. | Status: not_done
- [ ] **Test stale snapshot cleanup** — Stale snapshots exist. Call clean. Verify stale entries removed, non-stale entries preserved. | Status: not_done
- [ ] **Test multiple snapshots in one test file** — Create multiple snapshots with different IDs in same file. Verify all stored, all independently comparable. | Status: not_done
- [ ] **Test mixed strategies in one test file** — Different tests use different strategies (exact, semantic, jaccard). Verify each comparison uses the correct strategy. | Status: not_done
- [ ] **Test concurrent writes to same snapshot file** — Two tests write to the same file. Verify no corruption (atomic writes). | Status: not_done

---

## Phase 13: Integration Tests with Test Frameworks

- [ ] **Test end-to-end Vitest integration** — Use `setupPromptSnap` in a Vitest setup file. Write a test using `toMatchPromptSnapshot`. Run it (first run creates snapshot). Run again (second run compares). Verify snapshot file created and comparison works. | Status: not_done
- [ ] **Test update workflow end-to-end** — Create snapshot, modify expected output, run without update (should fail), run with `PROMPT_SNAP_UPDATE=1` (should pass and update), run again without update (should pass with new snapshot). | Status: not_done
- [ ] **Test framework detection for Jest** — Verify `--updateSnapshot` and `-u` flags in `process.argv` activate update mode. | Status: not_done
- [ ] **Test framework detection for Vitest** — Verify `--update` flag in `process.argv` activates update mode. | Status: not_done
- [ ] **Test PROMPT_SNAP_UPDATE env var** — Verify `PROMPT_SNAP_UPDATE=1` activates update mode regardless of framework. | Status: not_done

---

## Phase 14: Edge Case Tests

- [ ] **Test snapshot file does not exist (first run)** — Verify file and directory created automatically, no errors. | Status: not_done
- [ ] **Test `.prompt-snap` directory does not exist** — Verify directory created automatically with `recursive: true`. | Status: not_done
- [ ] **Test corrupt snapshot file (invalid JSON)** — Verify descriptive error message, no crash. | Status: not_done
- [ ] **Test snapshot ID collision** — Same test name always produces same ID. Verify deterministic behavior. | Status: not_done
- [ ] **Test very large output (100KB+)** — Verify matching completes without timeout for each strategy. | Status: not_done
- [ ] **Test unicode and emoji in outputs** — Verify all strategies handle unicode correctly: exact comparison, tokenization, substring matching, regex. | Status: not_done
- [ ] **Test non-serializable values** — Functions, circular references: verify descriptive error at snapshot creation, no crash. | Status: not_done
- [ ] **Test null and undefined values** — Verify behavior of each strategy with null/undefined inputs. | Status: not_done
- [ ] **Test empty string inputs** — Verify each strategy handles empty strings correctly (exact: match empty with empty, jaccard: score 0.0, contains: pass if no substrings, etc.). | Status: not_done

---

## Phase 15: Configuration and Defaults

- [ ] **Test default strategy is 'exact'** — When no strategy specified, exact matching is used. | Status: not_done
- [ ] **Test default thresholds per strategy** — exact: 1.0, semantic: 0.85, jaccard: 0.6, contains: 1.0, structural: 1.0. | Status: not_done
- [ ] **Test per-test overrides** — Per-test options override global config. | Status: not_done
- [ ] **Test createSnapshotter instance overrides** — Instance config overrides global, per-call overrides instance. | Status: not_done
- [ ] **Test all default option values** — `caseSensitive: false`, `removeStopwords: true`, `stemWords: false`, `allowExtraKeys: false`, `allowMissingKeys: false`, `checkArrayLength: true`, `ignoreExtraFields: false`. | Status: not_done

---

## Phase 16: Documentation

- [ ] **Write README.md** — Quick start, installation, basic usage examples, strategy guide with when-to-use recommendations, API reference for all public functions and types, configuration reference with defaults, CLI usage, integration with Jest/Vitest, ecosystem integration notes. | Status: not_done
- [ ] **Add JSDoc comments to all public exports** — `matchSnapshot`, `updateSnapshot`, `createSnapshotter`, `setupPromptSnap`, `formatDiff`, and all exported types/interfaces. | Status: not_done

---

## Phase 17: Build and Publish Preparation

- [ ] **Verify TypeScript build** — Run `npm run build` (`tsc`). Verify no compiler errors. Verify `dist/` output contains `.js`, `.d.ts`, and `.d.ts.map` files for all source files. | Status: not_done
- [ ] **Verify all tests pass** — Run `npm run test` (`vitest run`). All unit, integration, and edge case tests pass. | Status: not_done
- [ ] **Verify lint passes** — Run `npm run lint` (`eslint src/`). No lint errors. | Status: not_done
- [ ] **Bump version in package.json** — Bump version per semver (from 0.1.0 to appropriate version for the implemented feature set). | Status: not_done
- [ ] **Verify package contents** — Run `npm pack --dry-run`. Verify only `dist/` is included (per `"files": ["dist"]`). Verify CLI binary is included. | Status: not_done
