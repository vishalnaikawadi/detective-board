import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { contentBounds } from '../../lib/geometry'
import { preloadImages } from '../../lib/images'
import { CORK_TILE, corkTexture } from '../../lib/texture'
import type { Board } from '../../types'
import { PinDefs } from './PushPin'
import { Scene } from './Scene'

// PNG export without third-party libraries: render the board off-screen,
// inline every image and font as a data URL, wrap the markup in an SVG
// <foreignObject>, and let the browser rasterize it onto a canvas.

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ExportResult {
  missingImages: number
}

const PADDING = 110
const MIN_W = 640
const MIN_H = 420
const MAX_SIDE = 8192
const MAX_PIXELS = 48e6

const dataUrlCache = new Map<string, Promise<string | null>>()

function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return Promise.resolve(url)
  let p = dataUrlCache.get(url)
  if (!p) {
    p = fetch(url, { mode: 'cors', cache: 'force-cache' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(fr.result as string)
            fr.onerror = () => reject(fr.error)
            fr.readAsDataURL(blob)
          }),
      )
      .catch(() => null)
    // Blob URLs are per-session; don't keep failures around.
    p.then((v) => v === null && dataUrlCache.delete(url))
    dataUrlCache.set(url, p)
  }
  return p
}

/** All same-origin CSS, with (latin) web fonts embedded so the SVG renders with them. */
async function collectCss(): Promise<string> {
  const parts: Promise<string>[] = []
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of [...rules]) {
      if (rule instanceof CSSFontFaceRule) {
        const m = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+\.woff2)["']?\)/)
        if (!m || !/-latin-(\d|wght)/.test(m[1])) continue
        const url = new URL(m[1], sheet.href ?? location.href).href
        parts.push(toDataUrl(url).then((d) => (d ? rule.cssText.replace(/src:[^;]+;/, `src: url("${d}") format("woff2");`) : '')))
      } else {
        parts.push(Promise.resolve(rule.cssText.replace(/:root\b/g, ':root, .export-root')))
      }
    }
  }
  return (await Promise.all(parts)).join('\n')
}

function exportBounds(board: Board, bounds?: Bounds): Bounds {
  const b = bounds ?? contentBounds(board.elements)
  if (!b) return { minX: -MIN_W / 2, minY: -MIN_H / 2, maxX: MIN_W / 2, maxY: MIN_H / 2 }
  const pad = bounds ? 0 : PADDING
  let { minX, minY, maxX, maxY } = { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }
  const grow = (lo: number, hi: number, min: number) => {
    const extra = Math.max(0, min - (hi - lo)) / 2
    return [lo - extra, hi + extra]
  }
  ;[minX, maxX] = grow(minX, maxX, MIN_W)
  ;[minY, maxY] = grow(minY, maxY, MIN_H)
  return { minX: Math.floor(minX), minY: Math.floor(minY), maxX: Math.ceil(maxX), maxY: Math.ceil(maxY) }
}

function ExportScene({ board, b }: { board: Board; b: Bounds }) {
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  return (
    <div
      className="export-root"
      style={{
        width: b.maxX - b.minX,
        height: b.maxY - b.minY,
        backgroundImage: `url(${corkTexture()})`,
        backgroundSize: `${CORK_TILE}px ${CORK_TILE}px`,
        backgroundPosition: `${-b.minX}px ${-b.minY}px`,
      }}
    >
      <PinDefs />
      <div className="canvas__light" />
      <div className="world" style={{ transform: `translate(${-b.minX}px, ${-b.minY}px)` }}>
        <Scene board={board} />
      </div>
      <div className="export-stamp">
        <span className="export-stamp__brand">Caseboard</span>
        <span className="export-stamp__sep">//</span>
        <span className="export-stamp__name">{board.name}</span>
        <span className="export-stamp__meta">
          {board.elements.length} clues · {board.threads.length} threads · {date}
        </span>
      </div>
    </div>
  )
}

export async function exportBoardPng(board: Board, bounds?: Bounds): Promise<ExportResult> {
  await document.fonts.ready
  await preloadImages(board.elements.flatMap((e) => (e.type === 'photo' && e.imageId ? [e.imageId] : [])))

  const b = exportBounds(board, bounds)
  const W = b.maxX - b.minX
  const H = b.maxY - b.minY

  // Render a static copy of the board off-screen.
  const host = document.createElement('div')
  host.className = 'export-host'
  document.body.append(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<ExportScene board={board} b={b} />))
    const clone = host.firstElementChild!.cloneNode(true) as HTMLElement

    // Swap each <img> for a div whose background comes from a shared CSS
    // variable, so repeated assets are embedded only once.
    const vars = new Map<string, string>()
    let missing = 0
    const imgs = [...clone.querySelectorAll('img')]
    const datas = await Promise.all(imgs.map((img) => toDataUrl(img.src)))
    imgs.forEach((img, i) => {
      const data = datas[i]
      const div = document.createElement('div')
      div.className = img.className
      div.style.cssText = img.style.cssText
      if (data) {
        if (!vars.has(data)) vars.set(data, `--img${vars.size}`)
        const cover = img.classList.contains('photo-img') || img.classList.contains('article__image')
        div.style.backgroundImage = `var(${vars.get(data)})`
        div.style.backgroundSize = cover ? 'cover' : '100% 100%'
        div.style.backgroundPosition = 'center'
        div.style.backgroundRepeat = 'no-repeat'
      } else {
        missing++
        div.classList.add('export-missing')
      }
      if (img.classList.contains('article__image')) div.style.height = 'auto'
      img.replaceWith(div)
    })

    const css = await collectCss()
    const varCss = `.export-root{${[...vars].map(([d, name]) => `${name}:url("${d}");`).join('')}}`
    const html = new XMLSerializer().serializeToString(clone)

    const ratio = Math.min(2, MAX_SIDE / Math.max(W, H), Math.sqrt(MAX_PIXELS / (W * H)))
    const pw = Math.round(W * ratio)
    const ph = Math.round(H * ratio)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${W} ${H}">` +
      `<foreignObject x="0" y="0" width="${W}" height="${H}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px">` +
      `<style><![CDATA[${css}\n${varCss}]]></style>${html}</div></foreignObject></svg>`

    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The browser could not render the board image.'))
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    })
    // Give the SVG document a moment to apply its embedded fonts.
    await new Promise((r) => setTimeout(r, 120))

    const canvas = document.createElement('canvas')
    canvas.width = pw
    canvas.height = ph
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#101b3a'
    ctx.fillRect(0, 0, pw, ph)
    ctx.drawImage(image, 0, 0, pw, ph)

    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((bl) => (bl ? resolve(bl) : reject(new Error('Export failed.'))), 'image/png')
      } catch {
        reject(new Error('This browser blocks exporting rendered pages. Try Chrome, Edge or Firefox.'))
      }
    })

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${slug(board.name)}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    return { missingImages: missing }
  } finally {
    root.unmount()
    host.remove()
  }
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'caseboard'
  )
}
