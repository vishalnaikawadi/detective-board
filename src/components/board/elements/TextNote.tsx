import type { CSSProperties } from 'react'
import { getVariant, regionStyle } from '../../../lib/catalog'
import type { NoteElement, StickyElement } from '../../../types'
import { EditableText } from './shared'

interface Props {
  el: StickyElement | NoteElement
  editing: boolean
  selected: boolean
}

export function TextNote({ el, editing, selected }: Props) {
  const v = getVariant(el.type, el.variant)
  const lined = v.lineSpacing != null
  const cls = `note-text ${lined ? 'note-text--lined' : 'note-text--sticky'}`
  const style = { ...regionStyle(v.text), ...(lined ? { '--line': `${v.lineSpacing}cqh` } : {}) } as CSSProperties

  return (
    <>
      <img className="el-art" src={v.src} alt="" draggable={false} />
      <div className="note-region" style={style}>
        {editing ? (
          <EditableText elementId={el.id} field="text" value={el.text} className={cls} placeholder="Write a clue…" />
        ) : (
          <div className={cls}>
            {el.text || (selected && <span className="placeholder">Double-click to write…</span>)}
          </div>
        )}
      </div>
    </>
  )
}
