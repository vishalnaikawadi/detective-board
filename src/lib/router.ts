import { useSyncExternalStore } from 'react'

export type Route = { name: 'home' } | { name: 'board'; id: string }

function parse(hash: string): Route {
  const m = hash.match(/^#\/board\/([^/?#]+)/)
  return m ? { name: 'board', id: decodeURIComponent(m[1]) } : { name: 'home' }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function navigate(route: Route) {
  window.location.hash = route.name === 'board' ? `#/board/${encodeURIComponent(route.id)}` : '#/'
}
