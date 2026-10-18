import type { Board } from '../types'

// Thin promise wrapper over IndexedDB. Boards and image blobs live in
// separate stores so board saves stay small.

const DB_NAME = 'detective-board'
const DB_VERSION = 1
const BOARDS = 'boards'
const IMAGES = 'images'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(BOARDS)) db.createObjectStore(BOARDS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const db = {
  allBoards: () => run<Board[]>(BOARDS, 'readonly', (s) => s.getAll()),
  putBoard: (board: Board) => run(BOARDS, 'readwrite', (s) => s.put(board)),
  deleteBoard: (id: string) => run(BOARDS, 'readwrite', (s) => s.delete(id)),

  getImage: (id: string) => run<Blob | undefined>(IMAGES, 'readonly', (s) => s.get(id)),
  putImage: (id: string, blob: Blob) => run(IMAGES, 'readwrite', (s) => s.put(blob, id)),
  deleteImage: (id: string) => run(IMAGES, 'readwrite', (s) => s.delete(id)),
  imageKeys: () => run<IDBValidKey[]>(IMAGES, 'readonly', (s) => s.getAllKeys()),
}
