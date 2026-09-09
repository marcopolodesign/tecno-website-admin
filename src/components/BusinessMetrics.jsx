import { useCallback, useEffect, useState } from 'react'
import { useSede } from '../contexts/SedeContext'
import { BUSINESS_METRICS_REGISTRY } from '../config/businessMetricsCharts'
import businessMetricsService from '../services/businessMetricsService'
import BenchmarksPanel from './business-metrics/BenchmarksPanel'
import { PERIOD_PRESETS, CUSTOM_PERIOD_ID, resolvePeriod } from '../utils/metricPeriods'

// Tailwind necesita clases literales en el código fuente para generarlas — un template
// literal con colSpan interpolado no lo detecta el scanner. Mapa estático en vez de eso.
const COL_SPAN_CLASS = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  12: 'lg:col-span-12',
}

// Panel de métricas de negocio del dueño (Sprint 6): conversión lead -> clase de prueba,
// clase de prueba -> alumno, retención por coach/recepción, frecuencia de asistencia y
// predicción de abandono. Sede se lee del selector global (SedeContext) — esta pantalla no
// inventa su propio filtro. El período es local a esta pantalla, con presets simples.
export default function BusinessMetrics() {
  const { sedeId, sede } = useSede()
  const [periodId, setPeriodId] = useState('last_30')
  const [rangoCustom, setRangoCustom] = useState({ start: '', end: '' })
  const [benchmarks, setBenchmarks] = useState({})
  const [benchmarksVersion, setBenchmarksVersion] = useState(0)

  const loadBenchmarks = useCallback(() => {
    businessMetricsService
      .getBenchmarks()
      .then((rows) => {
        const map = {}
        rows.forEach((r) => { map[r.metric_key] = r.target_value })
        setBenchmarks(map)
      })
      .catch(() => {
        // El panel de benchmarks ya muestra su propio error si falla la carga acá abajo —
        // si falla justo esta llamada, los charts simplemente no dibujan línea de benchmark.
      })
  }, [])

  useEffect(() => { loadBenchmarks() }, [loadBenchmarks, benchmarksVersion])

  const { start, end } = resolvePeriod(periodId, rangoCustom)

  const ctx = { sedeId, start, end, benchmarks }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Métricas de negocio</h1>
          <p className="text-sm text-text-secondary mt-1">
            {sede ? sede.name : 'Todas las sedes'} · trazabilidad de cada alumno a un coach y a quien lo recibió en recepción
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {[...PERIOD_PRESETS, { id: CUSTOM_PERIOD_ID, label: 'Rango a medida' }].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodId(p.id)}
                className={
                  p.id === periodId
                    ? 'status-badge bg-brand/10 text-brand'
                    : 'status-badge bg-bg-surface text-text-secondary hover:bg-bg-surface-hover transition-colors'
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Las dos fechas aparecen sólo cuando el rango a medida está elegido: ocupar
              lugar fijo con dos inputs vacíos ensucia la fila para el caso normal. */}
          {periodId === CUSTOM_PERIOD_ID && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="date"
                value={rangoCustom.start}
                max={rangoCustom.end || undefined}
                onChange={(e) => setRangoCustom((r) => ({ ...r, start: e.target.value }))}
                className="input-field py-1 px-2 text-xs"
                aria-label="Desde"
              />
              <span>a</span>
              <input
                type="date"
                value={rangoCustom.end}
                min={rangoCustom.start || undefined}
                onChange={(e) => setRangoCustom((r) => ({ ...r, end: e.target.value }))}
                className="input-field py-1 px-2 text-xs"
                aria-label="Hasta"
              />
              {(!rangoCustom.start || !rangoCustom.end) && (
                <span className="text-text-tertiary">— mientras falte una fecha se muestra todo el historial</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {BUSINESS_METRICS_REGISTRY.map((chart) => (
          <div key={chart.id} className={`col-span-1 ${COL_SPAN_CLASS[chart.colSpan] || 'lg:col-span-6'}`}>
            <chart.component {...chart.getProps(ctx)} />
          </div>
        ))}
      </div>

      <BenchmarksPanel onChange={() => setBenchmarksVersion((v) => v + 1)} />
    </div>
  )
}
