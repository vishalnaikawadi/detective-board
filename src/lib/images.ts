import { useEffect, useState } from 'react'
import { db } from './db'
import { uid } from './id'

const MAX_DIM = 1600
const urlCache = new Map<string, string>()

/** Downscale large photos before storing them, so IndexedDB stays lean. */
async function shrink(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 1.5e6) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.88))
  } catch {
    return file
  }
}

export async function storeImage(file: Blob): Promise<string> {
  const id = uid('img')
  const blob = await shrink(file)
  await db.putImage(id, blob)
  urlCache.set(id, URL.createObjectURL(blob))
  return id
}

export function useImageUrl(imageId?: string, fallbackUrl?: string): string | undefined {
  const [url, setUrl] = useState(() => (imageId ? urlCache.get(imageId) : undefined))

  useEffect(() => {
    if (!imageId) return setUrl(undefined)
    const cached = urlCache.get(imageId)
    if (cached) return setUrl(cached)
    let alive = true
    db.getImage(imageId).then((blob) => {
      if (!blob || !alive) return
      const u = URL.createObjectURL(blob)
      urlCache.set(imageId, u)
      setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [imageId])

  return imageId ? url : fallbackUrl
}

export function isImageFile(f: File) {
  return f.type.startsWith('image/')
}

/** Make sure uploaded photos have object URLs before a synchronous render (e.g. export). */
export async function preloadImages(ids: string[]) {
  await Promise.all(
    ids
      .filter((id) => !urlCache.has(id))
      .map(async (id) => {
        const blob = await db.getImage(id)
        if (blob) urlCache.set(id, URL.createObjectURL(blob))
      }),
  )
}

// ---- Documents (folder contents) -------------------------------------------

export const MAX_DOC_BYTES = 100 * 1024 * 1024

export async function storeFile(file: File): Promise<string> {
  const id = uid('doc')
  await db.putImage(id, file)
  return id
}

/** Types the browser can show in a tab; everything else is downloaded. */
const VIEWABLE = /^(application\/pdf|image\/|text\/|video\/|audio\/)/

export async function openFile(id: string, name: string) {
  const blob = await db.getImage(id)
  if (!blob) throw new Error('This file is missing from local storage.')
  const url = URL.createObjectURL(blob)
  if (VIEWABLE.test(blob.type) && window.open(url, '_blank', 'noopener')) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
