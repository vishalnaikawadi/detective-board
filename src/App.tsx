import { useEffect } from 'react'
import { BoardPage } from './components/board/BoardPage'
import { HomePage } from './components/home/HomePage'
import { useRoute } from './lib/router'
import { useBoards } from './store/boards'

export function App() {
  const route = useRoute()
  const loaded = useBoards((s) => s.loaded)

  useEffect(() => {
    useBoards.getState().load()
  }, [])

  if (!loaded) return <div className="boot">Opening case files…</div>
  return route.name === 'board' ? <BoardPage id={route.id} /> : <HomePage />
}
