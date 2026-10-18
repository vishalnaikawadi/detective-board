import { create } from 'zustand'
import { TOOLS } from '../lib/catalog'
import type { ElementType, Endpoint, Point } from '../types'

export type ContextTarget =
  | { kind: 'element'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'canvas'; world: Point }

export interface DockDrag {
  type: ElementType
  variant: string
  x: number
  y: number
}

interface EditorState {
  selectedId: string | null
  selectedThreadId: string | null
  editingId: string | null
  /** 'thread' mode: clicking elements chains red thread between them. */
  mode: 'select' | 'thread'
  threadFrom: Endpoint | null
  contextMenu: { x: number; y: number; target: ContextTarget } | null
  dockDrag: DockDrag | null
  variantChoice: Record<ElementType, string>
  /** Current board zoom, for screen ↔ element conversions inside elements. */
  zoom: number
  /** Folder whose file picker should open (set by toolbar / menu commands). */
  filePickFor: string | null
  /** Short status message shown above the dock. */
  toast: string | null

  select: (id: string | null) => void
  selectThread: (id: string | null) => void
  setEditing: (id: string | null) => void
  startThread: (from?: Endpoint | null) => void
  setThreadFrom: (from: Endpoint | null) => void
  exitThreadMode: () => void
  openContextMenu: (x: number, y: number, target: ContextTarget) => void
  closeContextMenu: () => void
  setDockDrag: (d: DockDrag | null) => void
  chooseVariant: (type: ElementType, variant: string) => void
  setZoom: (zoom: number) => void
  requestFilePick: (id: string | null) => void
  showToast: (message: string | null) => void
  reset: () => void
}

const VARIANT_KEY = 'detective-board:variants'

function loadVariantChoice(): Record<ElementType, string> {
  const defaults = Object.fromEntries(TOOLS.map((t) => [t.type, t.variants[0].id])) as Record<ElementType, string>
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(VARIANT_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

export const useEditor = create<EditorState>()((set, get) => ({
  selectedId: null,
  selectedThreadId: null,
  editingId: null,
  mode: 'select',
  threadFrom: null,
  contextMenu: null,
  dockDrag: null,
  variantChoice: loadVariantChoice(),
  zoom: 1,
  filePickFor: null,
  toast: null,

  select: (id) => set({ selectedId: id, selectedThreadId: null, editingId: get().editingId === id ? id : null }),
  selectThread: (id) => set({ selectedThreadId: id, selectedId: null, editingId: null }),
  setEditing: (id) => set({ editingId: id }),
  startThread: (from = null) => set({ mode: 'thread', threadFrom: from, editingId: null, selectedThreadId: null }),
  setThreadFrom: (from) => set({ threadFrom: from }),
  exitThreadMode: () => set({ mode: 'select', threadFrom: null }),
  openContextMenu: (x, y, target) => set({ contextMenu: { x, y, target } }),
  closeContextMenu: () => set({ contextMenu: null }),
  setDockDrag: (d) => set({ dockDrag: d }),
  chooseVariant: (type, variant) => {
    const variantChoice = { ...get().variantChoice, [type]: variant }
    localStorage.setItem(VARIANT_KEY, JSON.stringify(variantChoice))
    set({ variantChoice })
  },
  setZoom: (zoom) => set({ zoom }),
  requestFilePick: (id) => set({ filePickFor: id }),
  showToast: (toast) => set({ toast }),
  reset: () =>
    set({ selectedId: null, selectedThreadId: null, editingId: null, mode: 'select', threadFrom: null, contextMenu: null, dockDrag: null }),
}))
