import { describe, expect, it } from 'vitest'
import { markdownToHtml } from '../parse'
import { htmlToMarkdown } from '../serialize'

/** Markdown -> editor HTML -> Markdown, the exact path an open/save cycle takes. */
function roundtrip(markdown: string): string {
  const { html, frontmatter } = markdownToHtml(markdown)
  return htmlToMarkdown(html, frontmatter)
}

describe('canonical style', () => {
  it('writes ATX headings', () => {
    expect(roundtrip('Title\n=====\n\nSub\n---\n')).toBe('# Title\n\n## Sub\n')
  })

  it('normalizes bullets to -', () => {
    expect(roundtrip('* one\n* two\n')).toBe('- one\n- two\n')
    expect(roundtrip('+ one\n+ two\n')).toBe('- one\n- two\n')
  })

  it('keeps lists tight', () => {
    expect(roundtrip('- one\n\n- two\n')).toBe('- one\n- two\n')
  })

  it('numbers ordered lists incrementally', () => {
    expect(roundtrip('1. one\n1. two\n1. three\n')).toBe('1. one\n2. two\n3. three\n')
  })

  it('indents nested lists by two spaces', () => {
    expect(roundtrip('- parent\n    - child\n        - grandchild\n')).toBe(
      '- parent\n  - child\n    - grandchild\n'
    )
  })

  it('uses ** for strong and * for emphasis', () => {
    expect(roundtrip('__bold__ and _italic_\n')).toBe('**bold** and *italic*\n')
  })

  it('converts indented code to fences with a language', () => {
    expect(roundtrip('    const a = 1\n')).toBe('```text\nconst a = 1\n```\n')
  })

  it('keeps the fence language', () => {
    expect(roundtrip('```ts\nconst a: number = 1\n```\n')).toBe(
      '```ts\nconst a: number = 1\n```\n'
    )
  })

  it('writes thematic breaks as ---', () => {
    expect(roundtrip('a\n\n***\n\nb\n')).toBe('a\n\n---\n\nb\n')
  })

  it('collapses runs of blank lines', () => {
    expect(roundtrip('a\n\n\n\n\nb\n')).toBe('a\n\nb\n')
  })

  it('ends with exactly one newline', () => {
    expect(roundtrip('a')).toBe('a\n')
    expect(roundtrip('a\n\n\n')).toBe('a\n')
  })

  it('preserves blank lines and trailing spaces inside fenced code', () => {
    const code = '```python\ndef a():\n    pass\n\n\ndef b():\n    pass\n```\n'
    expect(roundtrip(code)).toBe(code)
  })
})

describe('GFM constructs', () => {
  it('round-trips tables', () => {
    const table = '| Name | Role |\n| ---- | ---- |\n| Ada  | Dev  |\n'
    expect(roundtrip(table)).toBe(table)
  })

  it('aligns table columns and pads cells', () => {
    expect(roundtrip('|a|b|\n|-|-|\n|1|2222|\n')).toBe(
      '| a | b    |\n| - | ---- |\n| 1 | 2222 |\n'
    )
  })

  it('keeps alignment markers', () => {
    expect(roundtrip('| L | C | R |\n| :-- | :---: | --: |\n| a | b | c |\n')).toBe(
      '| L  |  C  |  R |\n| :- | :-: | -: |\n| a  |  b  |  c |\n'
    )
  })

  it('handles escaped pipes in cells', () => {
    const table = '| a      | b |\n| ------ | - |\n| x \\| y | z |\n'
    expect(roundtrip(table)).toBe(table)
  })

  it('round-trips task lists', () => {
    const tasks = '- [x] done\n- [ ] todo\n'
    expect(roundtrip(tasks)).toBe(tasks)
  })

  it('round-trips strikethrough', () => {
    expect(roundtrip('~~gone~~\n')).toBe('~~gone~~\n')
  })

  it('keeps bare URLs bare', () => {
    expect(roundtrip('See https://example.com for more\n')).toBe(
      'See https://example.com for more\n'
    )
  })

  it('round-trips links and images', () => {
    expect(roundtrip('[text](https://example.com)\n')).toBe('[text](https://example.com)\n')
    expect(roundtrip('![alt](./img.png)\n')).toBe('![alt](./img.png)\n')
  })

  it('round-trips blockquotes and nested content', () => {
    const quote = '> **Note**\n>\n> - a\n> - b\n'
    expect(roundtrip(quote)).toBe(quote)
  })

  it('round-trips inline code containing backticks', () => {
    expect(roundtrip('`` a ` b ``\n')).toBe('``a ` b``\n')
  })

  it('round-trips fences containing fences', () => {
    const nested = '````md\n```js\nx\n```\n````\n'
    expect(roundtrip(nested)).toBe(nested)
  })
})

describe('frontmatter', () => {
  it('passes YAML frontmatter through untouched', () => {
    const doc = '---\nname: test\nmetadata:\n  type: user\n---\n\n# Body\n'
    expect(roundtrip(doc)).toBe(doc)
  })

  it('does not treat a leading rule as frontmatter', () => {
    expect(roundtrip('---\n\ntext\n')).toBe('---\n\ntext\n')
  })
})

describe('stability', () => {
  const document = [
    '---',
    'title: Plan',
    '---',
    '',
    '# Heading 1',
    '',
    'Intro with **bold**, *italic*, ~~strike~~ and `code`.',
    '',
    '## Heading 2',
    '',
    '- bullet one',
    '- bullet two',
    '  - nested',
    '',
    '1. first',
    '2. second',
    '',
    '- [ ] open task',
    '- [x] closed task',
    '',
    '> quoted text',
    '',
    '| Col | Val |',
    '| --- | --- |',
    '| a   | 1   |',
    '',
    '```bash',
    'echo "hi"',
    '```',
    '',
    '---',
    '',
    '[link](https://example.com) and ![img](a.png)',
    ''
  ].join('\n')

  it('is idempotent', () => {
    const once = roundtrip(document)
    expect(roundtrip(once)).toBe(once)
  })

  it('leaves an already-canonical document byte-identical', () => {
    expect(roundtrip(document)).toBe(document)
  })
})

describe('editor markup', () => {
  it('serializes Tiptap task list markup', () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li>' +
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li>' +
      '</ul>'
    expect(htmlToMarkdown(html)).toBe('- [x] done\n- [ ] todo\n')
  })

  it('drops the empty trailing paragraph the editor keeps as a click target', () => {
    expect(htmlToMarkdown('<p>text</p><p></p>')).toBe('text\n')
  })

  it('serializes Tiptap table markup', () => {
    const html =
      '<table><tbody><tr><th colspan="1" rowspan="1"><p>Name</p></th><th colspan="1" rowspan="1"><p>Role</p></th></tr>' +
      '<tr><td colspan="1" rowspan="1"><p>Ada</p></td><td colspan="1" rowspan="1"><p>Dev</p></td></tr></tbody></table>'
    expect(htmlToMarkdown(html)).toBe('| Name | Role |\n| ---- | ---- |\n| Ada  | Dev  |\n')
  })

  it('serializes a code block without a language as text', () => {
    expect(htmlToMarkdown('<pre><code>plain</code></pre>')).toBe('```text\nplain\n```\n')
  })

  it('returns an empty string for an empty document', () => {
    expect(htmlToMarkdown('<p></p>')).toBe('')
  })
})
