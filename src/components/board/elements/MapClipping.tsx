import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { getVariant, regionStyle } from '../../../lib/catalog'
import { rotate } from '../../../lib/geometry'
import { uid } from '../../../lib/id'
import { ATTRIBUTION, MAP_W, MAX_MAP_ZOOM, MIN_MAP_ZOOM, placeLabel, project, searchPlaces, TILE, tileUrl, unproject, type PlaceResult } from '../../../lib/map'
import { ops, useBoards } from '../../../store/boards'
import { useEditor } from '../../../store/editor'
import type { MapElement } from '../../../types'
import { Icon } from '../../ui/Icons'
import { patchElement, stopCanvas, useBoardId } from './shared'

const CLICK_SLOP = 4
const MARKER_HIT = 16

interface Props {
  el: MapElement
  editing: boolean
  selected: boolean
}

export function MapClipping({ el, editing, selected }: Props) {
  const v = getVariant('map', el.variant)
  const area = v.area!
  const boardId = useBoardId()
  const scale = (el.w * area.width) / 100 / MAP_W
  const mapH = (el.h * area.height) / 100 / scale

  return (
    <>
      <div className="map-paper" />
      <div className={`map-area${editing ? ' is-live' : ''}`} style={regionStyle(area)}>
        {el.status === 'ready' ? (
          <LiveMap el={el} scale={scale} mapH={mapH} editing={editing && !!boardId} />
        ) : boardId ? (
          <PlaceSearch el={el} />
        ) : (
          <div className="map-empty">Location unknown</div>
        )}
      </div>
      <div className="map-label" style={regionStyle(v.text)}>
        {editing && boardId && el.status === 'ready' ? (
          <LabelInput el={el} boardId={boardId} />
        ) : (
          <span>{el.label || (selected && el.status === 'ready' ? 'Double-click to edit the map' : '')}</span>
        )}
      </div>
    </>
  )
}

function LiveMap({ el, scale, mapH, editing }: { el: MapElement; scale: number; mapH: number; editing: boolean }) {
  const boardId = useBoardId()
  const areaRef = useRef<HTMLDivElement>(null)
  const wheelAcc = useRef(0)
  const z = el.zoom
  const c = project(el.lat, el.lon, z)
  const left = c.x - MAP_W / 2
  const top = c.y - mapH / 2

  const tiles: { key: string; x: number; y: number; src: string }[] = []
  const n = 2 ** z
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + mapH) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + MAP_W) / TILE); tx++) {
      tiles.push({ key: `${z}/${tx}/${ty}`, x: tx * TILE - left, y: ty * TILE - top, src: tileUrl(tx, ty, z) })
    }
  }

  // Wheel zooms the map itself while editing (native listener so we can cancel page zoom).
  useEffect(() => {
    const node = areaRef.current
    if (!node || !editing || !boardId) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      wheelAcc.current += e.deltaY * (e.deltaMode === 1 ? 16 : 1)
      const threshold = e.ctrlKey ? 12 : 60
      if (Math.abs(wheelAcc.current) < threshold) return
      const step = wheelAcc.current > 0 ? -1 : 1
      wheelAcc.current = 0
      const cur = useBoards.getState().boards[boardId]?.elements.find((x) => x.id === el.id)
      if (cur?.type !== 'map') return
      const zoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, cur.zoom + step))
      if (zoom !== cur.zoom) patchElement(boardId, el.id, { zoom })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [editing, boardId, el.id])

  /** Screen point → map pixel offset from the map's center, accounting for zoom and rotation. */
  const toMapOffset = (dx: number, dy: number) => {
    const k = useEditor.getState().zoom * scale
    const local = rotate({ x: dx, y: dy }, -el.rotation)
    return { x: local.x / k, y: local.y / k }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editing || !boardId || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    const origin = project(el.lat, el.lon, z)
    const before = useBoards.getState().snapshot(boardId)!
    let moved = false

    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < CLICK_SLOP) return
      moved = true
      const d = toMapOffset(ev.clientX - start.x, ev.clientY - start.y)
      patchElement(boardId, el.id, unproject(origin.x - d.x, origin.y - d.y, z), false)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (moved) return useBoards.getState().pushHistory(boardId, before)
      // A click toggles a marker: remove one under the cursor, otherwise drop a new one.
      const r = areaRef.current!.getBoundingClientRect()
      const off = toMapOffset(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2))
      const hit = el.markers.find((m) => {
        const p = project(m.lat, m.lon, z)
        return Math.hypot(p.x - origin.x - off.x, p.y - origin.y - off.y) < MARKER_HIT
      })
      const markers = hit
        ? el.markers.filter((m) => m !== hit)
        : [...el.markers, { id: uid('mk'), ...unproject(origin.x + off.x, origin.y + off.y, z) }]
      // Removing a marker also cuts any thread tied to it (one undo step).
      useBoards.getState().update(boardId, ops.setMarkers(el.id, markers))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const zoomBy = (step: number) => {
    if (!boardId) return
    const zoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, z + step))
    if (zoom !== z) patchElement(boardId, el.id, { zoom })
  }

  return (
    <div ref={areaRef} className="map-live" onPointerDown={onPointerDown}>
      <div className="map-canvas" style={{ width: MAP_W, height: mapH, transform: `scale(${scale})` }}>
        <div className="map-tiles">
          {tiles.map((t) => (
            <img key={t.key} className="map-tile" src={t.src} alt="" draggable={false} crossOrigin="anonymous" style={{ left: t.x, top: t.y }} />
          ))}
        </div>
        <svg className="map-markers" width={MAP_W} height={mapH}>
          {el.markers.map((m, i) => {
            const p = project(m.lat, m.lon, z)
            return <Marker key={m.id} id={m.id} x={p.x - left} y={p.y - top} seed={i + m.id.length} />
          })}
        </svg>
        <div className="map-attrib">{ATTRIBUTION}</div>
      </div>
      {editing && (
        <>
          <div className="map-controls" onPointerDown={(e) => e.stopPropagation()}>
            <button aria-label="Zoom map in" onClick={() => zoomBy(1)}><Icon name="plus" /></button>
            <button aria-label="Zoom map out" onClick={() => zoomBy(-1)}><Icon name="minus" /></button>
          </div>
          <div className="map-hint">Drag to pan · click to circle a spot · click a circle to remove</div>
        </>
      )}
    </div>
  )
}

/** A hand-drawn red ring, slightly different for each marker. */
function Marker({ id, x, y, seed }: { id: string; x: number; y: number; seed: number }) {
  const tilt = ((seed * 47) % 60) - 30
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`} className="map-marker" data-marker-id={id}>
      <circle className="map-marker__hit" r="20" />
      <path d="M -17 -1 C -16 -12, 4 -18, 14 -9 C 20 -2, 14 12, 0 13 C -12 14, -19 5, -15 -6 C -12 -12, -3 -16, 7 -14" />
      <circle className="map-marker__dot" r="2.6" />
    </g>
  )
}

function PlaceSearch({ el }: { el: MapElement }) {
  const boardId = useBoardId()!
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [results, setResults] = useState<PlaceResult[] | null>(null)

  const choose = (p: PlaceResult) => {
    patchElement(boardId, el.id, {
      status: 'ready',
      lat: p.lat,
      lon: p.lon,
      zoom: p.zoom,
      label: placeLabel(p),
      markers: [{ id: uid('mk'), lat: p.lat, lon: p.lon }],
    })
  }

  return (
    <form
      className="map-search"
      {...stopCanvas}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!query.trim()) return
        setState('loading')
        try {
          const found = await searchPlaces(query.trim(), MAP_W)
          setResults(found)
          setState('idle')
        } catch {
          setState('error')
        }
      }}
    >
      <div className="map-search__kicker">Where did it happen?</div>
      <div className="map-search__row">
        <input
          autoFocus={useBoards.getState().boards[boardId]?.elements.at(-1)?.id === el.id}
          className="map-search__input"
          placeholder="221B Baker Street, London"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button className="map-search__go" type="submit" aria-label="Search">
          <Icon name="search" />
        </button>
      </div>
      <div className="map-search__results scrollable">
        {state === 'loading' && <div className="map-search__note">Checking the records…</div>}
        {state === 'error' && <div className="map-search__note">Search failed — try again.</div>}
        {state === 'idle' && results?.length === 0 && <div className="map-search__note">No place by that name.</div>}
        {state === 'idle' &&
          results?.map((r) => (
            <button key={r.id} type="button" className="map-search__result" onClick={() => choose(r)}>
              <strong>{r.name}</strong>
              <span>{r.detail}</span>
            </button>
          ))}
      </div>
    </form>
  )
}

function LabelInput({ el, boardId }: { el: MapElement; boardId: string }) {
  const before = useRef<ReturnType<typeof useBoards.getState>['boards'][string] | null>(null)
  return (
    <input
      className="map-label__input"
      value={el.label}
      maxLength={60}
      placeholder="Label this place"
      {...stopCanvas}
      onFocus={() => (before.current = useBoards.getState().boards[boardId] ?? null)}
      onChange={(e) => patchElement(boardId, el.id, { label: e.target.value }, false)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
      }}
      onBlur={() => {
        const b = before.current
        if (b) useBoards.getState().pushHistory(boardId, { elements: b.elements, threads: b.threads })
        before.current = null
      }}
    />
  )
}
