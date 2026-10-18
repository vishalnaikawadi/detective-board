import { useRef, useState } from 'react'
import { getVariant, regionStyle } from '../../../lib/catalog'
import { IMAGE_ACCEPT, isHeic, storeImage, UnreadableImageError, useImageUrl } from '../../../lib/images'
import { normalizeUrl } from '../../../lib/linkPreview'
import type { PhotoElement } from '../../../types'
import { Icon } from '../../ui/Icons'
import { EditableText, patchElement, stopCanvas, useBoardId } from './shared'

interface Props {
  el: PhotoElement
  editing: boolean
  selected: boolean
}

export function Photo({ el, editing, selected }: Props) {
  const v = getVariant('photo', el.variant)
  const quad = v.window!
  const xs = quad.map((p) => p[0])
  const ys = quad.map((p) => p[1])
  const box = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  // Clip path is relative to the window's bounding box; nudge outward so no gap shows under the frame edge.
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const clip = quad
    .map(([x, y]) => {
      const px = ((x + Math.sign(x - cx) * 0.6 - box.left) / box.width) * 100
      const py = ((y + Math.sign(y - cy) * 0.6 - box.top) / box.height) * 100
      return `${px.toFixed(2)}% ${py.toFixed(2)}%`
    })
    .join(', ')

  const url = useImageUrl(el.imageId, el.imageUrl)
  const [broken, setBroken] = useState<string | null>(null)
  const showImage = url && broken !== url

  return (
    <>
      <div
        className="photo-window"
        style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, clipPath: `polygon(${clip})` }}
      >
        {showImage ? (
          <img className="photo-img" src={url} alt={el.caption || 'Evidence photo'} draggable={false} onError={() => setBroken(url)} />
        ) : (
          <div className="photo-empty" />
        )}
      </div>
      <img className="el-art" src={v.src} alt="" draggable={false} />
      {!showImage && (
        <div className="photo-slot" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}>
          <PhotoPicker el={el} failed={!!url && broken === url} />
        </div>
      )}
      <div className="caption-region" style={regionStyle(v.text)}>
        {editing ? (
          <EditableText elementId={el.id} field="caption" value={el.caption} className="caption" placeholder="Caption…" maxLength={60} singleLine />
        ) : (
          <div className="caption">{el.caption || (selected && <span className="placeholder">Double-click for caption</span>)}</div>
        )}
      </div>
    </>
  )
}

function PhotoPicker({ el, failed }: { el: PhotoElement; failed: boolean }) {
  const boardId = useBoardId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [urlMode, setUrlMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!boardId) return <div className="photo-slot__mark"><Icon name="camera" /></div>

  const submitUrl = () => {
    const url = normalizeUrl(draft)
    if (!url) return
    patchElement(boardId, el.id, { imageUrl: url, imageId: undefined })
    setUrlMode(false)
  }

  return (
    <div className="photo-slot__inner" {...stopCanvas}>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setError(null)
          setBusy(isHeic(file) ? 'Developing iPhone photo…' : 'Developing photo…')
          try {
            const imageId = await storeImage(file)
            patchElement(boardId, el.id, { imageId, imageUrl: undefined })
          } catch (err) {
            setError(err instanceof UnreadableImageError ? err.message : 'Couldn’t add that photo.')
          } finally {
            setBusy(null)
          }
        }}
      />
      {busy ? (
        <div className="slot-busy">
          <span className="slot-spinner" />
          {busy}
        </div>
      ) : urlMode ? (
        <form
          className="slot-form"
          onSubmit={(e) => {
            e.preventDefault()
            submitUrl()
          }}
        >
          <input
            autoFocus
            className="slot-input"
            placeholder="https://…/photo.jpg"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setUrlMode(false)
              e.stopPropagation()
            }}
          />
          <div className="slot-row">
            <button type="button" className="slot-btn slot-btn--ghost" onClick={() => setUrlMode(false)}>Cancel</button>
            <button type="submit" className="slot-btn">Add</button>
          </div>
        </form>
      ) : (
        <>
          <div className="photo-slot__mark"><Icon name="camera" /></div>
          {(error || failed) && <div className="slot-error">{error ?? 'Image couldn’t load'}</div>}
          <button className="slot-btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Upload
          </button>
          <button className="slot-btn slot-btn--ghost" onClick={() => setUrlMode(true)}>
            <Icon name="link" /> Image URL
          </button>
        </>
      )}
    </div>
  )
}
