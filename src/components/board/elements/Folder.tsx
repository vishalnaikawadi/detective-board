import { useEffect, useRef, useState } from 'react'
import { getVariant, regionStyle } from '../../../lib/catalog'
import { formatBytes, MAX_DOC_BYTES, openFile } from '../../../lib/images'
import { useEditor } from '../../../store/editor'
import type { FolderDoc, FolderElement } from '../../../types'
import { Icon } from '../../ui/Icons'
import { actions } from '../actions'
import { EditableText, stopCanvas, useBoardId } from './shared'

interface Props {
  el: FolderElement
  editing: boolean
  selected: boolean
}

const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.pages,.xls,.xlsx,.csv,.numbers,.ppt,.pptx,.key,application/pdf,text/*'

function extOf(name: string) {
  const m = name.match(/\.([a-z0-9]{1,5})$/i)
  return m ? m[1].toUpperCase() : 'FILE'
}

/** Colour-coded file badge, so PDFs, Word docs and spreadsheets read at a glance. */
function kindOf(ext: string) {
  if (ext === 'PDF') return 'pdf'
  if (/^(DOC|DOCX|ODT|RTF|PAGES)$/.test(ext)) return 'doc'
  if (/^(XLS|XLSX|CSV|NUMBERS)$/.test(ext)) return 'sheet'
  if (/^(PPT|PPTX|KEY)$/.test(ext)) return 'slides'
  return 'other'
}

export function Folder({ el, editing, selected }: Props) {
  const v = getVariant('folder', el.variant)
  const boardId = useBoardId()
  const fileRef = useRef<HTMLInputElement>(null)
  const filePickFor = useEditor((s) => s.filePickFor)
  const [notice, setNotice] = useState<string | null>(null)
  const sheets = Math.min(el.docs.length, 3)

  // Toolbar / menu "Add documents" asks this folder to open its picker.
  useEffect(() => {
    if (filePickFor !== el.id) return
    useEditor.getState().requestFilePick(null)
    fileRef.current?.click()
  }, [filePickFor, el.id])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2600)
    return () => clearTimeout(t)
  }, [notice])

  const open = (doc: FolderDoc) => openFile(doc.id, doc.name).catch((e: Error) => setNotice(e.message))

  return (
    <>
      {Array.from({ length: sheets }, (_, i) => (
        <div key={i} className={`folder-sheet folder-sheet--${i}`} />
      ))}
      <img className="el-art" src={v.src} alt="" draggable={false} />
      <div className="folder-front" style={regionStyle(v.text)}>
        <div className="folder-label">
          {editing && boardId ? (
            <EditableText elementId={el.id} field="label" value={el.label} className="folder-label__text" placeholder="Name this file" maxLength={40} singleLine />
          ) : (
            <span className="folder-label__text">{el.label || (selected ? 'Double-click to name' : 'Case file')}</span>
          )}
        </div>
        <div className="folder-stamp" aria-hidden>
          Confidential
        </div>

        {el.docs.length ? (
          <ol className="folder-docs scrollable">
            {el.docs.map((d, i) => {
              const ext = extOf(d.name)
              return (
                <li key={d.id} className="folder-doc">
                  <button
                    className="folder-doc__open"
                    title={`Open ${d.name}`}
                    disabled={!boardId}
                    {...stopCanvas}
                    onClick={() => open(d)}
                  >
                    <span className="folder-doc__no">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`folder-doc__badge folder-doc__badge--${kindOf(ext)}`}>{ext}</span>
                    <span className="folder-doc__name">{d.name.replace(/\.[^.]+$/, '')}</span>
                    <span className="folder-doc__size">{formatBytes(d.size)}</span>
                  </button>
                  {boardId && selected && (
                    <button
                      className="folder-doc__remove"
                      aria-label={`Remove ${d.name}`}
                      {...stopCanvas}
                      onClick={() => actions.removeDoc(boardId, el.id, d.id)}
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="folder-empty">
            <Icon name="upload" />
            <span>{boardId ? 'Drop PDFs & documents here' : 'Empty file'}</span>
          </div>
        )}

        <div className="folder-footer">
          <span>
            {el.docs.length} {el.docs.length === 1 ? 'document' : 'documents'}
          </span>
          {boardId && (
            <button className="folder-add" {...stopCanvas} onClick={() => fileRef.current?.click()}>
              <Icon name="plus" /> Add
            </button>
          )}
        </div>
        {notice && <div className="folder-notice">{notice}</div>}
      </div>

      {boardId && (
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (!files.length) return
            const skipped = await actions.addDocs(boardId, el.id, files)
            if (skipped) setNotice(`${skipped} file${skipped > 1 ? 's' : ''} over ${formatBytes(MAX_DOC_BYTES)} skipped`)
          }}
        />
      )}
    </>
  )
}
