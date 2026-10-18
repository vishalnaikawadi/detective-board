// Web-Mercator helpers, tile URLs and place search for map clippings.

export const TILE = 256
/** Internal map width in map pixels; the printed map is scaled to fit the clipping. */
export const MAP_W = 380
export const MIN_MAP_ZOOM = 3
export const MAX_MAP_ZOOM = 18

export const ATTRIBUTION = '© OpenStreetMap contributors'

/** Longitude/latitude → global pixel coordinates at zoom z. */
export function project(lat: number, lon: number, z: number) {
  const scale = TILE * 2 ** z
  const sin = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180)
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

export function unproject(x: number, y: number, z: number) {
  const scale = TILE * 2 ** z
  const lon = (x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lon: ((((lon + 180) % 360) + 360) % 360) - 180 }
}

export function tileUrl(x: number, y: number, z: number) {
  const n = 2 ** z
  const wx = ((x % n) + n) % n
  // OpenStreetMap's standard tiles: free with attribution, CORS-enabled (needed for PNG export).
  return `https://tile.openstreetmap.org/${z}/${wx}/${y}.png`
}

export interface PlaceResult {
  id: string
  name: string
  city?: string
  detail: string
  lat: number
  lon: number
  zoom: number
}

/** Pick a zoom level that fits a result's bounding box into a map of the given width. */
function zoomForBox(box: string[] | undefined, width: number) {
  if (!box) return 15
  const [s, n, w, e] = box.map(Number)
  const lonSpan = Math.max(Math.abs(e - w), 0.0005)
  const latSpan = Math.max(Math.abs(n - s), 0.0005)
  const z = Math.min(Math.log2((width * 360) / (TILE * lonSpan)), Math.log2((width * 0.75 * 170) / (TILE * latSpan)))
  return Math.max(MIN_MAP_ZOOM, Math.min(17, Math.floor(z)))
}

interface NominatimRow {
  place_id: number
  name?: string
  display_name: string
  lat: string
  lon: string
  type?: string
  addresstype?: string
  boundingbox?: string[]
  address?: Record<string, string>
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const ROAD_TYPES = /^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|pedestrian|road)$/

function placeKind(r: NominatimRow) {
  const t = r.type || r.addresstype || ''
  if (ROAD_TYPES.test(t)) return 'Street'
  return t && t !== 'yes' ? titleCase(t) : ''
}

// Nominatim's usage policy: searches only on explicit submit, no autocomplete.
export async function searchPlaces(query: string, mapWidth: number): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const rows: NominatimRow[] = await res.json()
  const seen = new Set<string>()
  return rows.flatMap((r) => {
    const a = r.address ?? {}
    const name = r.name || r.display_name.split(',')[0].trim()
    const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || a.state
    const area = a.suburb || a.neighbourhood || a.quarter
    const kind = placeKind(r)
    const where = [area, city, a.country].filter((p, i, all) => p && p !== name && all.indexOf(p) === i)
    const detail = [kind, where.join(', ')].filter(Boolean).join(' · ')
    // Long streets come back as several segments; keep one.
    if (seen.has(name + detail)) return []
    seen.add(name + detail)
    return {
      id: String(r.place_id),
      name,
      city: city && city !== name ? city : undefined,
      detail,
      lat: Number(r.lat),
      lon: Number(r.lon),
      zoom: zoomForBox(r.boundingbox, mapWidth),
    }
  })
}

/** Short typed label for the clipping, e.g. "Baker Street, London". */
export function placeLabel(p: PlaceResult) {
  return p.city ? `${p.name}, ${p.city}` : p.name
}
