# MDMaker

A WYSIWYG editor that writes **canonical Markdown** — the same bytes every time,
whatever you paste into it.

## Why it exists

Editors disagree about `*` vs `-` bullets, setext vs ATX headings, and how to pad
a table. That churn shows up as noise in *documentation* diffs.

- One serializer, one style
- ~~Two-space line breaks~~ replaced with explicit backslashes
- Round-trips are byte-stable

### Supported blocks

| Block       | Syntax        | Notes                  |
| ----------- | ------------- | ---------------------- |
| Heading     | `#` … `######` | ATX only               |
| Task list   | `- [ ]`       | GFM                    |
| Code fence  | ```` ``` ```` | Language always tagged |

- [x] Parse and serialize through remark
- [x] Toolbar, bubble menu, input rules
- [ ] Ship the DMG

> Everything on screen maps to something Markdown can express — nothing is lost
> on save.

```typescript
export function htmlToMarkdown(html: string, frontmatter = ''): string {
  const markdown = String(processor.processSync(html))
  return normalizeText(markdown, frontmatter)
}
```

---

See https://commonmark.org for the base spec.
