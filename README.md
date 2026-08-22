# MDMaker

A WYSIWYG Markdown editor for macOS that writes **one consistent Markdown style**,
no matter how the document was authored, pasted, or previously formatted.

The editing surface is rich text; the file on disk is canonical Markdown. Every save
runs the document through a single serializer, so re-saving an unchanged document is
always byte-identical, and opening a scruffy file cleans it up.

![MDMaker](build/icon.png)

## The Markdown style it writes

The target is the CommonMark + GFM subset used in Claude-facing documentation and
plan submissions:

| Element      | Written as                                        |
| ------------ | ------------------------------------------------- |
| Headings     | ATX — `#` … `######`, never setext                |
| Bullets      | `-` (never `*` or `+`)                            |
| Numbering    | `1.` `2.` `3.`, incrementing                      |
| Emphasis     | `*italic*`, `**bold**`, `~~strike~~`              |
| Code         | Fenced only, always with a language (`text` if unset) |
| Lists        | Tight, indented two spaces per level              |
| Tables       | GFM, padded and column-aligned                    |
| Task lists   | `- [ ]` / `- [x]`                                 |
| Rules        | `---`                                             |
| URLs         | Bare (`https://x`), not `<https://x>`             |
| Line endings | LF, no trailing whitespace, one newline at EOF    |
| Paragraphs   | One line each — no hard wrapping                  |

Other behaviours worth knowing:

- YAML frontmatter is passed through verbatim — it is never re-formatted or parsed.
- Content inside fenced code blocks is preserved exactly, including blank lines.
- Two adjacent bullet lists are merged (they are indistinguishable on screen, and
  keeping them apart would require a non-canonical `*` bullet).
- The editor schema only contains things Markdown can express, so nothing you can
  type will be silently dropped on save.

All of this is defined in one place: `src/renderer/src/markdown/style.ts`. Change an
option there and the whole app follows.

## Using it

**Formatting** — toolbar, selection bubble menu, menu bar, and Markdown input rules
(type `## `, `- `, `1. `, `> `, ` ``` `, `- [ ] `, `---` and they transform as you type).

| Action        | Shortcut | Action           | Shortcut |
| ------------- | -------- | ---------------- | -------- |
| Bold          | ⌘B       | Bullet list      | ⇧⌘8      |
| Italic        | ⌘I       | Numbered list    | ⇧⌘7      |
| Strikethrough | ⇧⌘X      | Task list        | ⇧⌘9      |
| Inline code   | ⌘E       | Blockquote       | ⇧⌘.      |
| Link          | ⌘K       | Code block       | ⌥⌘C      |
| Body text     | ⌥⌘0      | Insert table     | ⌥⌘T      |
| Heading 1–6   | ⌥⌘1–6    | Insert image     | ⌥⌘P      |
| Markdown source | ⌘/     | Horizontal rule  | ⌥⌘R      |

**Files** — New ⌘N (new window), Open ⌘O, Save ⌘S, Save As ⇧⌘S, plus Open Recent.
Saves are atomic (written to a temp file, then renamed), so an interrupted save can
never truncate your document. Dropping a `.md` file on the window opens it, and the
title bar shows the usual macOS edited-dot and proxy icon.

**Source view** (⌘/) shows exactly the bytes that would be written, frontmatter
included, and is editable. Switching back re-parses it.

**Images** with relative paths (`./images/x.png`) are resolved against the document's
directory for display and written back exactly as typed.

## Building

```bash
npm install
npm run dev        # run with hot reload
npm test           # round-trip and canonical-style tests
npm run build:mac  # -> dist/MDMaker-<version>-universal.dmg
```

The DMG is a universal binary: it runs on both Apple Silicon and Intel Macs.

### Installing on another Mac

The app is **not code-signed** (that needs a paid Apple Developer ID), so macOS
quarantines it after a copy or download. Once per machine:

1. Open the DMG and drag **MDMaker** to Applications.
2. Clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine /Applications/MDMaker.app
```

Alternatively, right-click the app → **Open** → **Open** the first time.

## How it works

```
main process            preload (contextBridge)   renderer
────────────            ───────────────────────   ────────
menus, dialogs   <IPC>  window.api                React app
file read/write                                   ├─ Tiptap (WYSIWYG)
recent docs, quit guard                           ├─ CodeMirror (source)
mdimg:// for local images                         └─ markdown/ pipeline
```

The renderer is sandboxed with context isolation; all filesystem access lives in the
main process.

The Markdown pipeline is the core:

- **Open** — `remark-parse` → `remark-gfm` → `remark-rehype` → HTML → Tiptap
- **Save** — Tiptap HTML → `rehype-parse` → `rehype-remark` → `remark-stringify`

Both directions go through [unified](https://unifiedjs.com) rather than a bundled
editor add-on, because that is what makes the output style fully controllable.

`npm test` covers the full loop *through Tiptap's schema*, asserting that documents
round-trip byte-identically and that non-canonical input converges to the house style.

## Layout

```
src/
├─ main/        window, menu, file I/O, dialogs
├─ preload/     the contextBridge API
├─ shared/      types shared across processes
└─ renderer/src/
   ├─ markdown/ style.ts, parse.ts, serialize.ts + tests   ← the important part
   ├─ editor/   Tiptap extensions, toolbar, bubble menu
   ├─ source/   CodeMirror raw view
   └─ styles/   app chrome + document typography
```

`sample.md` is a deliberately messy document for trying the normalization out.

## License

MIT — see [LICENSE](LICENSE). Copyright © 2026 5voltFX.
