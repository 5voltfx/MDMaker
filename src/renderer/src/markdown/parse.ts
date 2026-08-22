import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root as MdastRoot, List, ListItem } from 'mdast'
import type { Root as HastRoot } from 'hast'
import { resolveImageSrc, splitFrontmatter } from './style'

/**
 * Rewrite GFM task lists into the markup Tiptap's TaskList/TaskItem nodes parse.
 *
 * Done on the mdast side so mdast-util-to-hast never inserts its own
 * `<input type="checkbox">`; Tiptap renders the checkbox itself from
 * `data-checked`, and a stray input would show up as duplicate UI.
 */
function remarkTaskListsForTiptap() {
  return (tree: MdastRoot): void => {
    visit(tree, 'list', (list: List) => {
      const items = list.children.filter((child): child is ListItem => child.type === 'listItem')
      if (!items.some((item) => item.checked === true || item.checked === false)) return

      list.data = { ...list.data, hProperties: { 'data-type': 'taskList' } }

      for (const item of items) {
        const checked = item.checked === true
        item.checked = null
        // `spread` keeps the <p> wrapper, which taskItem's `paragraph+` content requires.
        item.spread = true
        item.data = {
          ...item.data,
          hProperties: { 'data-type': 'taskItem', 'data-checked': String(checked) }
        }
      }
    })
  }
}

/**
 * Point relative image paths at the document's directory so they actually render.
 * The Markdown source is kept in `data-md-src` and written back out unchanged.
 */
function rehypeResolveImages(options: { baseDir?: string }) {
  return (tree: HastRoot): void => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return
      const src = node.properties?.['src']
      if (typeof src !== 'string') return
      const resolved = resolveImageSrc(src, options.baseDir)
      if (resolved === src) return
      node.properties['data-md-src'] = src
      node.properties['src'] = resolved
    })
  }
}

/**
 * Convert a Markdown document to HTML for Tiptap.
 * Frontmatter is split off and returned so it can be re-attached on save.
 */
export function markdownToHtml(
  markdown: string,
  baseDir?: string
): { html: string; frontmatter: string } {
  const { frontmatter, body } = splitFrontmatter(markdown.replace(/\r\n?/g, '\n'))
  const html = String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkTaskListsForTiptap)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeResolveImages, { baseDir })
      .use(rehypeStringify)
      .processSync(body)
  )
  return { html, frontmatter }
}
