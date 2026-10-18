import { createContext, useContext, useEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { ops, useBoards, type Snapshot } from '../../../store/boards'
import { useEditor } from '../../../store/editor'
import type { BoardElement } from '../../../types'

/** Set by the interactive canvas; thumbnails render without it. */
export const BoardContext = createContext<string | null>(null)

export function useBoardId() {
  return useContext(BoardContext)
}

export function patchElement(boardId: string, id: string, patch: Partial<BoardElement>, record = true) {
  useBoards.getState().update(boardId, ops.patch(id, patch), record)
}

/** Stops canvas drag/selection from starting on interactive controls inside an element. */
export const stopCanvas = {
  onPointerDown: (e: PointerEvent) => {
    // In thread mode, the whole element is a click target for tying thread.
    if (useEditor.getState().mode !== 'thread') e.stopPropagation()
  },
  onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
}

interface EditableProps {
  elementId: string
  value: string
  field: string
  className: string
  placeholder?: string
  maxLength?: number
  singleLine?: boolean
}

/**
 * Textarea that edits one text field of an element. Keystrokes update the
 * board live; the whole edit becomes a single undo step on blur.
 */
export function EditableText({ elementId, value, field, className, placeholder, maxLength, singleLine }: EditableProps) {
  const boardId = useBoardId()!
  const ref = useRef<HTMLTextAreaElement>(null)
  const before = useRef<Snapshot | null>(null)

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [])

  return (
    <textarea
      ref={ref}
      className={`${className} editable`}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      spellCheck={false}
      {...stopCanvas}
      onFocus={() => (before.current = useBoards.getState().snapshot(boardId))}
      onChange={(e) => {
        const v = singleLine ? e.target.value.replace(/\n/g, ' ') : e.target.value
        patchElement(boardId, elementId, { [field]: v } as Partial<BoardElement>, false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (singleLine && e.key === 'Enter') || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          ref.current?.blur()
        }
        e.stopPropagation()
      }}
      onBlur={() => {
        if (before.current) useBoards.getState().pushHistory(boardId, before.current)
        before.current = null
        if (useEditor.getState().editingId === elementId) useEditor.getState().setEditing(null)
      }}
    />
  )
}
