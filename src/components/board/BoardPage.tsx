import { useCallback, useEffect, useRef, useState } from 'react'
import { getVariant } from '../../lib/catalog'
import { makeElement } from '../../lib/elements'
import { clamp, fitViewport, MAX_ZOOM, MIN_ZOOM, screenToWorld } from '../../lib/geometry'
import { isImageFile, storeImage } from '../../lib/images'
import { normalizeUrl } from '../../lib/linkPreview'
import { navigate } from '../../lib/router'
import { nextZ, ops, useBoards } from '../../store/boards'
import { useEditor } from '../../store/editor'
import type { BoardElement, ElementType, Point, Viewport } from '../../types'
import { actions } from './actions'
import { Canvas } from './Canvas'
import { ContextMenu } from './ContextMenu'
import { exportBoardPng } from './exportBoard'
import { Dock } from './Dock'
import { loadArticle } from './elements/Article'
import { PinDefs } from './PushPin'
import { TopBar } from './TopBar'
import { ZoomControls } from './ZoomControls'

export function BoardPage({ id }: { id: string }) {
  const board = useBoards((s) => s.boards[id])
  const loaded = useBoards((s) => s.loaded)

  if (loaded && !board) {
    return (
      <div className="missing">
        <div className="missing__card">
          <div className="kicker">// File not found</div>
          <h1>This case has gone cold.</h1>
          <p>The board you’re looking for doesn’t exist in this browser.</p>
          <button className="btn btn--primary" onClick={() => navigate({ name: 'home' })}>Back to case files</button>
        </div>
      </div>
    )
  }
  if (!board) return null
  return <BoardEditor key={id} id={id} />
}

function BoardEditor({ id }: { id: string }) {
  const board = useBoards((s) => s.boards[id])
  const containerRef = useRef<HTMLDivElement>(null)
  const [vp, setVpState] = useState<Viewport>(board.viewport)
  const vpRef = useRef(vp)
  vpRef.current = vp
  const [hint, setHint] = useState<string | null>(null)
  const { mode, threadFrom, dockDrag } = useEditor()
  const [exporting, setExporting] = useState(false)
  const [isNew] = useState(() => board.elements.length === 0 && Date.now() - board.createdAt < 5000)

  const setVp = useCallback((fn: (v: Viewport) => Viewport) => setVpState((v) => fn(v)), [])

  // Persist the viewport shortly after the user stops panning/zooming.
  useEffect(() => {
    const t = setTimeout(() => useBoards.getState().setViewport(id, vp), 400)
    return () => clearTimeout(t)
  }, [id, vp])

  useEffect(() => useEditor.getState().setZoom(vp.zoom), [vp.zoom])

  useEffect(() => {
    useEditor.getState().reset()
    return () => useEditor.getState().reset()
  }, [id])

  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), 2200)
    return () => clearTimeout(t)
  }, [hint])

  const size = () => {
    const r = containerRef.current?.getBoundingClientRect()
    return { w: r?.width ?? window.innerWidth, h: r?.height ?? window.innerHeight }
  }

  const zoomBy = useCallback((factor: number) => {
    const { w, h } = size()
    const p = { x: w / 2, y: h / 2 }
    setVp((v) => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      return { zoom, x: p.x - ((p.x - v.x) * zoom) / v.zoom, y: p.y - ((p.y - v.y) * zoom) / v.zoom }
    })
  }, [setVp])

  const resetZoom = useCallback(() => zoomBy(1 / vpRef.current.zoom), [zoomBy])

  const fit = useCallback(() => {
    const { w, h } = size()
    const els = useBoards.getState().boards[id]?.elements ?? []
    if (!els.length) return setVp(() => ({ x: w / 2, y: h / 2, zoom: 1 }))
    // Leave room for the top bar and dock.
    const v = fitViewport(els, w, h - 170, 90, 1.5)
    setVp(() => ({ ...v, y: v.y + 60 }))
  }, [id, setVp])

  const exportPng = useCallback(
    async (scope: 'board' | 'view') => {
      const current = useBoards.getState().boards[id]
      if (!current || exporting) return
      if (scope === 'board' && !current.elements.length) return setHint('Nothing to export yet — add some evidence first')
      const { w, h } = size()
      const a = screenToWorld({ x: 0, y: 0 }, vpRef.current)
      const b = screenToWorld({ x: w, y: h }, vpRef.current)
      setExporting(true)
      setHint('Developing the photos…')
      try {
        const res = await exportBoardPng(current, scope === 'view' ? { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y } : undefined)
        setHint(
          res.missingImages
            ? `Exported — ${res.missingImages} remote image${res.missingImages > 1 ? 's' : ''} couldn’t be included`
            : 'Exported board as PNG',
        )
      } catch (err) {
        setHint(err instanceof Error ? err.message : 'Export failed')
      } finally {
        setExporting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, exporting],
  )

  const centerWorld = (): Point => {
    const { w, h } = size()
    return screenToWorld({ x: w / 2, y: h / 2 - 30 }, vpRef.current)
  }

  const place = (el: BoardElement, edit = false) => {
    useBoards.getState().update(id, ops.add(el))
    useEditor.getState().select(el.id)
    if (edit) useEditor.getState().setEditing(el.id)
  }

  const handleDockDrop = (type: ElementType, variant: string, clientX: number, clientY: number) => {
    const r = containerRef.current?.getBoundingClientRect()
    if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false
    const at = screenToWorld({ x: clientX - r.left, y: clientY - r.top }, vpRef.current)
    const el = makeElement(type, variant, at, nextZ(useBoards.getState().boards[id].elements))
    useEditor.getState().exitThreadMode()
    place(el, type === 'sticky' || type === 'note')
    return true
  }

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.('input, textarea, [contenteditable]')) return
      const ed = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const sel = ed.selectedId

      if (key === 'escape') {
        if (ed.contextMenu) return ed.closeContextMenu()
        if (ed.mode === 'thread') return ed.exitThreadMode()
        return ed.select(null)
      }
      if (mod && key === 'z') {
        e.preventDefault()
        return e.shiftKey ? useBoards.getState().redo(id) : useBoards.getState().undo(id)
      }
      if (mod && key === 'y') {
        e.preventDefault()
        return useBoards.getState().redo(id)
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        return zoomBy(1.25)
      }
      if (mod && key === '-') {
        e.preventDefault()
        return zoomBy(1 / 1.25)
      }
      if (mod && key === '0') {
        e.preventDefault()
        return resetZoom()
      }
      if (mod && e.shiftKey && key === 'e') {
        e.preventDefault()
        return exportPng('board')
      }
      if (e.shiftKey && e.code === 'Digit1') return fit()
      if (!mod && key === 't') {
        if (ed.mode === 'thread') return ed.exitThreadMode()
        return sel ? actions.connectFrom(sel) : ed.startThread()
      }

      if (ed.selectedThreadId && (key === 'backspace' || key === 'delete')) return actions.cutThread(id, ed.selectedThreadId)
      if (!sel) return
      if (key === 'backspace' || key === 'delete') {
        e.preventDefault()
        return actions.remove(id, sel)
      }
      if (mod && key === 'd') {
        e.preventDefault()
        return actions.duplicate(id, sel)
      }
      if (key === 'enter') {
        e.preventDefault()
        return actions.edit(sel)
      }
      if (key === ']') return actions.toFront(id, sel)
      if (key === '[') return actions.toBack(id, sel)
      const nudge = ({ arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] } as Record<string, [number, number]>)[key]
      if (nudge) {
        e.preventDefault()
        const el = useBoards.getState().boards[id]?.elements.find((x) => x.id === sel)
        const step = e.shiftKey ? 10 : 1
        if (el) useBoards.getState().update(id, ops.patch(sel, { x: el.x + nudge[0] * step, y: el.y + nudge[1] * step }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, zoomBy, resetZoom, fit, exportPng])

  // Paste an image to pin it as a photo, or a link to clip it as an article.
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return
      const file = [...(e.clipboardData?.files ?? [])].find(isImageFile)
      const z = () => nextZ(useBoards.getState().boards[id].elements)
      const variants = useEditor.getState().variantChoice
      if (file) {
        e.preventDefault()
        const imageId = await storeImage(file)
        return place({ ...makeElement('photo', variants.photo, centerWorld(), z()), imageId } as BoardElement)
      }
      const url = normalizeUrl(e.clipboardData?.getData('text') ?? '')
      if (url && /^https?:\/\//i.test(e.clipboardData?.getData('text').trim() ?? '')) {
        e.preventDefault()
        const el = makeElement('article', variants.article, centerWorld(), z())
        place(el)
        loadArticle(id, el.id, url)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const ghost = dockDrag && getVariant(dockDrag.type, dockDrag.variant)

  return (
    <div className="board-page">
      <PinDefs />
      <Canvas board={board} vp={vp} setVp={setVp} containerRef={containerRef} />
      <div className="hud-frame" aria-hidden>
        <span className="hud-frame__c hud-frame__c--tl" />
        <span className="hud-frame__c hud-frame__c--tr" />
        <span className="hud-frame__c hud-frame__c--bl" />
        <span className="hud-frame__c hud-frame__c--br" />
      </div>
      <TopBar board={board} autoFocusTitle={isNew} exporting={exporting} onExport={exportPng} />

      {mode === 'thread' && (
        <div className="banner" role="status">
          <span className="banner__dot" />
          {threadFrom ? 'Click another clue to tie the thread — keep clicking to chain.' : 'Thread mode — click a clue to start a thread.'}
          <button className="banner__done" onClick={() => useEditor.getState().exitThreadMode()}>
            Done <kbd>Esc</kbd>
          </button>
        </div>
      )}

      {board.elements.length === 0 && !dockDrag && (
        <div className="empty-hint">
          <div className="empty-hint__kicker">// New case opened</div>
          <div className="empty-hint__title">Drag evidence from the dock to start building your case.</div>
          <div className="empty-hint__sub">Scroll to pan · ⌘ + scroll or pinch to zoom · drop or paste images and links</div>
        </div>
      )}

      <ZoomControls vp={vp} onZoom={zoomBy} onReset={resetZoom} onFit={fit} />
      <Dock onDrop={handleDockDrop} onHint={setHint} />
      {hint && <div className="toast">{hint}</div>}
      <ContextMenu boardId={id} onFit={fit} onResetZoom={resetZoom} onExport={exportPng} />

      {ghost && dockDrag && (
        <img
          className="drag-ghost"
          src={ghost.src}
          alt=""
          style={{
            left: dockDrag.x,
            top: dockDrag.y,
            width: ghost.width * vp.zoom,
            height: (ghost.width * vp.zoom * ghost.natural.h) / ghost.natural.w,
          }}
        />
      )}
    </div>
  )
}
