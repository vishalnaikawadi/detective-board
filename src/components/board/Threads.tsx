import { memo } from 'react'
import { threadPath } from '../../lib/geometry'
import type { Point } from '../../types'

export interface ThreadSegment {
  id: string
  a: Point
  b: Point
}

interface Props {
  segments: ThreadSegment[]
  selectedId?: string | null
  pending?: { a: Point; b: Point } | null
  interactive: boolean
}

/**
 * Red yarn: a soft shadow cast on the board, a base strand, and two dashed
 * layers that read as twisted fibres.
 */
function Yarn({ d, selected }: { d: string; selected?: boolean }) {
  return (
    <>
      {selected && <path d={d} className="yarn-glow" />}
      <path d={d} className="yarn-shadow" filter="url(#thread-shadow-blur)" />
      <path d={d} className="yarn-base" />
      <path d={d} className="yarn-twist" />
      <path d={d} className="yarn-fibre" />
    </>
  )
}

export const Threads = memo(function Threads({ segments, selectedId, pending, interactive }: Props) {
  return (
    <svg className="threads" width="1" height="1" aria-hidden={!interactive}>
      {segments.map((s) => {
        const d = threadPath(s.a, s.b)
        return (
          <g key={s.id} data-thread-id={interactive ? s.id : undefined} className="thread">
            <Yarn d={d} selected={s.id === selectedId} />
            {interactive && <path d={d} className="yarn-hit" />}
          </g>
        )
      })}
      {pending && (
        <g className="thread thread--pending">
          <Yarn d={threadPath(pending.a, pending.b)} />
        </g>
      )}
    </svg>
  )
})
