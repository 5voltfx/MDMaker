import type { JSX } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Icon, type IconName } from './icons'

/** Formatting controls that appear over a text selection. */
export function SelectionMenu({
  editor,
  onInsertLink
}: {
  editor: Editor
  onInsertLink: () => void
}): JSX.Element {
  const item = (icon: IconName, title: string, mark: string, run: () => void): JSX.Element => (
    <button
      type="button"
      className={editor.isActive(mark) ? 'tool active' : 'tool'}
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      <Icon name={icon} />
    </button>
  )

  return (
    <BubbleMenu
      editor={editor}
      className="bubble"
      shouldShow={({ editor: e, from, to }) =>
        from !== to && !e.isActive('codeBlock') && !e.isActive('image')
      }
    >
      {item('bold', 'Bold', 'bold', () => editor.chain().focus().toggleBold().run())}
      {item('italic', 'Italic', 'italic', () => editor.chain().focus().toggleItalic().run())}
      {item('strike', 'Strikethrough', 'strike', () => editor.chain().focus().toggleStrike().run())}
      {item('code', 'Inline code', 'code', () => editor.chain().focus().toggleCode().run())}
      {item('link', 'Link', 'link', onInsertLink)}
    </BubbleMenu>
  )
}
