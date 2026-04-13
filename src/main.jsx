import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: 'https://7b50329bdaf46ce9ebf4f4e34730c467@o4508958929911808.ingest.us.sentry.io/4511212965330944',
  sendDefaultPii: true,
})

createRoot(document.getElementById('root')).render(<App />)
