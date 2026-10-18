import { useMemo, useState } from 'react'
import { navigate } from '../../lib/router'
import { useBoards } from '../../store/boards'
import type { Board } from '../../types'
import { PinDefs } from '../board/PushPin'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Icon } from '../ui/Icons'
import { BoardCard } from './BoardCard'

export function HomePage() {
  const boards = useBoards((s) => s.boards)
  const loaded = useBoards((s) => s.loaded)
  const [pendingDelete, setPendingDelete] = useState<Board | null>(null)

  // Case numbers follow creation order; the grid shows most recently worked on first.
  const ordered = useMemo(() => {
    const all = Object.values(boards)
    const caseNo = new Map([...all].sort((a, b) => a.createdAt - b.createdAt).map((b, i) => [b.id, i] as const))
    return all.sort((a, b) => b.updatedAt - a.updatedAt).map((b) => ({ board: b, caseNo: caseNo.get(b.id)! }))
  }, [boards])

  const create = () => {
    const id = useBoards.getState().createBoard()
    navigate({ name: 'board', id })
  }

  return (
    <div className="home">
      <PinDefs />
      <div className="home__bg" aria-hidden>
        <div className="home__halftone home__halftone--tl" />
        <div className="home__halftone home__halftone--br" />
        <div className="home__streaks" />
      </div>

      <header className="home__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            <svg viewBox="0 0 32 32">
              <path d="M7 23 L16 9 L25 20" fill="none" stroke="#e3202e" strokeWidth="1.8" />
              <circle cx="16" cy="9" r="3.6" fill="#ff3b4a" />
              <circle cx="7" cy="23" r="2.6" fill="#4aa3ff" />
              <circle cx="25" cy="20" r="2.6" fill="#4aa3ff" />
            </svg>
          </span>
          <span className="brand__name">Caseboard</span>
        </div>
        <span className="home__status">
          <i /> {ordered.length} {ordered.length === 1 ? 'open case' : 'open cases'}
        </span>
      </header>

      <section className="hero">
        <span className="viewfinder viewfinder--tl" />
        <span className="viewfinder viewfinder--br" />
        <div className="kicker">// Case files</div>
        <h1>
          Every clue, <em>connected.</em>
        </h1>
        <p>Pin photos, clip articles, scribble notes, and tie it all together with red thread.</p>
      </section>

      <main className="grid" aria-busy={!loaded}>
        <button className="card card--new" onClick={create}>
          <span className="card--new__corners" aria-hidden />
          <span className="card--new__plus">
            <Icon name="plus" size={28} />
          </span>
          <span className="card--new__label">Add new board</span>
          <span className="card--new__sub">Open a fresh case file</span>
        </button>
        {ordered.map(({ board, caseNo }) => (
          <BoardCard key={board.id} board={board} index={caseNo} onDelete={setPendingDelete} />
        ))}
      </main>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete “${pendingDelete.name}”?`}
          body="The board, its clues and uploaded photos will be removed from this browser. This can’t be undone."
          confirmLabel="Delete board"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            useBoards.getState().deleteBoard(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}
