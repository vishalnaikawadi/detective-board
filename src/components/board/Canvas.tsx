import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type * as React from 'react'
import { makeElement } from '../../lib/elements'
import { clamp, MAX_ZOOM, MIN_ZOOM, parseEndpointKey, rotate, sameEndpoint, screenToWorld, worldToScreen } from '../../lib/geometry'
import { isHeic, isImageFile, storeImage } from '../../lib/images'
import { CORK_TILE, corkTexture } from '../../lib/texture'
import { nextZ, ops, useBoards, type Snapshot } from '../../store/boards'
import { useEditor } from '../../store/editor'
import type { Board, Endpoint, Point, Viewport } from '../../types'
import { actions, findElement } from './actions'
import { BoardContext } from './elements/shared'
import { Scene } from './Scene'
import { SelectionToolbar, ThreadToolbar } from './SelectionToolbar'

interface Props {
  board: Board
  vp: Viewport
  setVp: (fn: (v: Viewport) => Viewport) => void
  containerRef: RefObject<HTMLDivElement | null>
}

type Gesture =
  | { kind: 'pan'; start: Point; vp0: Viewport }
  | { kind: 'move'; id: string; start: Point; origin: Point; before: Snapshot; moved: boolean }
  | { kind: 'rotate'; id: string; center: Point; startAngle: number; rot0: number; before: Snapshot }
  | { kind: 'resize'; id: string; anchor: Point; aspect: number; rotation: number; before: Snapshot }
  | { kind: 'pin'; from: Endpoint }

const DRAG_THRESHOLD = 3

/** The thread endpoint under a DOM node: a pin, a marked spot on a map, or an element. */
function endpointAt(node: Element | null): Endpoint | null {
  const n = node as HTMLElement | null
  const pin = n?.closest?.('[data-pin-id]') as HTMLElement | null
  if (pin?.dataset.pinId) return parseEndpointKey(pin.dataset.pinId)
  const el = (n?.closest?.('[data-el-id]') as HTMLElement | null)?.dataset.elId
  if (!el) return null
  const marker = (n?.closest('[data-marker-id]') as HTMLElement | SVGElement | null)?.dataset.markerId
  return marker ? { el, marker } : { el }
}

export function Canvas({ board, vp, setVp, containerRef }: Props) {
  const boardId = board.id
  const { selectedId, selectedThreadId, editingId, mode, threadFrom } = useEditor()
  const [gestureKind, setGestureKind] = useState<Gesture['kind'] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const vpRef = useRef(vp)
  vpRef.current = vp

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const toWorld = (e: { clientX: number; clientY: number }) => screenToWorld(local(e), vpRef.current)

  // Wheel: pan, or zoom around the cursor with ⌘/Ctrl (trackpad pinch sends ctrlKey).
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('textarea, .scrollable')) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) {
        const p = local(e)
        const factor = Math.exp(-clamp(e.deltaY * unit, -40, 40) * 0.01)
        setVp((v) => {
          const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
          return { zoom, x: p.x - ((p.x - v.x) * zoom) / v.zoom, y: p.y - ((p.y - v.y) * zoom) / v.zoom }
        })
      } else {
        setVp((v) => ({ ...v, x: v.x - e.deltaX * unit, y: v.y - e.deltaY * unit }))
      }
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVp])

  // Hold space to pan with the left mouse button, like Figma.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement).closest?.('input, textarea, [contenteditable]')
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e)) {
        e.preventDefault()
        setSpaceDown(true)
      }
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const begin = (g: Gesture, e: React.PointerEvent) => {
    setGestureKind(g.kind)
    const { update, pushHistory } = useBoards.getState()

    const onMove = (ev: PointerEvent) => {
      const v = vpRef.current
      switch (g.kind) {
        case 'pan':
          setVp(() => ({ ...g.vp0, x: g.vp0.x + ev.clientX - g.start.x, y: g.vp0.y + ev.clientY - g.start.y }))
          break
        case 'move': {
          const dx = ev.clientX - g.start.x
          const dy = ev.clientY - g.start.y
          if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
          if (!g.moved) setDraggingId(g.id)
          g.moved = true
          update(boardId, ops.patch(g.id, { x: g.origin.x + dx / v.zoom, y: g.origin.y + dy / v.zoom }), false)
          break
        }
        case 'rotate': {
          const p = local(ev)
          const angle = (Math.atan2(p.y - g.center.y, p.x - g.center.x) * 180) / Math.PI
          let rotation = g.rot0 + angle - g.startAngle
          rotation = ((((rotation + 180) % 360) + 360) % 360) - 180
          if (ev.shiftKey) rotation = Math.round(rotation / 15) * 15
          update(boardId, ops.patch(g.id, { rotation: Math.round(rotation * 10) / 10 }), false)
          break
        }
        case 'resize': {
          const w = toWorld(ev)
          const l = rotate({ x: w.x - g.anchor.x, y: w.y - g.anchor.y }, -g.rotation)
          const width = clamp(Math.max(l.x, l.y / g.aspect), 90, 1800)
          const height = width * g.aspect
          const c = rotate({ x: width / 2, y: height / 2 }, g.rotation)
          update(boardId, ops.patch(g.id, { w: Math.round(width), h: Math.round(height), x: g.anchor.x + c.x, y: g.anchor.y + c.y }), false)
          break
        }
        case 'pin':
          setPointerWorld(toWorld(ev))
          break
      }
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setGestureKind(null)
      setDraggingId(null)
      if (g.kind === 'move' || g.kind === 'rotate' || g.kind === 'resize') pushHistory(boardId, g.before)
      if (g.kind === 'move' && !g.moved && ev.type === 'pointerup') {
        const el = findElement(boardId, g.id)
        // A plain click on a clipping opens the original article.
        if (el?.type === 'article' && el.url && el.status !== 'loading' && el.status !== 'empty') actions.open(boardId, el.id)
      }
      if (g.kind === 'pin') {
        const target = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .map(endpointAt)
          .find((end) => end && !sameEndpoint(end, g.from))
        if (target) update(boardId, ops.connect(g.from, target))
        useEditor.getState().exitThreadMode()
        setPointerWorld(null)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    e.preventDefault()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    const t = e.target as HTMLElement
    // Commit any in-progress text edit before acting on the board.
    const active = document.activeElement as HTMLElement | null
    if (active?.matches('textarea, input') && !active.contains(t)) active.blur()
    const editor = useEditor.getState()
    editor.closeContextMenu()
    const start = { x: e.clientX, y: e.clientY }
    const pan = () => begin({ kind: 'pan', start, vp0: vpRef.current }, e)

    if (e.button === 1 || spaceDown) return pan()

    const elId = (t.closest('[data-el-id]') as HTMLElement | null)?.dataset.elId
    const pinKey = (t.closest('[data-pin-id]') as HTMLElement | null)?.dataset.pinId
    const threadId = (t.closest('[data-thread-id]') as HTMLElement | null)?.dataset.threadId
    const handle = (t.closest('[data-handle]') as HTMLElement | null)?.dataset.handle

    // Clicking elements (or marked spots on maps) in thread mode chains red thread between them.
    if (editor.mode === 'thread') {
      const end = endpointAt(t)
      if (end) {
        e.preventDefault()
        if (editor.threadFrom && !sameEndpoint(editor.threadFrom, end)) useBoards.getState().update(boardId, ops.connect(editor.threadFrom, end))
        editor.setThreadFrom(end)
        setPointerWorld(toWorld(e))
        return
      }
      editor.setThreadFrom(null)
      return pan()
    }

    // Dragging from a pin pulls a new thread out of it.
    if (pinKey) {
      const from = parseEndpointKey(pinKey)
      editor.startThread(from)
      setPointerWorld(toWorld(e))
      return begin({ kind: 'pin', from }, e)
    }

    if (elId) {
      const el = findElement(boardId, elId)
      if (!el) return
      const before = useBoards.getState().snapshot(boardId)!
      if (editor.selectedId !== elId) editor.select(elId)
      if (handle === 'rotate') {
        const center = worldToScreen(el, vpRef.current)
        const p = local(e)
        return begin({ kind: 'rotate', id: el.id, center, startAngle: (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI, rot0: el.rotation, before }, e)
      }
      if (handle === 'resize') {
        const off = rotate({ x: -el.w / 2, y: -el.h / 2 }, el.rotation)
        return begin({ kind: 'resize', id: el.id, anchor: { x: el.x + off.x, y: el.y + off.y }, aspect: el.h / el.w, rotation: el.rotation, before }, e)
      }
      if (editor.editingId === elId) return
      return begin({ kind: 'move', id: el.id, start, origin: { x: el.x, y: el.y }, before, moved: false }, e)
    }

    if (threadId) return editor.selectThread(threadId)

    editor.select(null)
    pan()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== 'thread') return
    setHoverId(endpointAt(e.target as Element)?.el ?? null)
    if (threadFrom) setPointerWorld(toWorld(e))
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (mode === 'thread') return
    const id = ((e.target as HTMLElement).closest('[data-el-id]') as HTMLElement | null)?.dataset.elId
    const el = id ? findElement(boardId, id) : undefined
    if (el && el.type !== 'article') actions.edit(el.id)
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const t = e.target as HTMLElement
    if (t.closest('textarea, input')) return
    const editor = useEditor.getState()
    const elId = (t.closest('[data-el-id]') as HTMLElement | null)?.dataset.elId
    const threadId = (t.closest('[data-thread-id]') as HTMLElement | null)?.dataset.threadId
    if (elId) {
      editor.select(elId)
      editor.openContextMenu(e.clientX, e.clientY, { kind: 'element', id: elId })
    } else if (threadId) {
      editor.selectThread(threadId)
      editor.openContextMenu(e.clientX, e.clientY, { kind: 'thread', id: threadId })
    } else {
      editor.openContextMenu(e.clientX, e.clientY, { kind: 'canvas', world: toWorld(e) })
    }
  }

  // Desktop files: dropped on a folder they're filed inside it; elsewhere,
  // images become photos and documents go into a new case folder.
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const folderAt = (x: number, y: number) => {
    const id = endpointAt(document.elementFromPoint(x, y))?.el
    return id && findElement(boardId, id)?.type === 'folder' ? id : null
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    const id = folderAt(e.clientX, e.clientY)
    if (id !== dropTarget) setDropTarget(id)
  }

  const onDrop = async (e: React.DragEvent) => {
    const files = [...e.dataTransfer.files]
    setDropTarget(null)
    if (!files.length) return
    e.preventDefault()
    const folderId = folderAt(e.clientX, e.clientY)
    if (folderId) {
      useEditor.getState().select(folderId)
      return actions.addDocs(boardId, folderId, files)
    }
    const at = toWorld(e)
    const variants = useEditor.getState().variantChoice
    const z = () => nextZ(useBoards.getState().boards[boardId].elements)
    const images = files.filter(isImageFile)
    const docs = files.filter((f) => !isImageFile(f))
    if (images.some(isHeic)) useEditor.getState().showToast('Developing iPhone photos…')
    let failed = 0
    for (const [i, file] of images.entries()) {
      try {
        const imageId = await storeImage(file)
        const el = { ...makeElement('photo', variants.photo, { x: at.x + i * 40, y: at.y + i * 40 }, z()), imageId }
        useBoards.getState().update(boardId, ops.add(el))
        useEditor.getState().select(el.id)
      } catch {
        failed++
      }
    }
    if (failed) useEditor.getState().showToast(`${failed} photo${failed > 1 ? 's' : ''} couldn’t be read`)
    else if (images.some(isHeic)) useEditor.getState().showToast(null)
    if (docs.length) {
      const offset = images.length ? 300 : 0
      const folder = makeElement('folder', variants.folder, { x: at.x + offset, y: at.y }, z())
      useBoards.getState().update(boardId, ops.add(folder))
      useEditor.getState().select(folder.id)
      await actions.addDocs(boardId, folder.id, docs)
    }
  }

  const cursor = gestureKind === 'pan' ? 'grabbing' : spaceDown ? 'grab' : mode === 'thread' ? 'crosshair' : 'default'
  const tile = CORK_TILE * vp.zoom

  return (
    <BoardContext.Provider value={boardId}>
      <div
        ref={containerRef}
        className={`canvas${mode === 'thread' ? ' canvas--thread' : ''}${gestureKind ? ' is-gesturing' : ''}`}
        style={{
          cursor,
          backgroundImage: `url(${corkTexture()})`,
          backgroundSize: `${tile}px ${tile}px`,
          backgroundPosition: `${vp.x}px ${vp.y}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverId(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropTarget(null)}
        onDrop={onDrop}
      >
        <div className="canvas__light" />
        <div
          className="world"
          style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`, '--zoom': vp.zoom } as CSSProperties}
        >
          <Scene
            board={board}
            interactive
            selectedId={mode === 'thread' ? null : selectedId}
            selectedThreadId={selectedThreadId}
            editingId={editingId}
            draggingId={draggingId}
            targetIds={mode === 'thread' ? [threadFrom?.el ?? null, hoverId] : [dropTarget]}
            pendingFrom={mode === 'thread' ? threadFrom : null}
            pendingTo={mode === 'thread' ? pointerWorld : null}
          />
        </div>
        {mode === 'select' && selectedId && !draggingId && gestureKind !== 'rotate' && gestureKind !== 'resize' && (
          <SelectionToolbar boardId={boardId} id={selectedId} vp={vp} />
        )}
        {selectedThreadId && <ThreadToolbar board={board} threadId={selectedThreadId} vp={vp} />}
      </div>
    </BoardContext.Provider>
  )
}
