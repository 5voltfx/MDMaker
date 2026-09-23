import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { extensions } from './editor/extensions'
import { Toolbar, type Mode } from './editor/Toolbar'
import { SelectionMenu } from './editor/SelectionMenu'
import { handleTableContextMenu, runTableCommand } from './editor/table-menu'
import { Source } from './source/Source'
import { PromptDialog, type PromptRequest } from './PromptDialog'
import { documentDirectory, htmlToMarkdown, markdownToHtml, resolveImageSrc } from './markdown'
import type { DocumentFile, MenuCommand } from '../../shared/types'

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent): void => setDark(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return dark
}

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

export default function App(): JSX.Element {
  const [path, setPath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<Mode>('wysiwyg')
  const [source, setSource] = useState('')
  const [prompt, setPrompt] = useState<PromptRequest | null>(null)
  const [home, setHome] = useState('')
  const dark = useDarkMode()

  /** Frontmatter is carried outside the editor model and re-attached on save. */
  const frontmatter = useRef('')

  const editor = useEditor({
    extensions,
    content: '',
    autofocus: 'start',
    editorProps: { attributes: { class: 'prose', spellcheck: 'true' } },
    onUpdate: () => setDirty(true)
  })

  /* ---------------------------------------------------------------- *
   * Document <-> Markdown
   * ---------------------------------------------------------------- */

  const getMarkdown = useCallback((): string => {
    if (mode === 'source') return source
    return htmlToMarkdown(editor?.getHTML() ?? '', frontmatter.current)
  }, [editor, mode, source])

  // Menu-driven handlers are registered once, so they read the live values here.
  const latest = useRef({ getMarkdown, path, mode, dirty })
  useEffect(() => {
    latest.current = { getMarkdown, path, mode, dirty }
  }, [getMarkdown, path, mode, dirty])

  const loadDocument = useCallback(
    (doc: DocumentFile | { path: string | null; content: string }) => {
      if (!editor) return
      const { html, frontmatter: matter } = markdownToHtml(
        doc.content,
        documentDirectory(doc.path)
      )
      frontmatter.current = matter
      editor.commands.setContent(html, { emitUpdate: false })
      // Land at the top of the document rather than wherever setContent left the cursor.
      editor.commands.focus('start')
      setSource(doc.content)
      setPath(doc.path)
      setDirty(false)
      setMode('wysiwyg')
    },
    [editor]
  )

  const save = useCallback(async (saveAs: boolean): Promise<void> => {
    const content = latest.current.getMarkdown()
    const result = await window.api.save({ path: latest.current.path, content, saveAs })
    if (!result) return
    setPath(result.path)
    setDirty(false)
    // Saving canonicalizes; keep the source view showing what is actually on disk.
    if (latest.current.mode === 'source') setSource(content)
  }, [])

  const toggleMode = useCallback(() => {
    if (!editor) return
    setMode((current) => {
      if (current === 'wysiwyg') {
        setSource(htmlToMarkdown(editor.getHTML(), frontmatter.current))
        return 'source'
      }
      const { html, frontmatter: matter } = markdownToHtml(source, documentDirectory(path))
      frontmatter.current = matter
      editor.commands.setContent(html, { emitUpdate: false })
      return 'wysiwyg'
    })
  }, [editor, source, path])

  /* ---------------------------------------------------------------- *
   * Main-process wiring
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!editor) return
    void window.api.getInitialDocument().then((doc) => {
      if (doc) loadDocument(doc)
    })
    return window.api.onLoadDocument(loadDocument)
  }, [editor, loadDocument])

  useEffect(() => {
    window.api.reportState({ path, dirty })
  }, [path, dirty])

  useEffect(() => window.api.onContentRequest(() => latest.current.getMarkdown()), [])

  useEffect(() => {
    void window.api.homeDir().then(setHome)
  }, [])

  const promptFor = useCallback(
    (request: Omit<PromptRequest, 'value'> & { value?: string }) =>
      setPrompt({ value: '', ...request }),
    []
  )

  const insertLink = useCallback(() => {
    if (!editor) return
    const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
    promptFor({
      title: 'Link',
      label: 'URL',
      value: previous,
      placeholder: 'https://example.com',
      onSubmit: (url) => {
        if (url.length === 0) {
          editor.chain().focus().extendMarkRange('link').unsetLink().run()
          return
        }
        if (editor.state.selection.empty && !editor.isActive('link')) {
          editor
            .chain()
            .focus()
            .insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] })
            .run()
          return
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }
    })
  }, [editor, promptFor])

  const insertImage = useCallback(() => {
    if (!editor) return
    promptFor({
      title: 'Image',
      label: 'Image URL or path',
      placeholder: './images/diagram.png',
      onSubmit: (src) => {
        if (src.length === 0) return
        const resolved = resolveImageSrc(src, documentDirectory(latest.current.path))
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'image',
            attrs: resolved === src ? { src } : { src: resolved, 'data-md-src': src }
          })
          .run()
      }
    })
  }, [editor, promptFor])

  useEffect(() => {
    if (!editor) return
    return window.api.onMenuCommand((command: MenuCommand) => {
      if (command === 'file:save') return void save(false)
      if (command === 'file:save-as') return void save(true)
      if (command === 'view:toggle-source') return toggleMode()
      // Formatting only applies to the rich-text surface.
      if (latest.current.mode === 'source') return
      if (runTableCommand(editor, command)) return

      const chain = editor.chain().focus()
      switch (command) {
        case 'format:bold':
          return void chain.toggleBold().run()
        case 'format:italic':
          return void chain.toggleItalic().run()
        case 'format:strike':
          return void chain.toggleStrike().run()
        case 'format:code':
          return void chain.toggleCode().run()
        case 'format:link':
          return insertLink()
        case 'format:clear':
          return void chain.unsetAllMarks().clearNodes().run()
        case 'block:paragraph':
          return void chain.setParagraph().run()
        case 'block:heading1':
        case 'block:heading2':
        case 'block:heading3':
        case 'block:heading4':
        case 'block:heading5':
        case 'block:heading6':
          return void chain
            .setHeading({ level: Number(command.slice(-1)) as 1 | 2 | 3 | 4 | 5 | 6 })
            .run()
        case 'block:bullet-list':
          return void chain.toggleBulletList().run()
        case 'block:ordered-list':
          return void chain.toggleOrderedList().run()
        case 'block:task-list':
          return void chain.toggleTaskList().run()
        case 'block:blockquote':
          return void chain.toggleBlockquote().run()
        case 'block:code-block':
          return void chain.toggleCodeBlock().run()
        case 'block:table':
          return void chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        case 'block:rule':
          return void chain.setHorizontalRule().run()
        case 'block:image':
          return insertImage()
        default:
          return
      }
    })
  }, [editor, save, toggleMode, insertLink, insertImage])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onContextMenu = (event: MouseEvent): void => handleTableContextMenu(editor, event)
    dom.addEventListener('contextmenu', onContextMenu)
    return () => dom.removeEventListener('contextmenu', onContextMenu)
  }, [editor])

  /* ---------------------------------------------------------------- *
   * Dropping a file onto the window opens it
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const onDragOver = (event: DragEvent): void => event.preventDefault()
    const onDrop = (event: DragEvent): void => {
      // Always cancel: an unhandled drop navigates the window to the dropped file.
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      const filePath = window.api.pathForFile(file)
      if (!filePath || !/\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)) return
      void window.api.openPath(filePath)
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  /* ---------------------------------------------------------------- *
   * External links open in the browser, not in the app window
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      event.preventDefault()
      const href = anchor.getAttribute('href')
      if (href && (event.metaKey || event.ctrlKey)) void window.api.openExternal(href)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const text = e?.getText() ?? ''
      return { words: countWords(text), characters: text.length }
    }
  })

  const counts =
    mode === 'source'
      ? { words: countWords(source), characters: source.length }
      : (stats ?? { words: 0, characters: 0 })

  if (!editor) return <div className="app" />

  return (
    <div className="app">
      <Toolbar
        editor={editor}
        mode={mode}
        onToggleMode={toggleMode}
        onInsertLink={insertLink}
        onInsertImage={insertImage}
      />

      <main className="surface">
        {mode === 'wysiwyg' ? (
          <>
            <SelectionMenu editor={editor} onInsertLink={insertLink} />
            <EditorContent editor={editor} className="editor-scroll" />
          </>
        ) : (
          <Source value={source} dark={dark} onChange={(value) => {
            setSource(value)
            setDirty(true)
          }} />
        )}
      </main>

      <footer className="status">
        <span className="path" title={path ?? 'Not saved yet'}>
          {path ? (home && path.startsWith(home) ? `~${path.slice(home.length)}` : path) : 'Untitled'}
          {dirty ? ' — edited' : ''}
        </span>
        <span className="counts">
          {counts.words} words · {counts.characters} characters
        </span>
      </footer>

      <PromptDialog request={prompt} onClose={() => setPrompt(null)} />
    </div>
  )
}
