import type { CSSProperties } from 'react'
import type { ElementType } from '../types'

/** A rectangle in percent of the element box, optionally rotated about its center. */
export interface Region {
  left: number
  top: number
  width: number
  height: number
  rotate?: number
}

export interface VariantDef {
  id: string
  label: string
  src: string
  /** Natural pixel size of the (cropped) asset, used for aspect ratio. */
  natural: { w: number; h: number }
  /** Default width in world units when dropped on the board. */
  width: number
  /** Where the push-pin goes, as a fraction of the element box. */
  pin: [number, number]
  /** Photo window corners (TL, TR, BR, BL) in percent — photos only. */
  window?: [number, number][]
  /** Caption area for photos, writing area for notes, content area for articles. */
  text: Region
  /** Lined paper: distance between ruled lines, in percent of element height. */
  lineSpacing?: number
  /** Map clippings: where the printed map sits. */
  area?: Region
}

export interface ToolDef {
  type: ElementType
  label: string
  variants: VariantDef[]
  /** Each new element gets a random variant instead of a user-chosen one. */
  random?: boolean
}

// Geometry measured from the cropped PNGs in /public/assets.
export const TOOLS: ToolDef[] = [
  {
    type: 'photo',
    label: 'Photo',
    variants: [
      {
        id: 'polaroid-tilt-left',
        label: 'Polaroid',
        src: '/assets/photo_frame.png',
        natural: { w: 826, h: 1000 },
        width: 250,
        pin: [0.47, 0.042],
        window: [
          [7.51, 7.7],
          [82.93, 4.5],
          [86.92, 71.7],
          [11.5, 74.7],
        ],
        text: { left: 12, top: 77, width: 76, height: 11, rotate: -2.9 },
      },
      {
        id: 'polaroid-tilt-right',
        label: 'Polaroid (tilted)',
        src: '/assets/photo_frame_2.png',
        natural: { w: 863, h: 1000 },
        width: 255,
        pin: [0.52, 0.047],
        window: [
          [16.1, 4.6],
          [87.95, 8.8],
          [80.19, 75.9],
          [8.69, 69.0],
        ],
        text: { left: 9, top: 75.5, width: 72, height: 11.5, rotate: 3.9 },
      },
    ],
  },
  {
    type: 'sticky',
    label: 'Sticky note',
    variants: [
      {
        id: 'yellow',
        label: 'Yellow',
        src: '/assets/sticky_note.png',
        natural: { w: 686, h: 820 },
        width: 210,
        pin: [0.5, 0.2],
        text: { left: 11, top: 27, width: 76, height: 61, rotate: 2.5 },
      },
      {
        id: 'pink',
        label: 'Pink',
        src: '/assets/sticky_note_pink.png',
        natural: { w: 686, h: 820 },
        width: 210,
        pin: [0.5, 0.2],
        text: { left: 11, top: 27, width: 76, height: 61, rotate: 2.5 },
      },
    ],
  },
  {
    type: 'note',
    label: 'Lined note',
    variants: [
      {
        id: 'lined',
        label: 'Lined paper',
        src: '/assets/lined_note.png',
        natural: { w: 626, h: 1000 },
        width: 220,
        pin: [0.45, 0.07],
        text: { left: 7.5, top: 14.3, width: 83, height: 75.5 },
        lineSpacing: 4.72,
      },
    ],
  },
  {
    type: 'article',
    label: 'Newspaper',
    random: true,
    variants: [
      {
        id: 'torn',
        label: 'Torn clipping',
        src: '/assets/torn_paper.png',
        natural: { w: 820, h: 682 },
        width: 420,
        pin: [0.5, 0.075],
        text: { left: 15, top: 13.5, width: 69, height: 72 },
      },
      {
        id: 'torn-tall',
        label: 'Torn page',
        src: '/assets/torn_paper_2.png',
        natural: { w: 658, h: 900 },
        width: 340,
        pin: [0.5, 0.05],
        text: { left: 13, top: 8, width: 70, height: 79 },
      },
    ],
  },
  {
    type: 'map',
    label: 'Map',
    variants: [
      {
        id: 'paper',
        label: 'Printed map',
        src: '/assets/map_paper.svg',
        natural: { w: 380, h: 330 },
        width: 380,
        pin: [0.5, 0.05],
        area: { left: 5, top: 5.5, width: 90, height: 76 },
        text: { left: 6, top: 84, width: 88, height: 11 },
      },
    ],
  },
  {
    type: 'folder',
    label: 'Case folder',
    variants: [
      {
        id: 'manila',
        label: 'Manila folder',
        src: '/assets/file_folder.png',
        natural: { w: 699, h: 900 },
        width: 300,
        pin: [0.56, 0.035],
        // Writable front of the folder (right of the tab, inside the edges).
        text: { left: 16, top: 6, width: 72, height: 83 },
      },
    ],
  },
]

export function getTool(type: ElementType): ToolDef {
  return TOOLS.find((t) => t.type === type)!
}

export function getVariant(type: ElementType, variant: string): VariantDef {
  const tool = getTool(type)
  return tool.variants.find((v) => v.id === variant) ?? tool.variants[0]
}

export function regionStyle(r: Region): CSSProperties {
  return {
    left: `${r.left}%`,
    top: `${r.top}%`,
    width: `${r.width}%`,
    height: `${r.height}%`,
    transform: r.rotate ? `rotate(${r.rotate}deg)` : undefined,
  }
}
