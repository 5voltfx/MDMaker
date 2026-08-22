import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { markdownToHtml } from '../markdown'

const MARKDOWN_HINTS =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\||- \[[ x]\])|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\n]+\)/

/**
 * Pasting Markdown as plain text should produce formatted content, not a wall of
 * literal syntax. HTML on the clipboard already carries its own structure, and a
 * code block wants the characters verbatim, so both are left to the default handler.
 */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (_view, event) => {
            const clipboard = event.clipboardData
            if (!clipboard || editor.isActive('codeBlock')) return false
            if (clipboard.types.includes('text/html')) return false

            const text = clipboard.getData('text/plain')
            if (!text || !MARKDOWN_HINTS.test(text)) return false

            const { html } = markdownToHtml(text)
            editor.commands.insertContent(html)
            return true
          }
        }
      })
    ]
  }
})
