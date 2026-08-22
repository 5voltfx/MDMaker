import type { Options as StringifyOptions } from 'remark-stringify'
import type { Options as GfmOptions } from 'remark-gfm'
import { defaultHandlers } from 'mdast-util-to-markdown'
import type { Link } from 'mdast'

/**
 * A link whose text is its own URL is written bare — `https://example.com`, not
 * `<https://example.com>` — which is how Claude writes URLs. GFM reads the bare
 * form back as a link, so the round trip is stable.
 *
 * This has to be a handler rather than a tree rewrite: turning the link into a
 * text node makes the GFM extension escape the colon (`https\://`) to stop the
 * text from autolinking, which is precisely the behaviour we want here.
 */
function isLiteralAutolink(node: Link): boolean {
  if (node.children.length !== 1) return false
  const [child] = node.children
  if (child.type !== 'text') return false
  const text = child.value
  if (/[\s<>]/.test(text) || /[.,;:!?)'"]$/.test(text)) return false
  return (
    (node.url === text && /^https?:\/\//.test(text)) ||
    (node.url === `http://${text}` && text.startsWith('www.')) ||
    (node.url === `mailto:${text}` && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
  )
}


/**
 * The single definition of the Markdown dialect MDMaker writes.
 *
 * Target: the CommonMark + GFM subset Claude uses in documentation and plans —
 * ATX headings, `-` bullets, `**bold**`, `*italic*`, fenced code with a language,
 * GFM tables and task lists, `---` thematic breaks.
 *
 * Every save runs through these options, so output is identical no matter how the
 * content was authored, pasted, or previously formatted.
 */
export const stringifyOptions: StringifyOptions = {
  bullet: '-', // - foo   (never * or +)
  bulletOther: '*', // only used for immediately adjacent sibling lists
  bulletOrdered: '.', // 1. foo
  incrementListMarker: true, // 1. 2. 3. rather than 1. 1. 1.
  listItemIndent: 'one', // "- foo", continuations indented by two spaces
  emphasis: '*', // *italic*
  strong: '*', // **bold**
  fence: '`',
  fences: true, // always ``` — never indented code blocks
  rule: '-',
  ruleRepetition: 3, // ---
  ruleSpaces: false,
  setext: false, // ATX headings only
  tightDefinitions: true,
  quote: '"',
  handlers: {
    link(node: Link, parent, state, info) {
      if (isLiteralAutolink(node)) return (node.children[0] as { value: string }).value
      return defaultHandlers.link(node, parent, state, info)
    }
  }
}

/** GFM table rendering: padded and column-aligned, which stays readable in raw form. */
export const gfmOptions: GfmOptions = {
  tableCellPadding: true,
  tablePipeAlign: true
}

/** Language written into a fence when a code block has none. */
export const DEFAULT_CODE_LANGUAGE = 'text'

/**
 * Turn a document-relative image path into something the renderer can load.
 * Absolute URLs, data URIs and paths without a document directory are left alone,
 * so `resolveImageSrc(x) === x` means "nothing to rewrite".
 */
export function resolveImageSrc(src: string, baseDir?: string): string {
  if (!baseDir || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return src
  const absolute = src.startsWith('/') ? src : `${baseDir.replace(/\/$/, '')}/${src}`
  // Collapse ./ and ../ segments the way a file path would resolve.
  const parts: string[] = []
  for (const segment of absolute.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return `mdimg://${encodeURI('/' + parts.join('/'))}`
}

/** The directory a document lives in, for resolving its relative links. */
export function documentDirectory(path: string | null): string | undefined {
  if (!path) return undefined
  const index = path.lastIndexOf('/')
  return index > 0 ? path.slice(0, index) : '/'
}

const FRONTMATTER = /^﻿?(---\r?\n[\s\S]*?\r?\n---)(?:\r?\n|$)/

/**
 * YAML frontmatter is carried through verbatim rather than being modelled in the
 * editor: remark would otherwise read the opening `---` as a thematic break and
 * mangle the block on the way back out.
 */
export function splitFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const match = markdown.match(FRONTMATTER)
  if (!match) return { frontmatter: '', body: markdown }
  return { frontmatter: match[1], body: markdown.slice(match[0].length) }
}

/**
 * Final text normalization applied to every document MDMaker writes.
 *
 * Deliberately conservative: remark already emits exactly one blank line between
 * blocks and never trails whitespace, so the only fixes needed here are the
 * document's edges. Blanket regexes would corrupt fenced code blocks, whose
 * content (blank lines, trailing spaces) is significant and must survive verbatim.
 */
export function normalizeText(markdown: string, frontmatter = ''): string {
  let text = markdown.replace(/^\n+/, '').replace(/\s+$/, '')

  if (frontmatter) {
    text = text.length > 0 ? `${frontmatter}\n\n${text}` : frontmatter
  }
  return text.length > 0 ? `${text}\n` : ''
}
