import { useState } from 'react'
import { getVariant, regionStyle } from '../../../lib/catalog'
import { fetchLinkPreview, hostOf, normalizeUrl } from '../../../lib/linkPreview'
import { useBoards } from '../../../store/boards'
import type { ArticleElement } from '../../../types'
import { EditableText, patchElement, stopCanvas, useBoardId } from './shared'

interface Props {
  el: ArticleElement
  editing: boolean
}

/** Fetch article metadata for a URL and fill in the clipping. */
export async function loadArticle(boardId: string, id: string, url: string) {
  patchElement(boardId, id, { url, status: 'loading', title: '', excerpt: '', image: undefined, publisher: hostOf(url) })
  try {
    const p = await fetchLinkPreview(url)
    patchElement(boardId, id, { status: 'ready', ...p }, false)
  } catch {
    patchElement(boardId, id, { status: 'error', title: hostOf(url), excerpt: '' }, false)
  }
}

const GREEK = [96, 100, 92, 98, 64, 100, 94, 99, 88, 97, 72, 100, 95, 90, 100, 58, 97, 93, 100, 86, 99, 70, 96, 100, 91, 62]

function formatDate(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function Article({ el, editing }: Props) {
  const v = getVariant('article', el.variant)
  const boardId = useBoardId()

  return (
    <>
      <img className="el-art" src={v.src} alt="" draggable={false} />
      <div className="article" style={regionStyle(v.text)}>
        {el.status === 'empty' ? (
          boardId ? <LinkForm boardId={boardId} el={el} /> : <div className="article__awaiting">Awaiting clipping</div>
        ) : el.status === 'loading' ? (
          <div className="article__loading">
            <div className="article__masthead">
              <span>{el.publisher}</span>
            </div>
            <div className="article__wire">Pulling the story off the wire…</div>
            <div className="skeleton" style={{ width: '90%' }} />
            <div className="skeleton" style={{ width: '70%' }} />
          </div>
        ) : (
          <>
            <div className="article__masthead">
              <span>{el.publisher || hostOf(el.url)}</span>
              <span>{formatDate(el.date) ?? 'Late edition'}</span>
            </div>
            {editing ? (
              <>
                <EditableText elementId={el.id} field="title" value={el.title} className="article__headline" placeholder="Headline" singleLine />
                <EditableText elementId={el.id} field="excerpt" value={el.excerpt} className="article__body article__body--edit" placeholder="Excerpt…" />
              </>
            ) : (
              <>
                <h3 className="article__headline">{el.title}</h3>
                <div className={`article__columns${el.image ? ' has-image' : ''}`}>
                  {el.image && <img className="article__image" src={el.image} alt="" draggable={false} referrerPolicy="no-referrer" />}
                  {el.excerpt || el.status === 'error' ? (
                    <p className="article__body">
                      {el.excerpt || 'No preview could be fetched for this link. Use “Edit text” to write the summary yourself.'}
                    </p>
                  ) : (
                    // No excerpt available: fill the column with faint "greeked" print.
                    <div className="article__body article__greek" aria-hidden>
                      {GREEK.map((w, i) => (
                        <i key={i} style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="article__footer">Read the full story ↗ {hostOf(el.url)}</div>
          </>
        )}
      </div>
    </>
  )
}

function LinkForm({ boardId, el }: { boardId: string; el: ArticleElement }) {
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)

  return (
    <form
      className="article__form"
      {...stopCanvas}
      onSubmit={(e) => {
        e.preventDefault()
        const url = normalizeUrl(draft)
        if (!url) return setInvalid(true)
        loadArticle(boardId, el.id, url)
      }}
    >
      <div className="article__kicker">Extra! Extra!</div>
      <label className="article__prompt" htmlFor={`url-${el.id}`}>Paste a link to the article</label>
      <input
        id={`url-${el.id}`}
        autoFocus={useBoards.getState().boards[boardId]?.elements.at(-1)?.id === el.id}
        className={`article__input${invalid ? ' is-invalid' : ''}`}
        placeholder="https://news.example.com/story"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setInvalid(false)
        }}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <button className="article__submit" type="submit">Clip it</button>
    </form>
  )
}
