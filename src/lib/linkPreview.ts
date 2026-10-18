// Browsers can't read other sites' HTML directly (CORS), so article
// metadata comes from Microlink's free link-preview API.

export interface LinkPreview {
  title: string
  excerpt: string
  publisher?: string
  date?: string
  image?: string
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
  const json = await res.json()
  if (json.status !== 'success') throw new Error(json.message ?? 'Preview failed')
  const d = json.data ?? {}
  return {
    title: d.title || hostOf(url),
    excerpt: d.description || '',
    publisher: d.publisher || hostOf(url),
    date: d.date || undefined,
    image: d.image?.url || undefined,
  }
}
