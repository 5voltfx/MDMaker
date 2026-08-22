import { app, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  lastFile?: string | null
}

const DEFAULTS: WindowState = { width: 1000, height: 760 }

function file(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(readFileSync(file(), 'utf8')) } as WindowState
    // Drop stale coordinates if the display arrangement changed.
    if (saved.x !== undefined && saved.y !== undefined) {
      const visible = screen.getAllDisplays().some((d) => {
        const b = d.workArea
        return (
          saved.x! >= b.x - 40 &&
          saved.y! >= b.y - 40 &&
          saved.x! < b.x + b.width &&
          saved.y! < b.y + b.height
        )
      })
      if (!visible) {
        delete saved.x
        delete saved.y
      }
    }
    return saved
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(file(), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // Persisting window position is best-effort.
  }
}
