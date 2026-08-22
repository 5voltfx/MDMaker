/** Shared between main, preload and renderer. */

export interface DocumentFile {
  path: string
  content: string
}

export interface DocState {
  path: string | null
  dirty: boolean
}

/** Commands the native menu forwards to the renderer. */
export type MenuCommand =
  | 'file:new'
  | 'file:open'
  | 'file:save'
  | 'file:save-as'
  | 'view:toggle-source'
  | 'format:bold'
  | 'format:italic'
  | 'format:strike'
  | 'format:code'
  | 'format:link'
  | 'format:clear'
  | 'block:paragraph'
  | 'block:heading1'
  | 'block:heading2'
  | 'block:heading3'
  | 'block:heading4'
  | 'block:heading5'
  | 'block:heading6'
  | 'block:bullet-list'
  | 'block:ordered-list'
  | 'block:task-list'
  | 'block:blockquote'
  | 'block:code-block'
  | 'block:table'
  | 'block:rule'
  | 'block:image'

export type CloseChoice = 'save' | 'discard' | 'cancel'
