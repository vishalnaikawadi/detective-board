// Procedural, seamlessly tiling cork texture tinted for the dark navy theme.
// Generated once on a canvas and reused as a CSS background image.

export const CORK_TILE = 384

let cached: string | null = null

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function corkTexture(): string {
  if (cached) return cached
  const S = CORK_TILE
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')!
  const rand = rng(1337)

  ctx.fillStyle = '#101b3a'
  ctx.fillRect(0, 0, S, S)

  // Draw a blob at every wrapped position so the tile repeats seamlessly.
  const blob = (x: number, y: number, rx: number, ry: number, rot: number, color: string) => {
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        const px = x + dx
        const py = y + dy
        if (px < -rx * 2 || px > S + rx * 2 || py < -ry * 2 || py > S + ry * 2) continue
        ctx.beginPath()
        ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
  }

  // Soft mottling.
  for (let i = 0; i < 140; i++) {
    const l = 9 + rand() * 9
    blob(rand() * S, rand() * S, 10 + rand() * 30, 8 + rand() * 24, rand() * Math.PI, `hsla(222, 42%, ${l}%, 0.25)`)
  }
  // Cork granules.
  for (let i = 0; i < 5200; i++) {
    const r = 0.5 + Math.pow(rand(), 2.4) * 3.2
    const l = 7 + rand() * 20
    const s = 28 + rand() * 22
    blob(rand() * S, rand() * S, r, r * (0.55 + rand() * 0.45), rand() * Math.PI, `hsla(${215 + rand() * 14}, ${s}%, ${l}%, ${0.45 + rand() * 0.5})`)
  }
  // Dark pits.
  for (let i = 0; i < 420; i++) {
    const r = 0.6 + rand() * 1.8
    blob(rand() * S, rand() * S, r, r * 0.7, rand() * Math.PI, `rgba(2, 5, 16, ${0.35 + rand() * 0.4})`)
  }
  // Fine grain.
  const img = ctx.getImageData(0, 0, S, S)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 14
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)

  cached = canvas.toDataURL('image/png')
  return cached
}
