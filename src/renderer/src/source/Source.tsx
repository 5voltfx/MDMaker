import { useMemo, type JSX } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'

/**
 * Raw Markdown view. Shows exactly the bytes that would be written to disk,
 * including frontmatter, and is editable in place.
 */
export function Source({
  value,
  dark,
  onChange
}: {
  value: string
  dark: boolean
  onChange: (value: string) => void
}): JSX.Element {
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '13.5px' },
        '.cm-content': {
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          padding: '24px 0'
        },
        '.cm-gutters': { border: 'none' },
        '&.cm-focused': { outline: 'none' }
      })
    ],
    []
  )

  return (
    <CodeMirror
      className="source"
      value={value}
      height="100%"
      theme={dark ? 'dark' : 'light'}
      extensions={extensions}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
      onChange={onChange}
    />
  )
}
