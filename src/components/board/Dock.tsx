import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { getVariant, TOOLS, type ToolDef } from '../../lib/catalog'
import { useEditor } from '../../store/editor'
import type { ElementType } from '../../types'

interface Props {
  /** Called when a tool is released over the board; returns false if it missed. */
  onDrop: (type: ElementType, variant: string, clientX: number, clientY: number) => boolean
  onHint: (message: string) => void
}

const BASE = 56
const GAP = 10
const PAD = 14
const DIVIDER = 11
const RANGE = 150
const MAX_BOOST = 0.62

type Slot = { kind: 'tool'; tool: ToolDef } | { kind: 'thread' }
const SLOTS: Slot[] = [...TOOLS.map((tool) => ({ kind: 'tool' as const, tool })), { kind: 'thread' }]

/** Un-magnified slot centers, so magnification doesn't feed back into itself. */
const CENTERS = SLOTS.map((s, i) => PAD + i * (BASE + GAP) + BASE / 2 + (s.kind === 'thread' ? DIVIDER : 0))

function magnify(mouseX: number | null, i: number) {
  if (mouseX == null) return 1
  const d = Math.abs(mouseX - CENTERS[i])
  if (d > RANGE) return 1
  return 1 + MAX_BOOST * ((Math.cos((Math.PI * d) / RANGE) + 1) / 2)
}

export function Dock({ onDrop, onHint }: Props) {
  const { variantChoice, chooseVariant, setDockDrag, mode, startThread, exitThreadMode } = useEditor()
  const [mouseX, setMouseX] = useState<number | null>(null)
  const [openType, setOpenType] = useState<ElementType | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openType) return
    const close = (e: PointerEvent) => !dockRef.current?.contains(e.target as Node) && setOpenType(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [openType])

  /** Press on a tool: drag it out onto the board, or treat it as a click. */
  const press = (e: React.PointerEvent, type: ElementType, variant: string, onClick: () => void) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let dragging = false
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      if (!dragging) {
        dragging = true
        setOpenType(null)
        setMouseX(null)
        document.body.classList.add('is-dock-dragging')
      }
      setDockDrag({ type, variant, x: ev.clientX, y: ev.clientY })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('is-dock-dragging')
      setDockDrag(null)
      if (!dragging) return onClick()
      const overDock = dockRef.current?.contains(document.elementFromPoint(ev.clientX, ev.clientY))
      if (overDock || !onDrop(type, variant, ev.clientX, ev.clientY)) return
      chooseVariant(type, variant)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="dock-wrap">
      <div
        ref={dockRef}
        className="dock"
        onMouseMove={(e) => setMouseX(e.clientX - e.currentTarget.getBoundingClientRect().left)}
        onMouseLeave={() => setMouseX(null)}
      >
        {SLOTS.map((slot, i) => {
          const s = magnify(mouseX, i)
          const size = BASE * s
          if (slot.kind === 'thread') {
            const active = mode === 'thread'
            return (
              <div key="thread" className="dock__group">
                <span className="dock__divider" />
                <button
                  className={`dock__item${active ? ' is-active' : ''}`}
                  style={{ width: size, height: size }}
                  aria-pressed={active}
                  aria-label="Red thread"
                  onClick={() => (active ? exitThreadMode() : startThread())}
                >
                  <span className="dock__tip">{active ? 'Finish threading  (Esc)' : 'Red thread  (T)'}</span>
                  <ThreadSpool />
                </button>
              </div>
            )
          }

          const { tool } = slot
          const current = getVariant(tool.type, variantChoice[tool.type])
          // Random-variant tools (newspaper) never show a picker.
          const multi = tool.variants.length > 1 && !tool.random
          const open = openType === tool.type
          return (
            <div key={tool.type} className="dock__group">
              <button
                className={`dock__item${open ? ' is-open' : ''}`}
                style={{ width: size, height: size }}
                aria-label={`${tool.label}${multi ? ` — ${current.label}` : ''}`}
                aria-haspopup={multi || undefined}
                aria-expanded={multi ? open : undefined}
                onPointerDown={(e) =>
                  press(e, tool.type, current.id, () =>
                    multi
                      ? setOpenType(open ? null : tool.type)
                      : onHint(
                          tool.random
                            ? `Drag the ${tool.label.toLowerCase()} onto the board — each one gets a random paper`
                            : `Drag the ${tool.label.toLowerCase()} onto the board`,
                        ),
                  )
                }
              >
                {!open && <span className="dock__tip">{tool.label}</span>}
                <img src={current.src} alt="" draggable={false} />
                {multi && (
                  <span className="dock__dots">
                    {tool.variants.map((v) => (
                      <i key={v.id} className={v.id === current.id ? 'on' : ''} />
                    ))}
                  </span>
                )}
              </button>
              {open && (
                <div className="variants" role="menu">
                  <div className="variants__title">{tool.label} · {tool.variants.length} styles</div>
                  <div className="variants__list">
                    {tool.variants.map((v) => (
                      <button
                        key={v.id}
                        role="menuitemradio"
                        aria-checked={v.id === current.id}
                        className={`variants__item${v.id === current.id ? ' is-current' : ''}`}
                        onPointerDown={(e) =>
                          press(e, tool.type, v.id, () => {
                            chooseVariant(tool.type, v.id)
                            setOpenType(null)
                          })
                        }
                      >
                        <img src={v.src} alt="" draggable={false} />
                        <span>{v.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="variants__hint">Click to choose · drag onto the board</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ThreadSpool() {
  return (
    <svg viewBox="0 0 64 64" className="spool" aria-hidden>
      <defs>
        <linearGradient id="spool-wood" x1="0" x2="1">
          <stop offset="0" stopColor="#7a5a3a" />
          <stop offset="0.5" stopColor="#c09468" />
          <stop offset="1" stopColor="#6b4c30" />
        </linearGradient>
        <linearGradient id="spool-yarn" x1="0" x2="1">
          <stop offset="0" stopColor="#7d0b15" />
          <stop offset="0.45" stopColor="#e2303d" />
          <stop offset="1" stopColor="#80101a" />
        </linearGradient>
      </defs>
      <rect x="17" y="10" width="30" height="6" rx="3" fill="url(#spool-wood)" />
      <rect x="17" y="48" width="30" height="6" rx="3" fill="url(#spool-wood)" />
      <rect x="20" y="16" width="24" height="32" fill="url(#spool-yarn)" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M20 ${18 + i * 3} L44 ${19.5 + i * 3}`} stroke="rgba(60,0,8,.45)" strokeWidth="0.8" />
      ))}
      <path d="M44 34 C 54 36, 52 48, 58 56" fill="none" stroke="#d81f2c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="58" cy="56" r="4" fill="#ff3b4a" stroke="#6e0710" strokeWidth="0.8" />
      <circle cx="56.8" cy="54.6" r="1.2" fill="#fff" opacity="0.8" />
    </svg>
  )
}
