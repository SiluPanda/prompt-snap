import { join } from 'path'
import type {
  MatchResult,
  MatchSnapshotOptions,
  Snapshotter,
  SnapshotterConfig,
  SnapshotEntry,
} from './types.js'
import { match } from './matchers/dispatch.js'
import { SnapshotStore } from './snapshot-store.js'

function resolveSnapshotPath(options?: MatchSnapshotOptions): string {
  const dir = options?.snapshotDir ?? join(process.cwd(), '.prompt-snap')
  const file = options?.snapshotFile ?? 'snapshots.json'
  return join(dir, file)
}

export async function matchSnapshot(
  actual: unknown,
  snapshotId: string,
  options?: MatchSnapshotOptions
): Promise<MatchResult> {
  const filePath = resolveSnapshotPath(options)
  const store = new SnapshotStore(filePath)
  const existing = store.get(snapshotId)

  // No snapshot yet, or update=true → write baseline and return pass
  if (!existing || options?.update === true) {
    const entry: SnapshotEntry = {
      id: snapshotId,
      value: actual,
      strategy: options?.strategy ?? 'exact',
      threshold: options?.threshold,
      schema: options?.schema,
      updatedAt: new Date().toISOString(),
    }
    store.set(snapshotId, entry)
    store.save()
    return {
      pass: true,
      score: 1.0,
      strategy: entry.strategy,
      durationMs: 0,
      details: { created: !existing, updated: !!existing },
    }
  }

  // Match against stored baseline
  const strategy = options?.strategy ?? existing.strategy
  const result = await match(actual, existing.value, strategy, {
    threshold: options?.threshold ?? existing.threshold,
    schema: options?.schema ?? existing.schema,
  })

  return result
}

export async function updateSnapshot(
  snapshotId: string,
  value: unknown,
  options?: Omit<MatchSnapshotOptions, 'update'>
): Promise<void> {
  await matchSnapshot(value, snapshotId, { ...options, update: true })
}

export function createSnapshotter(config?: SnapshotterConfig): Snapshotter {
  const snapshotDir = config?.snapshotDir
  const snapshotFile = config?.snapshotFile
  const defaultStrategy = config?.strategy
  const defaultThreshold = config?.threshold
  const defaultUpdate = config?.update

  // Keep a single store instance per snapshotter so listSnapshots is accurate
  const filePath = resolveSnapshotPath({ snapshotDir, snapshotFile })
  const store = new SnapshotStore(filePath)

  return {
    async match(
      actual: unknown,
      snapshotId: string,
      options?: MatchSnapshotOptions
    ): Promise<MatchResult> {
      const mergedOptions: MatchSnapshotOptions = {
        strategy: options?.strategy ?? defaultStrategy,
        threshold: options?.threshold ?? defaultThreshold,
        schema: options?.schema,
        snapshotDir,
        snapshotFile,
        update: options?.update ?? defaultUpdate,
      }
      const existing = store.get(snapshotId)

      if (!existing || mergedOptions.update === true) {
        const entry: SnapshotEntry = {
          id: snapshotId,
          value: actual,
          strategy: mergedOptions.strategy ?? 'exact',
          threshold: mergedOptions.threshold,
          schema: mergedOptions.schema,
          updatedAt: new Date().toISOString(),
        }
        store.set(snapshotId, entry)
        store.save()
        return {
          pass: true,
          score: 1.0,
          strategy: entry.strategy,
          durationMs: 0,
          details: { created: !existing, updated: !!existing },
        }
      }

      const strategy = mergedOptions.strategy ?? existing.strategy
      return match(actual, existing.value, strategy, {
        threshold: mergedOptions.threshold ?? existing.threshold,
        schema: mergedOptions.schema ?? existing.schema,
      })
    },

    async update(
      snapshotId: string,
      value: unknown,
      options?: Omit<MatchSnapshotOptions, 'update'>
    ): Promise<void> {
      const entry: SnapshotEntry = {
        id: snapshotId,
        value,
        strategy: options?.strategy ?? defaultStrategy ?? 'exact',
        threshold: options?.threshold ?? defaultThreshold,
        schema: options?.schema,
        updatedAt: new Date().toISOString(),
      }
      store.set(snapshotId, entry)
      store.save()
    },

    listSnapshots(): string[] {
      return store.keys()
    },
  }
}
