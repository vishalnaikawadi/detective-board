import { anchorPosition, clamp, elementBounds, threadMidpoint, worldToScreen } from '../../lib/geometry'
import { useBoards } from '../../store/boards'
import { useEditor } from '../../store/editor'
import type { Board, Viewport } from '../../types'
import { Icon } from '../ui/Icons'
import { actions } from './actions'

interface Props {
  boardId: string
  id: string
  vp: Viewport
}

function ToolButton({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`tb-btn${danger ? ' tb-btn--danger' : ''}`} onClick={onClick} aria-label={label} data-tip={label}>
      <Icon name={icon} />
    </button>
  )
}

/** Floating controls that sit just above the selected element, in screen space. */
export function SelectionToolbar({ boardId, id, vp }: Props) {
  const el = useBoards((s) => s.boards[boardId]?.elements.find((e) => e.id === id))
  const editingId = useEditor((s) => s.editingId)
  if (!el) return null

  const b = elementBounds(el)
  const top = worldToScreen({ x: (b.minX + b.maxX) / 2, y: b.minY }, vp)
  const bottom = worldToScreen({ x: 0, y: b.maxY }, vp).y
  // Sit above the rotate handle; flip below the element when there's no room up top.
  const below = top.y - 50 < 110
  const hasImage = el.type === 'photo' && (el.imageId || el.imageUrl)
  const hasThreads = actions.hasThreads(boardId, id)

  return (
    <div
      className={`toolbar${below ? ' toolbar--below' : ''}`}
      style={{ left: clamp(top.x, 180, window.innerWidth - 180), top: below ? bottom + 22 : top.y - 50 }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {el.type === 'article' && el.status !== 'empty' && (
        <>
          <ToolButton icon="open" label="Open article" onClick={() => actions.open(boardId, id)} />
          <ToolButton icon="edit" label="Edit text" onClick={() => actions.edit(id)} />
          <ToolButton icon="link" label="Change link" onClick={() => actions.changeLink(boardId, id)} />
        </>
      )}
      {(el.type === 'sticky' || el.type === 'note') && editingId !== id && (
        <ToolButton icon="edit" label="Write" onClick={() => actions.edit(id)} />
      )}
      {el.type === 'map' && el.status === 'ready' && (
        <>
          {editingId === id ? (
            <ToolButton icon="check" label="Done editing map" onClick={() => useEditor.getState().setEditing(null)} />
          ) : (
            <ToolButton icon="edit" label="Edit map" onClick={() => actions.edit(id)} />
          )}
          <ToolButton icon="search" label="Search another place" onClick={() => actions.relocate(boardId, id)} />
        </>
      )}
      {el.type === 'folder' && (
        <>
          <ToolButton icon="upload" label="Add documents" onClick={() => actions.pickDocs(id)} />
          <ToolButton icon="edit" label="Name the file" onClick={() => actions.edit(id)} />
        </>
      )}
      {el.type === 'photo' && (
        <>
          {hasImage && <ToolButton icon="image" label="Replace photo" onClick={() => actions.clearPhoto(boardId, id)} />}
          <ToolButton icon="edit" label="Caption" onClick={() => actions.edit(id)} />
        </>
      )}
      <span className="tb-sep" />
      <ToolButton icon="thread" label="Connect with thread" onClick={() => actions.connectFrom(id)} />
      {hasThreads && <ToolButton icon="unlink" label="Remove threads" onClick={() => actions.clearThreads(boardId, id)} />}
      <ToolButton icon="front" label="Bring to front" onClick={() => actions.toFront(boardId, id)} />
      <ToolButton icon="duplicate" label="Duplicate" onClick={() => actions.duplicate(boardId, id)} />
      <ToolButton icon="trash" label="Delete" danger onClick={() => actions.remove(boardId, id)} />
      <span className="tb-sep" />
      <ToolButton
        icon="more"
        label="More"
        onClick={() => {
          const r = document.querySelector('.toolbar')!.getBoundingClientRect()
          useEditor.getState().openContextMenu(r.right - 8, r.bottom + 6, { kind: 'element', id })
        }}
      />
    </div>
  )
}

export function ThreadToolbar({ board, threadId, vp }: { board: Board; threadId: string; vp: Viewport }) {
  const t = board.threads.find((x) => x.id === threadId)
  const a = t && board.elements.find((e) => e.id === t.from)
  const b = t && board.elements.find((e) => e.id === t.to)
  if (!t || !a || !b) return null
  const mid = worldToScreen(threadMidpoint(anchorPosition(a, t.fromMarker), anchorPosition(b, t.toMarker)), vp)

  return (
    <div className="toolbar toolbar--thread" style={{ left: mid.x, top: mid.y - 22 }} onPointerDown={(e) => e.stopPropagation()}>
      <button className="tb-btn tb-btn--danger tb-btn--label" onClick={() => actions.cutThread(board.id, threadId)}>
        <Icon name="scissors" /> Cut thread
      </button>
    </div>
  )
}
