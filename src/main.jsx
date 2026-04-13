import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

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

createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<p>Algo salió mal — el error fue reportado automáticamente.</p>} showDialog>
    <App />
  </Sentry.ErrorBoundary>
)
