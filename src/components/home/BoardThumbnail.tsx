import { useLayoutEffect, useRef, useState } from 'react'
import { fitViewport } from '../../lib/geometry'
import { CORK_TILE, corkTexture } from '../../lib/texture'
import type { Board } from '../../types'
import { Scene } from '../board/Scene'

/** A live, non-interactive render of the board scaled to fit the card. */
export function BoardThumbnail({ board }: { board: Board }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const vp = size.w ? fitViewport(board.elements, size.w, size.h, 18, 0.6) : null
  const tile = CORK_TILE * 0.45

  return (
    <div
      ref={ref}
      className="thumb"
      style={{ backgroundImage: `url(${corkTexture()})`, backgroundSize: `${tile}px ${tile}px` }}
    >
      {vp && board.elements.length > 0 && (
        <div className="world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
          <Scene board={board} />
        </div>
      )}
      {board.elements.length === 0 && <div className="thumb__empty">No evidence yet</div>}
      <div className="thumb__shade" />
    </div>
  )
}
