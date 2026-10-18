import { getTool, getVariant } from './catalog'
import { uid } from './id'
import type { BoardElement, ElementType, Point } from '../types'

const randomTilt = (max: number) => Math.round((Math.random() * 2 - 1) * max * 10) / 10

export function makeElement(type: ElementType, variant: string, at: Point, z: number): BoardElement {
  const tool = getTool(type)
  // Some tools (newspaper) pick their paper at random for variety.
  const v = tool.random ? tool.variants[Math.floor(Math.random() * tool.variants.length)] : getVariant(type, variant)
  const w = v.width
  const h = Math.round((w * v.natural.h) / v.natural.w)
  const base = { id: uid('el'), variant: v.id, x: at.x, y: at.y, w, h, z, rotation: randomTilt(type === 'article' || type === 'map' || type === 'folder' ? 2 : 3.5) }
  switch (type) {
    case 'photo':
      return { ...base, type, caption: '' }
    case 'sticky':
      return { ...base, type, text: '' }
    case 'note':
      return { ...base, type, text: '' }
    case 'article':
      return { ...base, type, url: '', status: 'empty', title: '', excerpt: '' }
    case 'map':
      return { ...base, type, status: 'empty', lat: 0, lon: 0, zoom: 3, label: '', markers: [] }
    case 'folder':
      return { ...base, type, label: '', docs: [] }
  }
}

export function duplicateElement(el: BoardElement, z: number): BoardElement {
  return { ...el, id: uid('el'), x: el.x + 32, y: el.y + 32, z }
}
