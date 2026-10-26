// Presets de rango de fechas para el panel de métricas de negocio. Devuelven fechas
// YYYY-MM-DD (lo que esperan los RPC de Postgres) o null para "sin filtro" (todo el
// historial).

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

// Los tramos cortos (7 y 15) son para mirar la semana en curso; los largos, para ver
// tendencia. "Custom" no está acá porque no es un preset: sus fechas las elige el usuario.
export const PERIOD_PRESETS = [
  { id: 'last_7', label: 'Últimos 7 días', dias: 7 },
  { id: 'last_15', label: 'Últimos 15 días', dias: 15 },
  { id: 'last_30', label: 'Últimos 30 días', dias: 30 },
  { id: 'last_90', label: 'Últimos 90 días', dias: 90 },
  { id: 'all', label: 'Todo el historial', dias: null },
]

export const CUSTOM_PERIOD_ID = 'custom'

/**
 * @param {string} presetId  id de PERIOD_PRESETS, o 'custom'
 * @param {{start?: string, end?: string}} custom  fechas YYYY-MM-DD, sólo para 'custom'
 */
export function resolvePeriod(presetId, custom = {}) {
  if (presetId === CUSTOM_PERIOD_ID) {
    // Un rango a medio completar no se aplica: filtrar por la mitad daría un número
    // que parece real y no lo es. Hasta que estén las dos puntas, es todo el historial.
    if (!custom.start || !custom.end) return { start: null, end: null }
    // Al revés tampoco: si eligió el fin antes que el inicio, se ordenan solos.
    return custom.start <= custom.end
      ? { start: custom.start, end: custom.end }
      : { start: custom.end, end: custom.start }
  }

  const preset = PERIOD_PRESETS.find((p) => p.id === presetId)
  if (!preset || preset.dias == null) return { start: null, end: null }

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - preset.dias)
  return { start: toISODate(start), end: toISODate(now) }
}

export function etiquetaDePeriodo(presetId, custom = {}) {
  if (presetId === CUSTOM_PERIOD_ID) {
    if (!custom.start || !custom.end) return 'Elegí las dos fechas'
    return `${custom.start} → ${custom.end}`
  }
  return PERIOD_PRESETS.find((p) => p.id === presetId)?.label ?? ''
}
