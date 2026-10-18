export type ElementType = 'photo' | 'sticky' | 'note' | 'article' | 'map' | 'folder'

interface BaseElement {
  id: string
  type: ElementType
  variant: string
  /** Center of the element in world coordinates. */
  x: number
  y: number
  w: number
  h: number
  /** Degrees, clockwise. */
  rotation: number
  z: number
}

export interface PhotoElement extends BaseElement {
  type: 'photo'
  /** Key of an uploaded image blob in IndexedDB. */
  imageId?: string
  /** Remote image URL (used when no uploaded blob). */
  imageUrl?: string
  caption: string
}

export interface StickyElement extends BaseElement {
  type: 'sticky'
  text: string
}

export interface NoteElement extends BaseElement {
  type: 'note'
  text: string
}

export type ArticleStatus = 'empty' | 'loading' | 'ready' | 'error'

export interface ArticleElement extends BaseElement {
  type: 'article'
  url: string
  status: ArticleStatus
  title: string
  excerpt: string
  publisher?: string
  date?: string
  image?: string
}

export interface MapMarker {
  id: string
  lat: number
  lon: number
}

export interface MapElement extends BaseElement {
  type: 'map'
  status: 'empty' | 'ready'
  /** Map center and integer tile zoom. */
  lat: number
  lon: number
  zoom: number
  label: string
  markers: MapMarker[]
}

export interface FolderDoc {
  /** Key of the file blob in IndexedDB. */
  id: string
  name: string
  size: number
  mime: string
  addedAt: number
}

export interface FolderElement extends BaseElement {
  type: 'folder'
  label: string
  docs: FolderDoc[]
}

export type BoardElement = PhotoElement | StickyElement | NoteElement | ArticleElement | MapElement | FolderElement

export interface Thread {
  id: string
  from: string
  to: string
  /** Set when that end is tied to a marked location on a map. */
  fromMarker?: string
  toMarker?: string
}

/** One end of a red thread: an element, optionally a marker on a map element. */
export interface Endpoint {
  el: string
  marker?: string
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface Board {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  viewport: Viewport
  elements: BoardElement[]
  threads: Thread[]
}

export interface Point {
  x: number
  y: number
}
