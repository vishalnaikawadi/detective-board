import type { Point } from '../../types'

interface Props {
  at: Point
  /** Endpoint key (element id, or "element|marker") when the pin is interactive. */
  pinId?: string
  ghost?: boolean
  size?: number
}

export const PIN_SIZE = 30
/** Pins stuck into map markers are a touch smaller so the red ring stays visible. */
export const MARKER_PIN_SIZE = 22

/** Glossy red push-pin, seen slightly from above, with its shadow on the board. */
export function PushPin({ at, pinId, ghost, size = PIN_SIZE }: Props) {
  return (
    <div
      className={`pin${ghost ? ' pin--ghost' : ''}`}
      data-pin-id={pinId}
      style={{ left: at.x - size / 2, top: at.y - size / 2, width: size, height: size }}
    >
      <svg viewBox="-15 -15 30 30" width={size} height={size} aria-hidden>
        <ellipse cx="4.5" cy="6" rx="7.5" ry="5.5" fill="rgba(0,0,0,0.5)" filter="url(#pin-shadow-blur)" />
        <circle r="8.2" fill="url(#pin-head)" />
        <circle r="8.2" fill="none" stroke="rgba(60,0,6,0.7)" strokeWidth="0.8" />
        <circle cx="0.6" cy="0.6" r="4.6" fill="url(#pin-dome)" />
        <ellipse cx="-3" cy="-3.4" rx="2.6" ry="1.7" transform="rotate(-35 -3 -3.4)" fill="rgba(255,255,255,0.85)" />
        <circle cx="3.4" cy="3.6" r="0.9" fill="rgba(255,255,255,0.25)" />
      </svg>
    </div>
  )
}

/** Shared gradients for all pins; rendered once per page. */
export function PinDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <radialGradient id="pin-head" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff7a80" />
          <stop offset="45%" stopColor="#e3202e" />
          <stop offset="100%" stopColor="#6e0710" />
        </radialGradient>
        <radialGradient id="pin-dome" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff9da1" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#d81b29" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8d0a14" stopOpacity="0" />
        </radialGradient>
        <filter id="pin-shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id="thread-shadow-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
    </svg>
  )
}
