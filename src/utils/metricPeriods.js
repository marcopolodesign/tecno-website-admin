// Presets de rango de fechas para el panel de métricas de negocio. Devuelven fechas
// YYYY-MM-DD (lo que esperan los RPC de Postgres) o null para "sin filtro" (todo el
// historial).

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

export const PERIOD_PRESETS = [
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_30', label: 'Últimos 30 días' },
  { id: 'last_90', label: 'Últimos 90 días' },
  { id: 'all', label: 'Todo el historial' },
]

export function resolvePeriod(presetId) {
  const now = new Date()

  if (presetId === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: toISODate(start), end: toISODate(now) }
  }
  if (presetId === 'last_30') {
    const start = new Date(now)
    start.setDate(start.getDate() - 30)
    return { start: toISODate(start), end: toISODate(now) }
  }
  if (presetId === 'last_90') {
    const start = new Date(now)
    start.setDate(start.getDate() - 90)
    return { start: toISODate(start), end: toISODate(now) }
  }
  // 'all'
  return { start: null, end: null }
}
