import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron'
import { basename, join } from 'node:path'
import { buildMenu } from './menu'
import {
  readDocument,
  writeDocument,
  showOpenDialog,
  showSaveDialog,
  showUnsavedDialog,
  showError
} from './file-ops'
import { loadWindowState, saveWindowState } from './window-state'
import type { DocState, DocumentFile } from '../shared/types'

const isDev = !app.isPackaged

/** Per-window document state, mirrored from the renderer. */
const docStates = new Map<number, DocState>()
/** Document a window should load once its renderer is ready. */
const pendingDocs = new Map<number, DocumentFile>()
/** Windows that have already cleared the unsaved-changes guard. */
const closingAnyway = new Set<number>()

let isQuitting = false
/** Files handed to us by macOS before the app finished starting. */
const queuedFiles: string[] = []

function titleFor(state: DocState | undefined): string {
  const name = state?.path ? basename(state.path) : 'Untitled'
  return name
}

function applyDocState(win: BrowserWindow, state: DocState): void {
  docStates.set(win.id, state)
  win.setTitle(titleFor(state))
  win.setRepresentedFilename(state.path ?? '')
  win.setDocumentEdited(state.dirty)
}

function createWindow(doc?: DocumentFile): BrowserWindow {
  const state = loadWindowState()
  const offset = BrowserWindow.getAllWindows().length * 24

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x !== undefined ? state.x + offset : undefined,
    y: state.y !== undefined ? state.y + offset : undefined,
    minWidth: 520,
    minHeight: 400,
    show: false,
    title: 'Untitled',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  docStates.set(win.id, { path: doc?.path ?? null, dirty: false })
  if (doc) pendingDocs.set(win.id, doc)

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // The window only ever shows the editor; a stray link or dropped file must not
  // navigate it away.
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  win.on('close', (event) => {
    const bounds = win.getNormalBounds()
    saveWindowState({ width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y })

    if (closingAnyway.has(win.id)) return
    const state = docStates.get(win.id)
    if (!state?.dirty) return

    event.preventDefault()
    void confirmClose(win, state)
  })

  win.on('closed', () => {
    docStates.delete(win.id)
    pendingDocs.delete(win.id)
    closingAnyway.delete(win.id)
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return win
}

async function confirmClose(win: BrowserWindow, state: DocState): Promise<void> {
  const choice = await showUnsavedDialog(win, titleFor(state))
  if (choice === 'cancel') {
    isQuitting = false
    return
  }
  if (choice === 'save') {
    const content = await requestContent(win)
    if (content === null) {
      isQuitting = false
      return
    }
    const path = state.path ?? (await showSaveDialog(win, null))
    if (!path) {
      isQuitting = false
      return
    }
    try {
      await writeDocument(path, content)
    } catch (err) {
      showError(win, 'Could not save the document.', String(err))
      isQuitting = false
      return
    }
  }
  closingAnyway.add(win.id)
  win.close()
  if (isQuitting) app.quit()
}

/* ------------------------------------------------------------------ *
 * Asking the renderer for its current Markdown (used by the quit guard)
 * ------------------------------------------------------------------ */

let contentRequestId = 0
const contentWaiters = new Map<number, (content: string) => void>()

ipcMain.on('doc:content-response', (_event, id: number, content: string) => {
  const resolve = contentWaiters.get(id)
  if (resolve) {
    contentWaiters.delete(id)
    resolve(content)
  }
})

function requestContent(win: BrowserWindow, timeoutMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    const id = ++contentRequestId
    const timer = setTimeout(() => {
      contentWaiters.delete(id)
      resolve(null)
    }, timeoutMs)
    contentWaiters.set(id, (content) => {
      clearTimeout(timer)
      resolve(content)
    })
    win.webContents.send('doc:content-request', id)
  })
}

/* ------------------------------------------------------------------ *
 * Opening documents
 * ------------------------------------------------------------------ */

async function openPath(path: string): Promise<void> {
  let doc: DocumentFile
  try {
    doc = await readDocument(path)
  } catch (err) {
    showError(BrowserWindow.getFocusedWindow(), `Could not open "${basename(path)}".`, String(err))
    return
  }

  // Reuse the focused window only if it is an untouched blank document.
  const focused = BrowserWindow.getFocusedWindow()
  const state = focused ? docStates.get(focused.id) : undefined
  if (focused && state && !state.path && !state.dirty) {
    applyDocState(focused, { path: doc.path, dirty: false })
    focused.webContents.send('doc:load', doc)
    return
  }

  // If the file is already open, just focus it.
  for (const win of BrowserWindow.getAllWindows()) {
    if (docStates.get(win.id)?.path === doc.path) {
      win.focus()
      return
    }
  }

  createWindow(doc)
}

async function openViaDialog(): Promise<void> {
  const path = await showOpenDialog(BrowserWindow.getFocusedWindow())
  if (path) await openPath(path)
}

/* ------------------------------------------------------------------ *
 * IPC surface
 * ------------------------------------------------------------------ */

function registerIpc(): void {
  ipcMain.handle('doc:initial', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const doc = pendingDocs.get(win.id) ?? null
    pendingDocs.delete(win.id)
    return doc
  })

  ipcMain.on('doc:state', (event, state: DocState) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) applyDocState(win, state)
  })

  ipcMain.handle(
    'doc:save',
    async (event, args: { path: string | null; content: string; saveAs: boolean }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      let path = args.path
      if (!path || args.saveAs) {
        path = await showSaveDialog(win, args.path)
        if (!path) return null
      }
      try {
        await writeDocument(path, args.content)
      } catch (err) {
        showError(win, 'Could not save the document.', String(err))
        return null
      }
      if (win) applyDocState(win, { path, dirty: false })
      return { path }
    }
  )

  ipcMain.handle('doc:open-path', async (_event, path: string) => {
    await openPath(path)
  })

  ipcMain.handle('doc:read', async (_event, path: string) => {
    try {
      return await readDocument(path)
    } catch {
      return null
    }
  })

  ipcMain.handle('app:home-dir', () => app.getPath('home'))

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url)
  })
}

/* ------------------------------------------------------------------ *
 * App lifecycle
 * ------------------------------------------------------------------ */

// Images referenced from a document live outside the app bundle. A dedicated
// scheme lets the renderer show them without granting the page file:// access.
protocol.registerSchemesAsPrivileged([
  { scheme: 'mdimg', privileges: { standard: false, secure: true, supportFetchAPI: true } }
])

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (app.isReady()) void openPath(path)
  else queuedFiles.push(path)
})

app.on('before-quit', () => {
  isQuitting = true
})

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'MDMaker',
    applicationVersion: app.getVersion(),
    copyright: 'WYSIWYG Markdown editor'
  })

  protocol.handle('mdimg', (request) => {
    const filePath = decodeURIComponent(request.url.slice('mdimg://'.length))
    return net.fetch(`file://${filePath}`)
  })

  registerIpc()
  buildMenu({
    newWindow: () => createWindow(),
    openFile: () => void openViaDialog()
  })

  const argFiles = process.argv.slice(1).filter((a) => /\.(md|markdown|mdown|mkd|txt)$/i.test(a))
  const startupFiles = [...queuedFiles, ...(isDev ? [] : argFiles)]

  if (startupFiles.length > 0) {
    startupFiles.forEach((f) => void openPath(f))
  } else {
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
