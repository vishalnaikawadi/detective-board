import { useEffect, useRef, useState } from 'react'
import { navigate } from '../../lib/router'
import { useBoards } from '../../store/boards'
import type { Board } from '../../types'
import { Icon } from '../ui/Icons'

interface Props {
  board: Board
  autoFocusTitle: boolean
  exporting: boolean
  onExport: (scope: 'board' | 'view') => void
}

export function TopBar({ board, autoFocusTitle, exporting, onExport }: Props) {
  const renameBoard = useBoards((s) => s.renameBoard)
  const history = useBoards((s) => s.history[board.id])
  const { undo, redo } = useBoards.getState()
  const [draft, setDraft] = useState(board.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menuOpen])

  useEffect(() => setDraft(board.name), [board.name])
  useEffect(() => {
    if (autoFocusTitle) inputRef.current?.select()
  }, [autoFocusTitle])

  const counts = {
    clues: board.elements.length,
    threads: board.threads.length,
  }

  return (
    <header className="topbar">
      <button className="topbar__back" onClick={() => navigate({ name: 'home' })}>
        <Icon name="back_arrow" />
        <span>Case files</span>
      </button>

      <div className="topbar__title">
        <span className="topbar__kicker">Case file</span>
        <input
          ref={inputRef}
          className="topbar__name"
          value={draft}
          aria-label="Board name"
          spellCheck={false}
          maxLength={80}
          size={Math.max(8, draft.length + 1)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => renameBoard(board.id, draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(board.name)
              requestAnimationFrame(() => inputRef.current?.blur())
            }
          }}
        />
        <Icon name="rename" size={14} />
      </div>

      <div className="topbar__right">
        <span className="topbar__stats">
          {counts.clues} {counts.clues === 1 ? 'clue' : 'clues'} · {counts.threads} {counts.threads === 1 ? 'thread' : 'threads'}
        </span>
        <span className="topbar__saved" title="Boards are saved in this browser">
          <i /> Saved locally
        </span>
        <div className="topbar__export" ref={menuRef}>
          <button
            className="topbar__export-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={exporting}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name="download" />
            <span>{exporting ? 'Exporting…' : 'Export'}</span>
          </button>
          {menuOpen && (
            <div className="menu menu--inline" role="menu">
              <button
                role="menuitem"
                className="menu__item"
                disabled={!board.elements.length}
                onClick={() => {
                  setMenuOpen(false)
                  onExport('board')
                }}
              >
                <Icon name="fit" />
                <span className="menu__label">Whole board · PNG</span>
                <kbd>⇧⌘E</kbd>
              </button>
              <button
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false)
                  onExport('view')
                }}
              >
                <Icon name="image" />
                <span className="menu__label">Current view · PNG</span>
              </button>
            </div>
          )}
        </div>
        <div className="topbar__history">
          <button className="icon-btn" aria-label="Undo" data-tip="Undo  ⌘Z" disabled={!history?.past.length} onClick={() => undo(board.id)}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn" aria-label="Redo" data-tip="Redo  ⇧⌘Z" disabled={!history?.future.length} onClick={() => redo(board.id)}>
            <Icon name="redo" />
          </button>
        </div>
      </div>
    </header>
  )
}
