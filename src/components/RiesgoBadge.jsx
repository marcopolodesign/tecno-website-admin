import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

// El riesgo va con el nombre, no escondido en una pantalla de métricas: quien atiende la
// sala — o quien mira la ficha del socio — es quien puede hacer algo al respecto. Compartido
// entre QueueMonitor (sala), Users (ficha completa) y cualquier otro lugar que muestre un
// socio. `riesgo` es el risk_bucket ('very_good' | 'good' | 'risk' | 'high_risk') que devuelven
// riesgo_socio()/riesgo_socios(); sin fila (sin visitas previas) llega como null/undefined.
export const RIESGO_TEXTO = { high_risk: 'Alto riesgo', risk: 'Riesgo', good: 'Bien', very_good: 'Muy bien' }
export const RIESGO_TONO = {
  high_risk: 'bg-error/10 text-error',
  risk: 'bg-warning/10 text-warning',
  good: 'bg-info/10 text-info',
  very_good: 'bg-success/10 text-success',
}

// mostrarSinDatos: por default el badge desaparece si no hay riesgo (mismo comportamiento de
// siempre en las listas de la sala, donde el vacío ya se explica solo). En una ficha de socio
// el riesgo tiene que estar SIEMPRE — ahí se pasa mostrarSinDatos para que en vez de
// desaparecer muestre "Sin visitas previas".
export default function RiesgoBadge({ riesgo, dias, compact = false, mostrarSinDatos = false }) {
  if (!riesgo || !RIESGO_TEXTO[riesgo]) {
    if (!mostrarSinDatos) return null
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap bg-bg-surface text-text-tertiary">
        Sin visitas previas
      </span>
    )
  }
  const alerta = riesgo === 'high_risk' || riesgo === 'risk'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${RIESGO_TONO[riesgo]}`}>
      {alerta && <ExclamationTriangleIcon className="h-3 w-3" />}
      {RIESGO_TEXTO[riesgo]}
      {dias != null && (compact ? ` · ${dias}d` : ` · ${dias}d sin venir`)}
    </span>
  )
}
