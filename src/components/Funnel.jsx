import { useCallback, useEffect, useState } from 'react'
import { useSede } from '../contexts/SedeContext'
import funnelService from '../services/funnelService'
import BandaEmbudo from './funnel/BandaEmbudo'
import ListaPersonas from './funnel/ListaPersonas'
import { PERIOD_PRESETS, CUSTOM_PERIOD_ID, resolvePeriod } from '../utils/metricPeriods'

const POR_PAGINA = 50

// Pantalla de Embudo. No reemplaza a Leads, Prospects ni Socios: esas tres siguen siendo
// las listas donde se trabaja. Ésta contesta la pregunta que ninguna de las tres puede
// contestar sola — en qué paso se está cayendo la gente.
//
// El período filtra por CUÁNDO ENTRÓ la persona, no por cuándo avanzó. Así el embudo es
// una cohorte fija: "de los que entraron en septiembre, cuántos llegaron a socio". Si
// filtrara por fecha de avance, la misma persona entraría y saldría de cada etapa según
// el rango y los porcentajes no cerrarían.
export default function Funnel() {
  const { sedeId, sede } = useSede()

  const [periodId, setPeriodId] = useState('last_90')
  const [rangoCustom, setRangoCustom] = useState({ start: '', end: '' })

  const [etapas, setEtapas] = useState([])
  const [cargandoEtapas, setCargandoEtapas] = useState(true)
  const [errorEtapas, setErrorEtapas] = useState(null)

  const [etapaActiva, setEtapaActiva] = useState(null)
  const [soloEstancados, setSoloEstancados] = useState(false)
  const [personas, setPersonas] = useState([])
  const [totalPersonas, setTotalPersonas] = useState(0)
  const [cargandoPersonas, setCargandoPersonas] = useState(false)
  const [errorPersonas, setErrorPersonas] = useState(null)

  const { start, end } = resolvePeriod(periodId, rangoCustom)

  useEffect(() => {
    let cancelado = false
    setCargandoEtapas(true)
    setErrorEtapas(null)
    funnelService
      .getEtapas({ sedeId, start, end })
      .then((data) => !cancelado && setEtapas(data))
      .catch((err) => !cancelado && setErrorEtapas(err))
      .finally(() => !cancelado && setCargandoEtapas(false))
    return () => { cancelado = true }
  }, [sedeId, start, end])

  const cargarPersonas = useCallback(
    (offset = 0) => {
      if (!etapaActiva) return
      setCargandoPersonas(true)
      setErrorPersonas(null)
      funnelService
        .getPersonas({ etapa: etapaActiva, sedeId, start, end, soloEstancados, limit: POR_PAGINA, offset })
        .then((data) => {
          setTotalPersonas(Number(data[0]?.total ?? 0))
          setPersonas((prev) => (offset === 0 ? data : [...prev, ...data]))
        })
        .catch((err) => setErrorPersonas(err))
        .finally(() => setCargandoPersonas(false))
    },
    [etapaActiva, sedeId, start, end, soloEstancados],
  )

  // Cambiar de etapa, de modo o de filtro arranca la lista de cero — paginar sobre una
  // consulta distinta a la que trajo las filas anteriores mezcla dos listas.
  useEffect(() => {
    setPersonas([])
    setTotalPersonas(0)
    cargarPersonas(0)
  }, [cargarPersonas])

  const etapaElegida = etapas.find((e) => e.orden === etapaActiva)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Embudo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {sede ? sede.name : 'Todas las sedes'} · de la primera consulta al socio que entrena
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
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

          {periodId === CUSTOM_PERIOD_ID && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="date"
                value={rangoCustom.start}
                max={rangoCustom.end || undefined}
                onChange={(e) => setRangoCustom((r) => ({ ...r, start: e.target.value }))}
                className="input-field px-2 py-1 text-xs"
                aria-label="Desde"
              />
              <span>a</span>
              <input
                type="date"
                value={rangoCustom.end}
                min={rangoCustom.start || undefined}
                onChange={(e) => setRangoCustom((r) => ({ ...r, end: e.target.value }))}
                className="input-field px-2 py-1 text-xs"
                aria-label="Hasta"
              />
            </div>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-none">
        {cargandoEtapas ? (
          <div className="flex h-56 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : errorEtapas ? (
          <div className="rounded-lg bg-error/5 p-4">
            <p className="text-sm font-medium text-error">No se pudo cargar el embudo</p>
            <p className="mt-0.5 text-xs text-text-secondary">{errorEtapas.message}</p>
          </div>
        ) : !etapas.length || Number(etapas[0]?.cuenta ?? 0) === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-text-secondary">Todavía no entró nadie en el período elegido.</p>
            <p className="text-xs text-text-tertiary">Probá con un rango más largo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <BandaEmbudo etapas={etapas} etapaActiva={etapaActiva} onSelect={setEtapaActiva} />
          </div>
        )}
      </div>

      <ListaPersonas
        etapa={etapaActiva}
        etiqueta={etapaElegida?.etiqueta}
        personas={personas}
        total={totalPersonas}
        loading={cargandoPersonas}
        error={errorPersonas}
        soloEstancados={soloEstancados}
        onToggleEstancados={() => setSoloEstancados((v) => !v)}
        onVerMas={() => cargarPersonas(personas.length)}
        hayMas={personas.length < totalPersonas}
      />
    </div>
  )
}
