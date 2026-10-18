import { create } from 'zustand'
import { db } from '../lib/db'
import { uid } from '../lib/id'
import { sameEndpoint, threadEnds } from '../lib/geometry'
import type { Board, BoardElement, Endpoint, MapMarker, Thread, Viewport } from '../types'

export interface Snapshot {
  elements: BoardElement[]
  threads: Thread[]
}

interface History {
  past: Snapshot[]
  future: Snapshot[]
}

const HISTORY_LIMIT = 100

interface BoardsState {
  loaded: boolean
  boards: Record<string, Board>
  history: Record<string, History>

  load: () => Promise<void>
  createBoard: () => string
  renameBoard: (id: string, name: string) => void
  deleteBoard: (id: string) => void
  setViewport: (id: string, viewport: Viewport) => void

  /** Apply a change to a board's contents. `record: false` skips undo history (for live drags). */
  update: (id: string, recipe: (s: Snapshot) => Snapshot, record?: boolean) => void
  snapshot: (id: string) => Snapshot | null
  /** Push a snapshot taken before a gesture, once that gesture finishes. */
  pushHistory: (id: string, before: Snapshot) => void
  undo: (id: string) => void
  redo: (id: string) => void
}

const emptyHistory = (): History => ({ past: [], future: [] })

export const useBoards = create<BoardsState>()((set, get) => ({
  loaded: false,
  boards: {},
  history: {},

  async load() {
    let list: Board[] = []
    try {
      list = await db.allBoards()
    } catch (err) {
      // Don't leave the app stuck on the loading screen if storage is unavailable.
      console.error('Could not read boards from IndexedDB', err)
    }
    const boards: Record<string, Board> = {}
    for (const b of list) boards[b.id] = b
    set({ boards, loaded: true })
    collectOrphanImages(list)
  },

  createBoard() {
    const count = Object.keys(get().boards).length + 1
    const now = Date.now()
    const board: Board = {
      id: uid('board'),
      name: `Untitled case #${String(count).padStart(3, '0')}`,
      createdAt: now,
      updatedAt: now,
      viewport: { x: window.innerWidth / 2, y: window.innerHeight / 2 - 40, zoom: 1 },
      elements: [],
      threads: [],
    }
    set((s) => ({ boards: { ...s.boards, [board.id]: board } }))
    return board.id
  },

  renameBoard(id, name) {
    const board = get().boards[id]
    if (!board) return
    const clean = name.trim() || board.name
    set((s) => ({ boards: { ...s.boards, [id]: { ...board, name: clean, updatedAt: Date.now() } } }))
  },

  deleteBoard(id) {
    const board = get().boards[id]
    if (!board) return
    set((s) => {
      const boards = { ...s.boards }
      const history = { ...s.history }
      delete boards[id]
      delete history[id]
      return { boards, history }
    })
    db.deleteBoard(id)
    for (const key of blobKeys(board)) db.deleteImage(key)
  },

  setViewport(id, viewport) {
    const board = get().boards[id]
    if (!board) return
    set((s) => ({ boards: { ...s.boards, [id]: { ...board, viewport } } }))
  },

  update(id, recipe, record = true) {
    const board = get().boards[id]
    if (!board) return
    const before: Snapshot = { elements: board.elements, threads: board.threads }
    const after = recipe(before)
    if (after.elements === before.elements && after.threads === before.threads) return
    set((s) => {
      const next = { ...s, boards: { ...s.boards, [id]: { ...board, ...after, updatedAt: Date.now() } } }
      if (record) next.history = { ...s.history, [id]: pushed(s.history[id], before) }
      return next
    })
  },

  snapshot(id) {
    const b = get().boards[id]
    return b ? { elements: b.elements, threads: b.threads } : null
  },

  pushHistory(id, before) {
    const b = get().boards[id]
    if (!b || (b.elements === before.elements && b.threads === before.threads)) return
    set((s) => ({ history: { ...s.history, [id]: pushed(s.history[id], before) } }))
  },

  undo(id) {
    const { boards, history } = get()
    const h = history[id]
    const board = boards[id]
    if (!h?.past.length || !board) return
    const prev = h.past[h.past.length - 1]
    set({
      boards: { ...boards, [id]: { ...board, ...prev, updatedAt: Date.now() } },
      history: {
        ...history,
        [id]: { past: h.past.slice(0, -1), future: [{ elements: board.elements, threads: board.threads }, ...h.future] },
      },
    })
  },

  redo(id) {
    const { boards, history } = get()
    const h = history[id]
    const board = boards[id]
    if (!h?.future.length || !board) return
    const [next, ...rest] = h.future
    set({
      boards: { ...boards, [id]: { ...board, ...next, updatedAt: Date.now() } },
      history: {
        ...history,
        [id]: { past: [...h.past, { elements: board.elements, threads: board.threads }], future: rest },
      },
    })
  },
}))

function pushed(h: History | undefined, snap: Snapshot): History {
  const past = [...(h ?? emptyHistory()).past, snap]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}

/** Every stored blob (uploaded photo or folder document) a board refers to. */
function blobKeys(board: Board): string[] {
  return board.elements.flatMap((el) =>
    el.type === 'photo' && el.imageId ? [el.imageId] : el.type === 'folder' ? el.docs.map((d) => d.id) : [],
  )
}

/** Remove stored blobs no board references anymore (e.g. deleted photos or documents). */
async function collectOrphanImages(boards: Board[]) {
  const used = new Set(boards.flatMap(blobKeys))
  const keys = await db.imageKeys()
  for (const k of keys) if (typeof k === 'string' && !used.has(k)) db.deleteImage(k)
}

// Persist changed boards to IndexedDB, debounced per board.
const timers = new Map<string, number>()
useBoards.subscribe((state, prev) => {
  if (!state.loaded || !prev.loaded) return
  for (const id in state.boards) {
    const board = state.boards[id]
    if (board === prev.boards[id]) continue
    clearTimeout(timers.get(id))
    timers.set(
      id,
      window.setTimeout(() => {
        timers.delete(id)
        const latest = useBoards.getState().boards[id]
        if (latest) db.putBoard(latest)
      }, 350),
    )
  }
})

window.addEventListener('beforeunload', () => {
  const { boards } = useBoards.getState()
  for (const id of timers.keys()) if (boards[id]) db.putBoard(boards[id])
})

// ---- Content helpers -------------------------------------------------------

export const ops = {
  add: (el: BoardElement) => (s: Snapshot): Snapshot => ({ ...s, elements: [...s.elements, el] }),

  patch: (id: string, patch: Partial<BoardElement>) => (s: Snapshot): Snapshot => ({
    ...s,
    elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as BoardElement) : e)),
  }),

  remove: (id: string) => (s: Snapshot): Snapshot => ({
    elements: s.elements.filter((e) => e.id !== id),
    threads: s.threads.filter((t) => t.from !== id && t.to !== id),
  }),

  toFront: (id: string) => (s: Snapshot): Snapshot => {
    const top = Math.max(0, ...s.elements.map((e) => e.z))
    return ops.patch(id, { z: top + 1 })(s)
  },

  toBack: (id: string) => (s: Snapshot): Snapshot => {
    const bottom = Math.min(0, ...s.elements.map((e) => e.z))
    return ops.patch(id, { z: bottom - 1 })(s)
  },

  connect: (from: Endpoint, to: Endpoint) => (s: Snapshot): Snapshot => {
    if (sameEndpoint(from, to)) return s
    const exists = s.threads.some((t) => {
      const [a, b] = threadEnds(t)
      return (sameEndpoint(a, from) && sameEndpoint(b, to)) || (sameEndpoint(a, to) && sameEndpoint(b, from))
    })
    if (exists) return s
    const thread: Thread = { id: uid('thread'), from: from.el, to: to.el }
    if (from.marker) thread.fromMarker = from.marker
    if (to.marker) thread.toMarker = to.marker
    return { ...s, threads: [...s.threads, thread] }
  },

  /** Replace a map's markers, cutting any thread tied to a marker that's gone. */
  setMarkers: (id: string, markers: MapMarker[]) => (s: Snapshot): Snapshot => {
    const keep = new Set(markers.map((m) => m.id))
    const gone = (el: string, marker?: string) => el === id && !!marker && !keep.has(marker)
    return {
      elements: s.elements.map((e) => (e.id === id && e.type === 'map' ? { ...e, markers } : e)),
      threads: s.threads.filter((t) => !gone(t.from, t.fromMarker) && !gone(t.to, t.toMarker)),
    }
  },

  disconnect: (threadId: string) => (s: Snapshot): Snapshot => ({
    ...s,
    threads: s.threads.filter((t) => t.id !== threadId),
  }),

  clearThreads: (elementId: string) => (s: Snapshot): Snapshot => ({
    ...s,
    threads: s.threads.filter((t) => t.from !== elementId && t.to !== elementId),
  }),
}

export function nextZ(elements: BoardElement[]) {
  return Math.max(0, ...elements.map((e) => e.z)) + 1
}
