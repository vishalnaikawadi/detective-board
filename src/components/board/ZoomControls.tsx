import type { Viewport } from '../../types'
import { Icon } from '../ui/Icons'

interface Props {
  vp: Viewport
  onZoom: (factor: number) => void
  onReset: () => void
  onFit: () => void
}

export function ZoomControls({ vp, onZoom, onReset, onFit }: Props) {
  return (
    <div className="zoom">
      <button className="icon-btn" aria-label="Zoom out" data-tip="Zoom out  ⌘−" onClick={() => onZoom(1 / 1.25)}>
        <Icon name="minus" />
      </button>
      <button className="zoom__value" onClick={onReset} data-tip="Reset to 100%  ⌘0">
        {Math.round(vp.zoom * 100)}%
      </button>
      <button className="icon-btn" aria-label="Zoom in" data-tip="Zoom in  ⌘+" onClick={() => onZoom(1.25)}>
        <Icon name="plus" />
      </button>
      <span className="zoom__sep" />
      <button className="icon-btn" aria-label="Zoom to fit" data-tip="Zoom to fit  ⇧1" onClick={onFit}>
        <Icon name="fit" />
      </button>
    </div>
  )
}
