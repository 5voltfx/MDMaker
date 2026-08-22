import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DocState, DocumentFile, MenuCommand } from '../shared/types'

const api = {
  /** Document this window was launched with, if any. */
  getInitialDocument: (): Promise<DocumentFile | null> => ipcRenderer.invoke('doc:initial'),

  /** Persist the document. Returns the path it was written to, or null if cancelled. */
  save: (args: {
    path: string | null
    content: string
    saveAs: boolean
  }): Promise<{ path: string } | null> => ipcRenderer.invoke('doc:save', args),

  /** Read a file without going through a dialog (drag & drop). */
  read: (path: string): Promise<DocumentFile | null> => ipcRenderer.invoke('doc:read', path),

  openPath: (path: string): Promise<void> => ipcRenderer.invoke('doc:open-path', path),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),

  /** Used to abbreviate paths as ~/… in the status bar. */
  homeDir: (): Promise<string> => ipcRenderer.invoke('app:home-dir'),

  /** Keep the native title bar, proxy icon and close guard in sync. */
  reportState: (state: DocState): void => ipcRenderer.send('doc:state', state),

  /** Resolve an OS path for a dropped File object. */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  onMenuCommand: (handler: (command: MenuCommand) => void): (() => void) => {
    const listener = (_e: unknown, command: MenuCommand): void => handler(command)
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.off('menu:command', listener)
  },

  onLoadDocument: (handler: (doc: DocumentFile) => void): (() => void) => {
    const listener = (_e: unknown, doc: DocumentFile): void => handler(doc)
    ipcRenderer.on('doc:load', listener)
    return () => ipcRenderer.off('doc:load', listener)
  },

  /** Main asks for the live Markdown when quitting with unsaved changes. */
  onContentRequest: (handler: () => string): (() => void) => {
    const listener = (_e: unknown, id: number): void => {
      ipcRenderer.send('doc:content-response', id, handler())
    }
    ipcRenderer.on('doc:content-request', listener)
    return () => ipcRenderer.off('doc:content-request', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
