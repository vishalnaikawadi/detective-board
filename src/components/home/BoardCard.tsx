import { useEffect, useRef, useState } from 'react'
import { navigate } from '../../lib/router'
import { useBoards } from '../../store/boards'
import type { Board } from '../../types'
import { Icon } from '../ui/Icons'
import { BoardThumbnail } from './BoardThumbnail'

interface Props {
  board: Board
  index: number
  onDelete: (board: Board) => void
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function relative(ts: number) {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return dateFmt.format(ts)
}

export function BoardCard({ board, index, onDelete }: Props) {
  const renameBoard = useBoards((s) => s.renameBoard)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(board.name)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const open = () => !renaming && navigate({ name: 'board', id: board.id })
  const commit = () => {
    renameBoard(board.id, draft)
    setRenaming(false)
  }

  return (
    <article className="card" style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}>
      <button className="card__open" onClick={open} aria-label={`Open ${board.name}`}>
        <BoardThumbnail board={board} />
      </button>

      <div className="card__body">
        <div className="card__meta">
          <span className="card__case">Case #{String(index + 1).padStart(3, '0')}</span>
          <span>{board.elements.length} clues</span>
        </div>
        {renaming ? (
          <input
            className="card__rename"
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(board.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <h3 className="card__name" onClick={open} title={board.name}>
            {board.name}
          </h3>
        )}
        <div className="card__dates">
          <span>Opened {dateFmt.format(board.createdAt)}</span>
          <span className="card__dot" />
          <span>Updated {relative(board.updatedAt)}</span>
        </div>
      </div>

      <div className="card__menu" ref={menuRef}>
        <button className="icon-btn icon-btn--glass" aria-label="Board options" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <Icon name="more" />
        </button>
        {menuOpen && (
          <div className="menu menu--inline" role="menu">
            <button
              role="menuitem"
              className="menu__item"
              onClick={() => {
                setMenuOpen(false)
                setDraft(board.name)
                setRenaming(true)
              }}
            >
              <Icon name="rename" />
              <span className="menu__label">Rename</span>
            </button>
            <button
              role="menuitem"
              className="menu__item menu__item--danger"
              onClick={() => {
                setMenuOpen(false)
                onDelete(board)
              }}
            >
              <Icon name="trash" />
              <span className="menu__label">Delete</span>
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
