import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { SnapshotEntry, SnapshotFile } from './types.js'

export class SnapshotStore {
  private data: SnapshotFile = {
    __meta: {
      version: '1',
      createdBy: 'prompt-snap',
      updatedAt: new Date().toISOString(),
    },
  }
  private dirty = false

  constructor(private filePath: string) {
    if (existsSync(filePath)) {
      try {
        this.data = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        // If file is corrupt, start fresh
      }
    }
  }

  get(id: string): SnapshotEntry | null {
    const entry = this.data[id]
    return entry && typeof entry === 'object' && 'value' in entry
      ? (entry as SnapshotEntry)
      : null
  }

  set(id: string, entry: SnapshotEntry): void {
    this.data[id] = entry
    this.dirty = true
    this.data.__meta.updatedAt = new Date().toISOString()
  }

  save(): void {
    if (!this.dirty) return
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
    this.dirty = false
  }

  keys(): string[] {
    return Object.keys(this.data).filter(k => k !== '__meta')
  }
}
