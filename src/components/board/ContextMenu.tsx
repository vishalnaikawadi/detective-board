import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBoards } from '../../store/boards'
import { useEditor } from '../../store/editor'
import { Icon } from '../ui/Icons'
import { actions } from './actions'

interface Item {
  icon: string
  label: string
  shortcut?: string
  danger?: boolean
  run: () => void
}

interface Props {
  boardId: string
  onFit: () => void
  onResetZoom: () => void
  onExport: (scope: 'board' | 'view') => void
}

export function ContextMenu({ boardId, onFit, onResetZoom, onExport }: Props) {
  const menu = useEditor((s) => s.contextMenu)
  const close = useEditor((s) => s.closeContextMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(menu.x, window.innerWidth - r.width - 8), y: Math.min(menu.y, window.innerHeight - r.height - 8) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [menu, close])

  if (!menu) return null
  const items: (Item | 'sep')[] = []
  const t = menu.target

  if (t.kind === 'element') {
    const el = useBoards.getState().boards[boardId]?.elements.find((e) => e.id === t.id)
    if (!el) return null
    if (el.type === 'article' && el.status !== 'empty') {
      items.push({ icon: 'open', label: 'Open article', run: () => actions.open(boardId, el.id) })
      items.push({ icon: 'edit', label: 'Edit text', run: () => actions.edit(el.id) })
      items.push({ icon: 'link', label: 'Change link', run: () => actions.changeLink(boardId, el.id) })
      items.push('sep')
    }
    if (el.type === 'photo') {
      if (el.imageId || el.imageUrl) items.push({ icon: 'image', label: 'Replace photo', run: () => actions.clearPhoto(boardId, el.id) })
      items.push({ icon: 'edit', label: 'Edit caption', run: () => actions.edit(el.id) })
      items.push('sep')
    }
    if (el.type === 'map' && el.status === 'ready') {
      items.push({ icon: 'edit', label: 'Edit map', shortcut: 'Enter', run: () => actions.edit(el.id) })
      items.push({ icon: 'search', label: 'Search another place', run: () => actions.relocate(boardId, el.id) }, 'sep')
    }
    if (el.type === 'folder') {
      items.push({ icon: 'upload', label: 'Add documents', run: () => actions.pickDocs(el.id) })
      items.push({ icon: 'edit', label: 'Name the file', shortcut: 'Enter', run: () => actions.edit(el.id) }, 'sep')
    }
    if (el.type === 'sticky' || el.type === 'note') {
      items.push({ icon: 'edit', label: 'Write', shortcut: 'Enter', run: () => actions.edit(el.id) }, 'sep')
    }
    items.push({ icon: 'thread', label: 'Connect with thread', shortcut: 'T', run: () => actions.connectFrom(el.id) })
    if (actions.hasThreads(boardId, el.id)) items.push({ icon: 'unlink', label: 'Remove threads', run: () => actions.clearThreads(boardId, el.id) })
    items.push(
      'sep',
      { icon: 'front', label: 'Bring to front', shortcut: ']', run: () => actions.toFront(boardId, el.id) },
      { icon: 'back', label: 'Send to back', shortcut: '[', run: () => actions.toBack(boardId, el.id) },
      { icon: 'duplicate', label: 'Duplicate', shortcut: '⌘D', run: () => actions.duplicate(boardId, el.id) },
      'sep',
      { icon: 'trash', label: 'Delete', shortcut: '⌫', danger: true, run: () => actions.remove(boardId, el.id) },
    )
  } else if (t.kind === 'thread') {
    items.push({ icon: 'scissors', label: 'Cut thread', shortcut: '⌫', danger: true, run: () => actions.cutThread(boardId, t.id) })
  } else {
    items.push(
      { icon: 'fit', label: 'Zoom to fit', shortcut: '⇧1', run: onFit },
      { icon: 'search', label: 'Zoom to 100%', shortcut: '⌘0', run: onResetZoom },
      { icon: 'thread', label: 'Thread mode', shortcut: 'T', run: () => useEditor.getState().startThread() },
      'sep',
      { icon: 'download', label: 'Export board as PNG', shortcut: '⇧⌘E', run: () => onExport('board') },
    )
  }

  return (
    <div
      ref={ref}
      className="menu"
      role="menu"
      style={{ left: pos.x || menu.x, top: pos.y || menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="menu__sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`menu__item${it.danger ? ' menu__item--danger' : ''}`}
            onClick={() => {
              close()
              it.run()
            }}
          >
            <Icon name={it.icon} />
            <span className="menu__label">{it.label}</span>
            {it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  )
}
