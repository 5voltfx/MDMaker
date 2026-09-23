import type { Editor } from '@tiptap/react'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import { CellSelection, isInTable, selectedRect, tableNodeTypes } from '@tiptap/pm/tables'
import type { MenuCommand, TableMenuState } from '../../../shared/types'

/**
 * Right-clicking inside a table pops up the native table menu. The click first
 * moves the cursor to the cell under the pointer, unless that cell is already
 * part of the selection, so a multi-cell selection can be acted on as a whole.
 */
export function handleTableContextMenu(editor: Editor, event: MouseEvent): void {
  const cell = (event.target as HTMLElement | null)?.closest('td, th')
  if (!cell || !editor.view.dom.contains(cell)) return

  const { view } = editor
  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!hit) return
  const { selection } = view.state
  const alreadySelected =
    selection instanceof CellSelection
      ? cell.classList.contains('selectedCell')
      : !selection.empty && hit.pos >= selection.from && hit.pos <= selection.to
  if (!alreadySelected) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, hit.pos)))
  }
  view.focus()
  if (!isInTable(view.state)) return

  event.preventDefault()
  window.api.showTableMenu(menuState(editor))
}

function menuState(editor: Editor): TableMenuState {
  const { top, bottom, left, right, map } = selectedRect(editor.state)
  return {
    // GFM tables always have exactly one header row, and it has to come first.
    canAddRowAbove: top > 0,
    // Removing every row or column would leave an empty table; that is Delete Table.
    canDeleteRow: bottom - top < map.height,
    canDeleteColumn: right - left < map.width
  }
}

/** Keep the first row as the header row after the old one is deleted. */
function promoteHeaderRow(tr: Transaction): boolean {
  const { $from } = tr.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const table = $from.node(depth)
    if (table.type.spec.tableRole !== 'table') continue
    const types = tableNodeTypes(table.type.schema)
    const firstRow = table.firstChild
    if (!firstRow) return true
    let pos = $from.start(depth) + 1
    firstRow.forEach((cell) => {
      if (cell.type !== types.header_cell) tr.setNodeMarkup(pos, types.header_cell, cell.attrs)
      pos += cell.nodeSize
    })
    return true
  }
  return true
}

/** Runs a table command chosen from the context menu. Returns false for other commands. */
export function runTableCommand(editor: Editor, command: MenuCommand): boolean {
  const chain = editor.chain().focus()
  switch (command) {
    case 'table:row-above':
      chain.addRowBefore().run()
      return true
    case 'table:row-below':
      chain.addRowAfter().run()
      return true
    case 'table:delete-row':
      chain
        .deleteRow()
        .command(({ tr }) => promoteHeaderRow(tr))
        .run()
      return true
    case 'table:column-left':
      chain.addColumnBefore().run()
      return true
    case 'table:column-right':
      chain.addColumnAfter().run()
      return true
    case 'table:delete-column':
      chain.deleteColumn().run()
      return true
    case 'table:delete':
      chain.deleteTable().run()
      return true
    default:
      return false
  }
}
