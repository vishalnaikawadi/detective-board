import { getVariant } from './catalog'
import { MAP_W, project } from './map'
import type { BoardElement, Endpoint, Point, Thread, Viewport } from '../types'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function rotate(p: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export function screenToWorld(p: Point, vp: Viewport): Point {
  return { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom }
}

export function worldToScreen(p: Point, vp: Viewport): Point {
  return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y }
}

/** World position of an element's push-pin. */
export function pinPosition(el: BoardElement): Point {
  const [fx, fy] = getVariant(el.type, el.variant).pin
  const off = rotate({ x: (fx - 0.5) * el.w, y: (fy - 0.5) * el.h }, el.rotation)
  return { x: el.x + off.x, y: el.y + off.y }
}

/** Edge inset (map px) so pins for off-screen markers stay on the printed map. */
const MAP_EDGE = 10

/**
 * World position where a thread end is pinned: the element's pin spot, or the
 * marked location on a map (clamped to the map's edge if it's panned out of view).
 */
export function anchorPosition(el: BoardElement, marker?: string): Point {
  const m = marker && el.type === 'map' ? el.markers.find((x) => x.id === marker) : undefined
  if (!m || el.type !== 'map') return pinPosition(el)
  const area = getVariant('map', el.variant).area!
  const scale = (el.w * area.width) / 100 / MAP_W
  const mapH = (el.h * area.height) / 100 / scale
  const c = project(el.lat, el.lon, el.zoom)
  const p = project(m.lat, m.lon, el.zoom)
  const ox = clamp(p.x - c.x, -MAP_W / 2 + MAP_EDGE, MAP_W / 2 - MAP_EDGE)
  const oy = clamp(p.y - c.y, -mapH / 2 + MAP_EDGE, mapH / 2 - MAP_EDGE)
  const local = {
    x: ((area.left + area.width / 2) / 100 - 0.5) * el.w + ox * scale,
    y: ((area.top + area.height / 2) / 100 - 0.5) * el.h + oy * scale,
  }
  const off = rotate(local, el.rotation)
  return { x: el.x + off.x, y: el.y + off.y }
}

export const threadEnds = (t: Thread): [Endpoint, Endpoint] => [
  { el: t.from, marker: t.fromMarker },
  { el: t.to, marker: t.toMarker },
]

export const endpointKey = (e: Endpoint) => (e.marker ? `${e.el}|${e.marker}` : e.el)

export function parseEndpointKey(key: string): Endpoint {
  const [el, marker] = key.split('|')
  return marker ? { el, marker } : { el }
}

export const sameEndpoint = (a: Endpoint, b: Endpoint) => a.el === b.el && (a.marker ?? '') === (b.marker ?? '')

/** Axis-aligned bounds of a rotated element. */
export function elementBounds(el: BoardElement) {
  const r = (el.rotation * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const hw = (el.w * c + el.h * s) / 2
  const hh = (el.w * s + el.h * c) / 2
  return { minX: el.x - hw, minY: el.y - hh, maxX: el.x + hw, maxY: el.y + hh }
}

export function contentBounds(elements: BoardElement[]) {
  if (!elements.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of elements) {
    const b = elementBounds(el)
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }
  return { minX, minY, maxX, maxY }
}

/** Viewport that fits the given elements into a box of size (w, h). */
export function fitViewport(elements: BoardElement[], w: number, h: number, padding = 80, maxZoom = 1): Viewport {
  const b = contentBounds(elements)
  if (!b) return { x: w / 2, y: h / 2, zoom: 1 }
  const bw = b.maxX - b.minX
  const bh = b.maxY - b.minY
  const zoom = clamp(Math.min((w - padding * 2) / bw, (h - padding * 2) / bh), MIN_ZOOM, maxZoom)
  return {
    zoom,
    x: w / 2 - ((b.minX + b.maxX) / 2) * zoom,
    y: h / 2 - ((b.minY + b.maxY) / 2) * zoom,
  }
}

/** Gently sagging thread between two pins, like string under gravity. */
export function threadPath(a: Point, b: Point): string {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const sag = Math.min(dist * 0.08, 60)
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2 + sag
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
}

export function threadMidpoint(a: Point, b: Point): Point {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const sag = Math.min(dist * 0.08, 60)
  // Quadratic bezier at t = 0.5: (a + 2c + b) / 4
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag / 2 }
}
