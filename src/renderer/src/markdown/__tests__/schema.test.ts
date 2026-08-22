// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { generateHTML, generateJSON } from '@tiptap/react'
import { extensions } from '../../editor/extensions'
import { markdownToHtml } from '../parse'
import { htmlToMarkdown } from '../serialize'

/**
 * The full open -> edit -> save loop, including the trip through Tiptap's schema.
 * Anything the schema cannot represent is dropped here rather than in the
 * serializer, so this is the test that proves nothing is lost on a real save.
 */
function roundtrip(markdown: string): string {
  const { html, frontmatter } = markdownToHtml(markdown)
  const doc = generateJSON(html, extensions)
  return htmlToMarkdown(generateHTML(doc, extensions), frontmatter)
}

const DOCUMENT = [
  '---',
  'name: plan-doc',
  'description: fixture',
  '---',
  '',
  '# Title',
  '',
  'Paragraph with **bold**, *italic*, ~~strike~~, `code` and a [link](https://example.com).',
  '',
  '## Lists',
  '',
  '- first',
  '- second',
  '  - nested',
  '    - deeper',
  '- third',
  '',
  '1. one',
  '2. two',
  '',
  '- [ ] unchecked',
  '- [x] checked',
  '',
  '### Quote and code',
  '',
  '> A quote with **emphasis**.',
  '',
  '```python',
  'def hello(name: str) -> str:',
  '    return f"hi {name}"',
  '```',
  '',
  '#### Table',
  '',
  '| Left | Center | Right |',
  '| ---- | ------ | ----- |',
  '| a    | b      | c     |',
  '',
  '##### Media',
  '',
  '![diagram](./a.png)',
  '',
  '---',
  '',
  '###### Done',
  ''
].join('\n')

describe('editor schema round trip', () => {
  it('preserves a full document unchanged', () => {
    expect(roundtrip(DOCUMENT)).toBe(DOCUMENT)
  })

  it('is idempotent', () => {
    const once = roundtrip(DOCUMENT)
    expect(roundtrip(once)).toBe(once)
  })

  it('normalizes a scruffy document to the canonical style', () => {
    const scruffy = [
      'Title',
      '=====',
      '',
      '',
      '',
      '* star bullet   ',
      '+ plus bullet',
      '',
      'Setext sub',
      '----------',
      '',
      '__bold__ and _italic_',
      '',
      '    indented code',
      '',
      '1) one',
      '2) two',
      '',
      '***',
      ''
    ].join('\n')

    expect(roundtrip(scruffy)).toBe(
      [
        '# Title',
        '',
        '- star bullet',
        '- plus bullet',
        '',
        '## Setext sub',
        '',
        '**bold** and *italic*',
        '',
        '```text',
        'indented code',
        '```',
        '',
        '1. one',
        '2. two',
        '',
        '---',
        ''
      ].join('\n')
    )
  })

  it('keeps every heading level', () => {
    const headings = [1, 2, 3, 4, 5, 6].map((n) => `${'#'.repeat(n)} H${n}`).join('\n\n') + '\n'
    expect(roundtrip(headings)).toBe(headings)
  })

  it('keeps hard breaks as backslashes', () => {
    expect(roundtrip('line one\\\nline two\n')).toBe('line one\\\nline two\n')
  })

  it('keeps nested task lists', () => {
    const tasks = '- [x] parent\n  - [ ] child\n'
    expect(roundtrip(tasks)).toBe(tasks)
  })

  it('tightens a list item that holds a code block', () => {
    // One paragraph per item means a tight list; the code block still belongs to
    // the item because of its indentation.
    const doc = '- step one\n\n  ```bash\n  echo hi\n  ```\n\n- step two\n'
    const tight = '- step one\n  ```bash\n  echo hi\n  ```\n- step two\n'
    expect(roundtrip(doc)).toBe(tight)
    expect(roundtrip(tight)).toBe(tight)
  })

  it('keeps inline code containing markdown characters', () => {
    expect(roundtrip('Use `**not bold**` here.\n')).toBe('Use `**not bold**` here.\n')
  })

  it('escapes characters that would otherwise become syntax', () => {
    expect(roundtrip('A literal * and _ and # in text\n')).toBe(
      'A literal \\* and \\_ and # in text\n'
    )
  })
})

describe('image paths', () => {
  const baseDir = '/Users/me/docs'

  function roundtripWithBase(markdown: string): string {
    const { html, frontmatter } = markdownToHtml(markdown, baseDir)
    const doc = generateJSON(html, extensions)
    return htmlToMarkdown(generateHTML(doc, extensions), frontmatter)
  }

  it('writes relative image paths back unchanged', () => {
    expect(roundtripWithBase('![diagram](./images/a.png)\n')).toBe('![diagram](./images/a.png)\n')
    expect(roundtripWithBase('![up](../shared/b.svg)\n')).toBe('![up](../shared/b.svg)\n')
  })

  it('leaves absolute URLs alone', () => {
    expect(roundtripWithBase('![x](https://example.com/a.png)\n')).toBe(
      '![x](https://example.com/a.png)\n'
    )
  })

  it('resolves relative paths against the document directory for display', () => {
    const { html } = markdownToHtml('![d](./images/a.png)\n', baseDir)
    expect(html).toContain('src="mdimg:///Users/me/docs/images/a.png"')
    expect(html).toContain('data-md-src="./images/a.png"')
  })

  it('resolves parent-directory paths', () => {
    const { html } = markdownToHtml('![d](../shared/b.png)\n', baseDir)
    expect(html).toContain('src="mdimg:///Users/me/shared/b.png"')
  })
})
