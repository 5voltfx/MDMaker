import { app, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, rename, stat, chmod, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { DocumentFile } from '../shared/types'

const FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
  { name: 'Text', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] }
]

export async function readDocument(path: string): Promise<DocumentFile> {
  const content = await readFile(path, 'utf8')
  app.addRecentDocument(path)
  return { path, content }
}

/**
 * Write via a sibling temp file + rename so a crash mid-write can never truncate
 * the user's document. Preserves the original file's mode when replacing.
 */
export async function writeDocument(path: string, content: string): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.mdmaker-${process.pid}.tmp`)
  let mode: number | undefined
  try {
    mode = (await stat(path)).mode
  } catch {
    // New file - default mode is fine.
  }
  try {
    await writeFile(tmp, content, 'utf8')
    if (mode !== undefined) await chmod(tmp, mode)
    await rename(tmp, path)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
  app.addRecentDocument(path)
}

export async function showOpenDialog(win: BrowserWindow | null): Promise<string | null> {
  const options = { properties: ['openFile' as const], filters: FILTERS }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function showSaveDialog(
  win: BrowserWindow | null,
  currentPath: string | null
): Promise<string | null> {
  const options = {
    title: 'Save Markdown',
    defaultPath: currentPath ?? join(app.getPath('documents'), 'Untitled.md'),
    filters: FILTERS
  }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

export async function showUnsavedDialog(
  win: BrowserWindow,
  name: string
): Promise<'save' | 'discard' | 'cancel'> {
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: `Do you want to save the changes you made to "${name}"?`,
    detail: "Your changes will be lost if you don't save them."
  })
  return response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel'
}

export function showError(win: BrowserWindow | null, message: string, detail: string): void {
  const options = { type: 'error' as const, message, detail, buttons: ['OK'] }
  if (win) dialog.showMessageBox(win, options)
  else dialog.showMessageBox(options)
}
