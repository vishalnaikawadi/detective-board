import { memo } from 'react'
import type { BoardElement } from '../../types'
import { Article } from './elements/Article'
import { Folder } from './elements/Folder'
import { MapClipping } from './elements/MapClipping'
import { Photo } from './elements/Photo'
import { TextNote } from './elements/TextNote'

interface Props {
  el: BoardElement
  selected: boolean
  editing: boolean
  dragging: boolean
  targeted: boolean
  interactive: boolean
}

export const ElementView = memo(function ElementView({ el, selected, editing, dragging, targeted, interactive }: Props) {
  const cls = ['el', `el--${el.type}`, `el--v-${el.variant}`, selected && 'is-selected', dragging && 'is-dragging', targeted && 'is-targeted', editing && 'is-editing']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      data-el-id={interactive ? el.id : undefined}
      style={{
        left: el.x - el.w / 2,
        top: el.y - el.h / 2,
        width: el.w,
        height: el.h,
        transform: `rotate(${el.rotation}deg)`,
      }}
    >
      {el.type === 'photo' && <Photo el={el} editing={editing} selected={selected} />}
      {(el.type === 'sticky' || el.type === 'note') && <TextNote el={el} editing={editing} selected={selected} />}
      {el.type === 'article' && <Article el={el} editing={editing} />}
      {el.type === 'map' && <MapClipping el={el} editing={editing} selected={selected} />}
      {el.type === 'folder' && <Folder el={el} editing={editing} selected={selected} />}

      {selected && interactive && (
        <div className="sel">
          <span className="sel__corner sel__corner--tl" />
          <span className="sel__corner sel__corner--tr" />
          <span className="sel__corner sel__corner--bl" />
          <span className="sel__corner sel__corner--br" />
          <div className="sel__rotate" data-handle="rotate" title="Rotate (Shift snaps 15°)">
            <span />
          </div>
          <div className="sel__resize" data-handle="resize" title="Resize" />
        </div>
      )}
    </div>
  )
})
