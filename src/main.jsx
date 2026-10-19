// Teles viejas (Tizen 2–3): sin fetch ni AbortController nativos. En navegadores actuales no hacen nada.
import 'whatwg-fetch'
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { instalarFlexGapShim } from './lib/flexGapShim'

// Las TVs de la sala son Samsung Tizen 3.0 (Chrome 47): no tienen Proxy, que no se puede
// polyfillear, y Sentry lo usa al arrancar (tracing y replay) — sin esta guarda tira
// "Proxy is not defined" y la pantalla queda en blanco. Ahí la app corre sin Sentry.
const sentryPuedeCorrer = typeof Proxy === 'function' && typeof Reflect === 'object'

// Sentry va en un chunk aparte y sólo se baja donde puede correr: la TV no lo descarga ni lo compila.
function montar(contenido) {
  createRoot(document.getElementById('root')).render(contenido)
}

instalarFlexGapShim()

// Marca de etapa para el log de CDN de Vercel: el bundle de entrada llegó a ejecutarse.
if (window.__tvEtapa) window.__tvEtapa('bundle')

if (sentryPuedeCorrer) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: 'https://7b50329bdaf46ce9ebf4f4e34730c467@o4508958929911808.ingest.us.sentry.io/4511212965330944',
        sendDefaultPii: true,
        // Capture all unhandled errors, promise rejections, and console errors
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ],
        // Capture 100% of transactions in dev; tune down in production if needed
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      })
      montar(
        <Sentry.ErrorBoundary fallback={<p>Algo salió mal — el error fue reportado automáticamente.</p>} showDialog>
          <App />
        </Sentry.ErrorBoundary>
      )
    })
    .catch(() => montar(<App />))
} else {
  montar(<App />)
}
