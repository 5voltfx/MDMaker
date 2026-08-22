import type { JSX } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { Icon, type IconName } from './icons'
import { codeLanguages } from './extensions'

export type Mode = 'wysiwyg' | 'source'

interface ToolbarProps {
  editor: Editor
  mode: Mode
  onToggleMode: () => void
  onInsertLink: () => void
  onInsertImage: () => void
}

const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Body' },
  { value: 'heading1', label: 'Heading 1' },
  { value: 'heading2', label: 'Heading 2' },
  { value: 'heading3', label: 'Heading 3' },
  { value: 'heading4', label: 'Heading 4' },
  { value: 'heading5', label: 'Heading 5' },
  { value: 'heading6', label: 'Heading 6' }
]

function Button({
  icon,
  title,
  active,
  disabled,
  onClick
}: {
  icon: IconName
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={active ? 'tool active' : 'tool'}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keep the selection in the document when a control is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  )
}

export function Toolbar({
  editor,
  mode,
  onToggleMode,
  onInsertLink,
  onInsertImage
}: ToolbarProps): JSX.Element {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      table: e.isActive('table'),
      language: (e.getAttributes('codeBlock').language as string | null) ?? 'text',
      blockType: e.isActive('heading')
        ? `heading${e.getAttributes('heading').level as number}`
        : 'paragraph'
    })
  })

  const sourceMode = mode === 'source'
  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  function setBlockType(value: string): void {
    if (value === 'paragraph') chain().setParagraph().run()
    else chain().setHeading({ level: Number(value.slice(-1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
  }

  return (
    <div className="toolbar">
      <select
        className="block-type"
        value={state.blockType}
        disabled={sourceMode}
        onChange={(event) => setBlockType(event.target.value)}
        title="Paragraph style"
      >
        {BLOCK_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      <span className="sep" />

      <Button
        icon="bold"
        title="Bold (⌘B)"
        active={state.bold}
        disabled={sourceMode}
        onClick={() => chain().toggleBold().run()}
      />
      <Button
        icon="italic"
        title="Italic (⌘I)"
        active={state.italic}
        disabled={sourceMode}
        onClick={() => chain().toggleItalic().run()}
      />
      <Button
        icon="strike"
        title="Strikethrough (⇧⌘X)"
        active={state.strike}
        disabled={sourceMode}
        onClick={() => chain().toggleStrike().run()}
      />
      <Button
        icon="code"
        title="Inline code (⌘E)"
        active={state.code}
        disabled={sourceMode}
        onClick={() => chain().toggleCode().run()}
      />
      <Button
        icon="link"
        title="Link (⌘K)"
        active={state.link}
        disabled={sourceMode}
        onClick={onInsertLink}
      />

      <span className="sep" />

      <Button
        icon="bulletList"
        title="Bullet list (⇧⌘8)"
        active={state.bulletList}
        disabled={sourceMode}
        onClick={() => chain().toggleBulletList().run()}
      />
      <Button
        icon="orderedList"
        title="Numbered list (⇧⌘7)"
        active={state.orderedList}
        disabled={sourceMode}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <Button
        icon="taskList"
        title="Task list (⇧⌘9)"
        active={state.taskList}
        disabled={sourceMode}
        onClick={() => chain().toggleTaskList().run()}
      />
      <Button
        icon="quote"
        title="Blockquote (⇧⌘.)"
        active={state.blockquote}
        disabled={sourceMode}
        onClick={() => chain().toggleBlockquote().run()}
      />

      <span className="sep" />

      <Button
        icon="codeBlock"
        title="Code block (⌥⌘C)"
        active={state.codeBlock}
        disabled={sourceMode}
        onClick={() => chain().toggleCodeBlock().run()}
      />
      <Button
        icon="table"
        title="Insert table (⌥⌘T)"
        active={state.table}
        disabled={sourceMode}
        onClick={() =>
          chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />
      <Button
        icon="image"
        title="Insert image (⌥⌘P)"
        disabled={sourceMode}
        onClick={onInsertImage}
      />
      <Button
        icon="rule"
        title="Horizontal rule (⌥⌘R)"
        disabled={sourceMode}
        onClick={() => chain().setHorizontalRule().run()}
      />

      {state.codeBlock && !sourceMode && (
        <>
          <span className="sep" />
          <select
            className="language"
            value={state.language}
            title="Code language"
            onChange={(event) =>
              chain().updateAttributes('codeBlock', { language: event.target.value }).run()
            }
          >
            {codeLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </>
      )}

      <span className="spacer" />

      <button
        type="button"
        className={sourceMode ? 'tool wide active' : 'tool wide'}
        title="Toggle Markdown source (⌘/)"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggleMode}
      >
        <Icon name={sourceMode ? 'eye' : 'source'} />
        <span>{sourceMode ? 'Preview' : 'Source'}</span>
      </button>
    </div>
  )
}
