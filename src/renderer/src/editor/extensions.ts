import { StarterKit } from '@tiptap/starter-kit'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Image } from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'
import { MarkdownPaste } from './markdown-paste'

export const lowlight = createLowlight(common)

/** Languages offered in a code block's picker, plus the plain-text fallback. */
export const codeLanguages: string[] = ['text', ...lowlight.listLanguages().sort()]

/**
 * The editor schema is deliberately limited to what canonical Markdown can express.
 * Anything that would be silently dropped on save (underline, font colour, …) is
 * left out so the document on screen always matches the document on disk.
 */
export const extensions = [
  StarterKit.configure({
    codeBlock: false, // replaced by the highlighting version below
    underline: false, // Markdown has no underline
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: { rel: 'noopener noreferrer' }
    }
  }),
  CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  // The Markdown-relative path travels alongside the resolved one so saving
  // writes back what the author typed, not the mdimg:// URL used for display.
  Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        'data-md-src': { default: null }
      }
    }
  }).configure({ inline: true, allowBase64: true }),
  Placeholder.configure({ placeholder: 'Start writing…' }),
  MarkdownPaste
]
