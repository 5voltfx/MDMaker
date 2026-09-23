import { app, Menu, BrowserWindow, shell } from 'electron'
import type { MenuCommand, TableMenuState } from '../shared/types'

type Send = (command: MenuCommand) => void

function sender(): Send {
  return (command) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send('menu:command', command)
  }
}

interface MenuHandlers {
  newWindow: () => void
  openFile: () => void
}

export function buildMenu(handlers: MenuHandlers): void {
  const send = sender()
  const cmd = (
    label: string,
    accelerator: string | undefined,
    command: MenuCommand
  ): Electron.MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(command)
  })

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => handlers.newWindow() },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => handlers.openFile() },
        {
          label: 'Open Recent',
          role: 'recentDocuments',
          submenu: [{ label: 'Clear Menu', role: 'clearRecentDocuments' }]
        },
        { type: 'separator' },
        cmd('Save', 'CmdOrCtrl+S', 'file:save'),
        cmd('Save As…', 'Shift+CmdOrCtrl+S', 'file:save-as'),
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle', label: 'Paste as Plain Text' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Speech', submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] }
      ]
    },
    {
      label: 'Format',
      submenu: [
        cmd('Bold', 'CmdOrCtrl+B', 'format:bold'),
        cmd('Italic', 'CmdOrCtrl+I', 'format:italic'),
        cmd('Strikethrough', 'Shift+CmdOrCtrl+X', 'format:strike'),
        cmd('Inline Code', 'CmdOrCtrl+E', 'format:code'),
        cmd('Link…', 'CmdOrCtrl+K', 'format:link'),
        cmd('Clear Formatting', 'Alt+CmdOrCtrl+Backspace', 'format:clear'),
        { type: 'separator' },
        cmd('Paragraph', 'Alt+CmdOrCtrl+0', 'block:paragraph'),
        cmd('Heading 1', 'Alt+CmdOrCtrl+1', 'block:heading1'),
        cmd('Heading 2', 'Alt+CmdOrCtrl+2', 'block:heading2'),
        cmd('Heading 3', 'Alt+CmdOrCtrl+3', 'block:heading3'),
        cmd('Heading 4', 'Alt+CmdOrCtrl+4', 'block:heading4'),
        cmd('Heading 5', 'Alt+CmdOrCtrl+5', 'block:heading5'),
        cmd('Heading 6', 'Alt+CmdOrCtrl+6', 'block:heading6'),
        { type: 'separator' },
        cmd('Bullet List', 'Shift+CmdOrCtrl+8', 'block:bullet-list'),
        cmd('Numbered List', 'Shift+CmdOrCtrl+7', 'block:ordered-list'),
        cmd('Task List', 'Shift+CmdOrCtrl+9', 'block:task-list'),
        cmd('Blockquote', 'Shift+CmdOrCtrl+.', 'block:blockquote'),
        cmd('Code Block', 'Alt+CmdOrCtrl+C', 'block:code-block'),
        { type: 'separator' },
        cmd('Insert Table', 'Alt+CmdOrCtrl+T', 'block:table'),
        cmd('Insert Image…', 'Alt+CmdOrCtrl+P', 'block:image'),
        cmd('Horizontal Rule', 'Alt+CmdOrCtrl+R', 'block:rule')
      ]
    },
    {
      label: 'View',
      submenu: [
        cmd('Toggle Markdown Source', 'CmdOrCtrl+/', 'view:toggle-source'),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Markdown Guide',
          click: () => shell.openExternal('https://www.markdownguide.org/basic-syntax/')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Right-click menu for a table cell. Choices go back to the window that asked. */
export function popupTableMenu(win: BrowserWindow, state: TableMenuState): void {
  const item = (
    label: string,
    command: MenuCommand,
    enabled = true
  ): Electron.MenuItemConstructorOptions => ({
    label,
    enabled,
    click: () => win.webContents.send('menu:command', command)
  })

  Menu.buildFromTemplate([
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    item('Insert Row Above', 'table:row-above', state.canAddRowAbove),
    item('Insert Row Below', 'table:row-below'),
    item('Delete Row', 'table:delete-row', state.canDeleteRow),
    { type: 'separator' },
    item('Insert Column Left', 'table:column-left'),
    item('Insert Column Right', 'table:column-right'),
    item('Delete Column', 'table:delete-column', state.canDeleteColumn),
    { type: 'separator' },
    item('Delete Table', 'table:delete')
  ]).popup({ window: win })
}
