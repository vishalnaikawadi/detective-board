import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/700.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/old-standard-tt/400.css'
import './styles/global.css'
import './styles/home.css'
import './styles/board.css'
import './styles/elements.css'
import './styles/dock.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
