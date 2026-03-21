export type MatchStrategyId = 'exact' | 'jaccard' | 'structural' | 'contains' | 'regex' | 'keyField' | 'custom'

export type EmbedFn = (text: string) => Promise<number[]>
export type CustomMatcherFn = (
  actual: unknown,
  expected: unknown
) =>
  | { pass: boolean; score?: number; message?: string }
  | Promise<{ pass: boolean; score?: number; message?: string }>

export interface MatchResult {
  pass: boolean
  score: number
  strategy: MatchStrategyId
  durationMs: number
  details: Record<string, unknown>
  diff?: string
}

export interface FieldMatchConfig {
  strategy: MatchStrategyId
  threshold?: number
  matcher?: CustomMatcherFn
  caseSensitive?: boolean
  optional?: boolean
}

export type FieldMatchSchema = Record<string, MatchStrategyId | FieldMatchConfig>

export interface SnapshotEntry {
  id: string
  value: unknown
  strategy: MatchStrategyId
  threshold?: number
  schema?: FieldMatchSchema
  updatedAt: string
}

export interface SnapshotFile {
  __meta: { version: string; createdBy: string; updatedAt: string }
  [snapshotId: string]: SnapshotEntry | any
}

export interface MatchSnapshotOptions {
  strategy?: MatchStrategyId
  threshold?: number
  schema?: FieldMatchSchema
  embedFn?: EmbedFn
  snapshotDir?: string
  snapshotFile?: string
  update?: boolean
}

export interface Snapshotter {
  match(actual: unknown, snapshotId: string, options?: MatchSnapshotOptions): Promise<MatchResult>
  update(snapshotId: string, value: unknown, options?: Omit<MatchSnapshotOptions, 'update'>): Promise<void>
  listSnapshots(): string[]
}

export interface SnapshotterConfig {
  strategy?: MatchStrategyId
  threshold?: number
  snapshotDir?: string
  snapshotFile?: string
  update?: boolean
}
