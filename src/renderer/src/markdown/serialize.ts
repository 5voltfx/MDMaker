import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { defaultHandlers } from 'hast-util-to-mdast'
import type { State } from 'hast-util-to-mdast'
import type { Element } from 'hast'
import type { Root as MdastRoot, ListItem, Parent, Paragraph } from 'mdast'
import { visit } from 'unist-util-visit'
import { DEFAULT_CODE_LANGUAGE, gfmOptions, normalizeText, stringifyOptions } from './style'

/**
 * Tiptap renders a task item as
 * `<li data-type="taskItem" data-checked="true"><label><input…><span/></label><div>…</div></li>`.
 * The default handler only finds a checkbox that is the item's first child, so the
 * checked state is read from `data-checked` and the rendered checkbox UI dropped.
 */
function taskAwareListItem(state: State, node: Element): ListItem | undefined {
  if (node.properties?.['dataType'] !== 'taskItem') {
    return defaultHandlers.li(state, node)
  }

  const checkedAttr = node.properties['dataChecked']
  const checked = checkedAttr === 'true' || checkedAttr === '' || checkedAttr === true
  const rest: Element = {
    ...node,
    children: node.children.filter(
      (child) => !(child.type === 'element' && child.tagName === 'label')
    )
  }

  const result: ListItem = {
    type: 'listItem',
    spread: false,
    checked,
    children: state.toFlow(state.all(rest))
  }
  state.patch(node, result)
  return result
}

function isBlank(node: Paragraph): boolean {
  return node.children.every(
    (child) => child.type === 'text' && child.value.trim().length === 0
  )
}

/**
 * Bring the tree to the canonical shape before stringifying:
 * tight lists, a language on every fence, and no empty paragraphs (the editor
 * creates them for spacing and as a trailing click target; Markdown has no such concept).
 */
function remarkCanonical() {
  return (tree: MdastRoot): void => {
    visit(tree, (node) => {
      if (!('children' in node)) return
      const parent = node as Parent
      parent.children = parent.children.filter((child) => {
        if (child.type !== 'paragraph' || !isBlank(child)) return true
        // An empty paragraph is the only way a list item can exist while empty.
        return parent.type === 'listItem' && parent.children.length === 1
      })
    })

    // Two adjacent bullet lists are indistinguishable on screen, and keeping them
    // apart in Markdown costs a non-canonical bullet character (`*` after `-`), so
    // they are merged. Ordered lists are left alone: a restarted count is visible.
    visit(tree, (node) => {
      if (!('children' in node)) return
      const parent = node as Parent
      for (let index = parent.children.length - 1; index > 0; index--) {
        const current = parent.children[index]
        const previous = parent.children[index - 1]
        if (
          current.type === 'list' &&
          previous.type === 'list' &&
          !current.ordered &&
          !previous.ordered
        ) {
          previous.children.push(...current.children)
          parent.children.splice(index, 1)
        }
      }
    })

    visit(tree, 'list', (list) => {
      list.spread = false
      for (const item of list.children) {
        // A loose item is only required when it holds more than one paragraph;
        // everything else stays tight, which is how Claude writes lists.
        item.spread = item.children.filter((child) => child.type === 'paragraph').length > 1
        if (item.spread) list.spread = true
      }
    })

    visit(tree, 'code', (code) => {
      if (!code.lang || !code.lang.trim()) code.lang = DEFAULT_CODE_LANGUAGE
    })
  }
}

/** Restore the path exactly as it was written in the source document. */
function originalImageSrc(state: State, node: Element): ReturnType<typeof defaultHandlers.img> {
  const original = node.properties?.['dataMdSrc']
  if (typeof original !== 'string') return defaultHandlers.img(state, node)
  const restored: Element = {
    ...node,
    properties: { ...node.properties, src: original, dataMdSrc: undefined }
  }
  return defaultHandlers.img(state, restored)
}

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRemark, { handlers: { li: taskAwareListItem, img: originalImageSrc } })
  .use(remarkCanonical)
  .use(remarkGfm, gfmOptions)
  .use(remarkStringify, stringifyOptions)

/** Convert the editor's HTML back into canonical Markdown. */
export function htmlToMarkdown(html: string, frontmatter = ''): string {
  const markdown = String(processor.processSync(html))
  return normalizeText(markdown, frontmatter)
}
