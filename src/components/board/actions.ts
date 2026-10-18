import { duplicateElement } from '../../lib/elements'
import { MAX_DOC_BYTES, storeFile } from '../../lib/images'
import { nextZ, ops, useBoards } from '../../store/boards'
import { useEditor } from '../../store/editor'
import type { BoardElement, FolderDoc } from '../../types'

// Element commands shared by the toolbar, context menu and keyboard shortcuts.

const boards = () => useBoards.getState()
const editor = () => useEditor.getState()

export function findElement(boardId: string, id: string): BoardElement | undefined {
  return boards().boards[boardId]?.elements.find((e) => e.id === id)
}

export const actions = {
  remove(boardId: string, id: string) {
    boards().update(boardId, ops.remove(id))
    if (editor().selectedId === id) editor().select(null)
  },
  duplicate(boardId: string, id: string) {
    const b = boards().boards[boardId]
    const el = findElement(boardId, id)
    if (!b || !el) return
    const copy = duplicateElement(el, nextZ(b.elements))
    boards().update(boardId, ops.add(copy))
    editor().select(copy.id)
  },
  toFront: (boardId: string, id: string) => boards().update(boardId, ops.toFront(id)),
  toBack: (boardId: string, id: string) => boards().update(boardId, ops.toBack(id)),
  clearThreads: (boardId: string, id: string) => boards().update(boardId, ops.clearThreads(id)),
  cutThread(boardId: string, threadId: string) {
    boards().update(boardId, ops.disconnect(threadId))
    editor().selectThread(null)
  },
  connectFrom(id: string) {
    editor().select(null)
    editor().startThread({ el: id })
  },
  edit(id: string) {
    editor().select(id)
    editor().setEditing(id)
  },
  clearPhoto: (boardId: string, id: string) => boards().update(boardId, ops.patch(id, { imageId: undefined, imageUrl: undefined })),
  changeLink: (boardId: string, id: string) => boards().update(boardId, ops.patch(id, { status: 'empty' })),
  relocate: (boardId: string, id: string) => boards().update(boardId, ops.patch(id, { status: 'empty' })),
  open(boardId: string, id: string) {
    const el = findElement(boardId, id)
    if (el?.type === 'article' && el.url) window.open(el.url, '_blank', 'noopener,noreferrer')
  },
  /** Store files and file them into a folder as one undo step. Returns how many were too large. */
  async addDocs(boardId: string, folderId: string, files: File[]) {
    const ok = files.filter((f) => f.size <= MAX_DOC_BYTES)
    const docs: FolderDoc[] = await Promise.all(
      ok.map(async (f) => ({ id: await storeFile(f), name: f.name, size: f.size, mime: f.type, addedAt: Date.now() })),
    )
    const el = findElement(boardId, folderId)
    if (el?.type === 'folder' && docs.length) boards().update(boardId, ops.patch(folderId, { docs: [...el.docs, ...docs] }))
    return files.length - ok.length
  },
  removeDoc(boardId: string, folderId: string, docId: string) {
    const el = findElement(boardId, folderId)
    if (el?.type === 'folder') boards().update(boardId, ops.patch(folderId, { docs: el.docs.filter((d) => d.id !== docId) }))
  },
  pickDocs: (id: string) => editor().requestFilePick(id),
  hasThreads: (boardId: string, id: string) => !!boards().boards[boardId]?.threads.some((t) => t.from === id || t.to === id),
}
