import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import TvPorSlug from './components/TvPorSlug'
import Anotarme from './components/Anotarme'
import TvIndex from './components/TvIndex'
import { TvErrorBoundary, ErrorDePrueba } from './components/TvAviso'

// El CRM entero va en un chunk aparte que el host de TV nunca baja. 2026-10-19: con todo en un solo
// bundle legacy de 3,4 MB, el Chrome 47 real (Tizen 3.0) se colgaba compilándolo y la A1 quedaba en
// blanco. Control: scripts/check-tv-legacy.mjs (tamaño del chunk de entrada legacy).
const MainApp = lazy(() => import('./MainApp'))

// tv.somostecnofit.com no es el CRM: es sólo las pantallas de TV, sin login ni sidebar. La
// decisión se toma acá, antes de cualquier hook, para no meter el chequeo de hostname dentro
// de un componente que ya llama useState/useEffect (rompería las reglas de hooks si alguna
// vez dejara de ser constante durante la vida del componente).
function esHostDeTv() {
  return typeof window !== 'undefined' && window.location.hostname.startsWith('tv.')
}

// Las mismas pantallas bajo /tv/... en cualquier host (preview de Vercel, localhost): van por el
// mismo router liviano, así se prueban con el bundle que baja la TV de verdad.
function esRutaDeTv() {
  return typeof window !== 'undefined' && /^\/tv(\/|$)/.test(window.location.pathname)
}

function App() {
  if (esHostDeTv()) return <TvHostApp />
  if (esRutaDeTv()) return <TvHostApp basename="/tv" />
  return (
    <Suspense fallback={null}>
      <MainApp />
    </Suspense>
  )
}

// El router completo de tv.somostecnofit.com: nada de auth, nada de sidebar — sólo las tres
// pantallas de TV resueltas por slug (/palermo, /palermo/A, /palermo/A/1).
function TvHostApp({ basename }) {
  return (
    <TvErrorBoundary>
      <ErrorDePrueba />
      <Router basename={basename}>
        <Routes>
          <Route path="/" element={<TvIndex />} />
          <Route path="/anotarme" element={<Anotarme />} />
          <Route path="/:sede" element={<TvPorSlug modo="sede" />} />
          <Route path="/:sede/:linea" element={<TvPorSlug modo="linea" />} />
          <Route path="/:sede/:linea/:estacion" element={<TvPorSlug modo="estacion" />} />
        </Routes>
      </Router>
    </TvErrorBoundary>
  )
}

export default App
