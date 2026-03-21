// prompt-snap - Jest-like snapshot testing for LLM outputs with fuzzy matching
export { matchSnapshot, updateSnapshot, createSnapshotter } from './snap.js'
export { match } from './matchers/dispatch.js'
export type {
  MatchStrategyId,
  EmbedFn,
  CustomMatcherFn,
  MatchResult,
  FieldMatchConfig,
  FieldMatchSchema,
  SnapshotEntry,
  SnapshotFile,
  MatchSnapshotOptions,
  Snapshotter,
  SnapshotterConfig,
} from './types.js'
