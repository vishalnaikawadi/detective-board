import { useMemo } from 'react'
import { anchorPosition, endpointKey, parseEndpointKey, threadEnds } from '../../lib/geometry'
import type { Board, Endpoint, Point } from '../../types'
import { ElementView } from './ElementView'
import { MARKER_PIN_SIZE, PushPin } from './PushPin'
import { Threads, type ThreadSegment } from './Threads'

interface Props {
  board: Board
  interactive?: boolean
  selectedId?: string | null
  selectedThreadId?: string | null
  editingId?: string | null
  draggingId?: string | null
  /** Element highlighted as a thread target / source. */
  targetIds?: (string | null)[]
  pendingFrom?: Endpoint | null
  pendingTo?: Point | null
}

/** Everything that lives in world space: elements, red thread, then pins on top. */
export function Scene({
  board,
  interactive = false,
  selectedId,
  selectedThreadId,
  editingId,
  draggingId,
  targetIds = [],
  pendingFrom,
  pendingTo,
}: Props) {
  const byId = useMemo(() => new Map(board.elements.map((e) => [e.id, e] as const)), [board.elements])
  const sorted = useMemo(() => [...board.elements].sort((a, b) => a.z - b.z), [board.elements])

  const segments = useMemo<ThreadSegment[]>(() => {
    const out: ThreadSegment[] = []
    for (const t of board.threads) {
      const [ea, eb] = threadEnds(t)
      const a = byId.get(ea.el)
      const b = byId.get(eb.el)
      if (a && b) out.push({ id: t.id, a: anchorPosition(a, ea.marker), b: anchorPosition(b, eb.marker) })
    }
    return out
  }, [board.threads, byId])

  // One pin per distinct thread end: the element itself, or a marker on a map.
  const pinned = useMemo(() => {
    const keys = new Set<string>()
    for (const t of board.threads) for (const e of threadEnds(t)) keys.add(endpointKey(e))
    return keys
  }, [board.threads])

  const source = pendingFrom ? byId.get(pendingFrom.el) : undefined
  const pending = source && pendingTo ? { a: anchorPosition(source, pendingFrom?.marker), b: pendingTo } : null
  const pendingKey = pendingFrom ? endpointKey(pendingFrom) : null

  const pin = (key: string, ghost = false) => {
    const end = parseEndpointKey(key)
    const el = byId.get(end.el)
    if (!el) return null
    return (
      <PushPin
        key={key}
        at={anchorPosition(el, end.marker)}
        pinId={interactive ? key : undefined}
        size={end.marker ? MARKER_PIN_SIZE : undefined}
        ghost={ghost}
      />
    )
  }

  return (
    <>
      {sorted.map((el) => (
        <ElementView
          key={el.id}
          el={el}
          interactive={interactive}
          selected={el.id === selectedId}
          editing={el.id === editingId}
          dragging={el.id === draggingId}
          targeted={targetIds.includes(el.id)}
        />
      ))}
      <Threads segments={segments} selectedId={selectedThreadId} pending={pending} interactive={interactive} />
      <div className="pins">
        {[...pinned].map((key) => pin(key))}
        {pendingKey && !pinned.has(pendingKey) && pin(pendingKey, true)}
      </div>
    </>
  )
}
