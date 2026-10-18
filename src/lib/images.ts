import { useEffect, useState } from 'react'
import { db } from './db'
import { uid } from './id'

const MAX_DIM = 1600
const urlCache = new Map<string, string>()

const HEIC_EXT = /\.(heic|heif)$/i

/** iPhone photos (HEIC/HEIF). Some browsers report an empty MIME type, so check the name too. */
export function isHeic(file: Blob) {
  return /^image\/hei[cf]/i.test(file.type) || HEIC_EXT.test((file as File).name ?? '')
}

export function isImageFile(f: File) {
  return f.type.startsWith('image/') || HEIC_EXT.test(f.name)
}

/** File-picker filter for photos, listing HEIC explicitly so it's selectable everywhere. */
export const IMAGE_ACCEPT = 'image/*,.heic,.heif'

export class UnreadableImageError extends Error {
  constructor(heic: boolean) {
    super(heic ? 'Couldn’t read that HEIC photo — try exporting it as JPEG.' : 'That file isn’t an image this browser can read.')
  }
}

/**
 * Decode any supported photo into something every browser can display.
 * Only Safari decodes HEIC natively, so elsewhere it's converted to JPEG with
 * libheif (WebAssembly), which is downloaded on first use only.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    if (!isHeic(file)) throw new UnreadableImageError(false)
  }
  try {
    const { heicTo } = await import('heic-to')
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
    return await createImageBitmap(jpeg)
  } catch {
    throw new UnreadableImageError(true)
  }
}

/** Downscale large photos (and re-encode HEIC) before storing them, so IndexedDB stays lean. */
async function normalize(file: Blob): Promise<Blob> {
  const bmp = await decode(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size < 1.5e6 && !isHeic(file)) {
    bmp.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88))
  if (!blob) throw new UnreadableImageError(isHeic(file))
  return blob
}

/** Store a photo for an element. Throws `UnreadableImageError` if it can't be decoded. */
export async function storeImage(file: Blob): Promise<string> {
  const id = uid('img')
  const blob = await normalize(file)
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
