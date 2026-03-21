import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { matchSnapshot, updateSnapshot, createSnapshotter } from '../snap.js'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'prompt-snap-test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function opts(extra?: object) {
  return { snapshotDir: tempDir, snapshotFile: 'test-snaps.json', ...extra }
}

describe('matchSnapshot', () => {
  it('first run: creates snapshot and returns pass=true', async () => {
    const result = await matchSnapshot('hello world', 'snap-1', opts())
    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    const details = result.details as any
    expect(details.created).toBe(true)
  })

  it('second run: same value returns pass=true', async () => {
    await matchSnapshot('hello world', 'snap-2', opts())
    const result = await matchSnapshot('hello world', 'snap-2', opts())
    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
  })

  it('second run: different value returns pass=false (exact strategy)', async () => {
    await matchSnapshot('hello world', 'snap-3', opts())
    const result = await matchSnapshot('goodbye world', 'snap-3', opts())
    expect(result.pass).toBe(false)
    expect(result.score).toBe(0.0)
  })

  it('second run: different value with jaccard strategy may pass if similarity is high', async () => {
    await matchSnapshot(
      'The quick brown fox jumps over the lazy dog',
      'snap-jaccard',
      opts({ strategy: 'jaccard', threshold: 0.7 })
    )
    // Slightly different text that shares most tokens
    const result = await matchSnapshot(
      'The quick brown fox leaps over the lazy dog',
      'snap-jaccard',
      opts({ strategy: 'jaccard', threshold: 0.7 })
    )
    expect(result.pass).toBe(true)
  })

  it('update=true: overwrites existing snapshot and returns pass=true', async () => {
    await matchSnapshot('original value', 'snap-4', opts())
    const updateResult = await matchSnapshot('new value', 'snap-4', opts({ update: true }))
    expect(updateResult.pass).toBe(true)
    const details = updateResult.details as any
    expect(details.updated).toBe(true)

    // Now matching 'new value' should pass, 'original value' should fail
    const matchNew = await matchSnapshot('new value', 'snap-4', opts())
    expect(matchNew.pass).toBe(true)
    const matchOld = await matchSnapshot('original value', 'snap-4', opts())
    expect(matchOld.pass).toBe(false)
  })

  it('persists snapshots across separate store instances', async () => {
    await matchSnapshot({ key: 'value' }, 'snap-obj', opts())
    // New call with same path should load the stored snapshot
    const result = await matchSnapshot({ key: 'value' }, 'snap-obj', opts())
    expect(result.pass).toBe(true)
    const mismatch = await matchSnapshot({ key: 'other' }, 'snap-obj', opts())
    expect(mismatch.pass).toBe(false)
  })
})

describe('updateSnapshot', () => {
  it('force-updates the baseline', async () => {
    await matchSnapshot('initial', 'snap-upd', opts())
    await updateSnapshot('snap-upd', 'updated', opts())
    const result = await matchSnapshot('updated', 'snap-upd', opts())
    expect(result.pass).toBe(true)
    const oldResult = await matchSnapshot('initial', 'snap-upd', opts())
    expect(oldResult.pass).toBe(false)
  })
})

describe('createSnapshotter', () => {
  it('returns a Snapshotter with match/update/listSnapshots', () => {
    const snapper = createSnapshotter({ snapshotDir: tempDir, snapshotFile: 'snapper.json' })
    expect(typeof snapper.match).toBe('function')
    expect(typeof snapper.update).toBe('function')
    expect(typeof snapper.listSnapshots).toBe('function')
  })

  it('first match creates snapshot and returns pass=true', async () => {
    const snapper = createSnapshotter({ snapshotDir: tempDir, snapshotFile: 'snapper.json' })
    const r = await snapper.match('value-a', 'id-1')
    expect(r.pass).toBe(true)
  })

  it('second match with same value returns pass=true', async () => {
    const snapper = createSnapshotter({ snapshotDir: tempDir, snapshotFile: 'snapper.json' })
    await snapper.match('value-b', 'id-2')
    const r = await snapper.match('value-b', 'id-2')
    expect(r.pass).toBe(true)
  })

  it('second match with different value returns pass=false', async () => {
    const snapper = createSnapshotter({ snapshotDir: tempDir, snapshotFile: 'snapper.json' })
    await snapper.match('value-c', 'id-3')
    const r = await snapper.match('different-value', 'id-3')
    expect(r.pass).toBe(false)
  })

  it('listSnapshots returns correct IDs', async () => {
    const snapper = createSnapshotter({ snapshotDir: tempDir, snapshotFile: 'snapper.json' })
    await snapper.match('a', 'alpha')
    await snapper.match('b', 'beta')
    await snapper.match('c', 'gamma')
    const ids = snapper.listSnapshots()
    expect(ids).toContain('alpha')
    expect(ids).toContain('beta')
    expect(ids).toContain('gamma')
    expect(ids.length).toBe(3)
  })

  it('update() forces new baseline', async () => {
    const snapper = createSnapshotter({ snapshotDir: tempDir, snapshotFile: 'snapper.json' })
    await snapper.match('original', 'id-upd')
    await snapper.update('id-upd', 'new-baseline')
    const r = await snapper.match('new-baseline', 'id-upd')
    expect(r.pass).toBe(true)
    const r2 = await snapper.match('original', 'id-upd')
    expect(r2.pass).toBe(false)
  })
})
