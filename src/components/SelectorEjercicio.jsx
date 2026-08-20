import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mediaUrl } from '../lib/exerciseMedia'

// Picking the exercise for a station.
//
// It replaced a <select> grouped by body zone, which listed thirteen of the catalog's 309
// exercises — the demo rows are the only ones carrying a category — and which let a coach put
// an exercise in a box holding none of the equipment it needs, because the station was chosen
// separately and filtered nothing.
//
// So the station is the first filter, not an afterthought, and it means every box at that
// position: a routine is written once and run on whichever línea the queue assigns.
//
// Choosing an exercise is recognising it, not reading its name off a list. The video that was
// filmed for the box screen is the same thing that makes a row recognisable here, so the
// thumbnail is the row.

// A cooldown belongs to the session, not to a station, so it searches the whole catalog. Only
// station work is constrained by equipment — and when a station is expected but not yet chosen,
// saying so beats showing a list that is about to change under the coach.
const FALTA_ESTACION =
  'Elegí primero la estación: lo que se puede hacer depende del material que hay ahí.'

export default function SelectorEjercicio({
  estacion,
  boxId,
  value,
  onChange,
  soloConVideo = false,
  esperaEstacion = true,
}) {
  const [q, setQ] = useState('')
  const [musculos, setMusculos] = useState([])
  const [opcionesMusculo, setOpcionesMusculo] = useState([])
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [elegido, setElegido] = useState(null)
  const [falta, setFalta] = useState([])
  const pedido = useRef(0)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('exercises_catalogo')
        .select('musculo')
        .not('musculo', 'is', null)
      setOpcionesMusculo([...new Set((data || []).map((r) => r.musculo))].sort())
    })()
  }, [])

  // The chosen exercise is read separately from the list. It has to stay on screen while the
  // filters move, and an exercise saved before the box lost a machine will not come back in
  // any filtered result — which is exactly when the coach most needs to see it.
  useEffect(() => {
    if (!value) {
      setElegido(null)
      setFalta([])
      return
    }
    ;(async () => {
      const [{ data: fila }, { data: faltante }] = await Promise.all([
        supabase.from('exercises_catalogo').select('*').eq('id', value).maybeSingle(),
        estacion
          ? supabase.rpc('falta_para_estacion', { p_exercise_id: value, p_box_id: boxId })
          : Promise.resolve({ data: [] }),
      ])
      setElegido(fila || null)
      setFalta(faltante || [])
    })()
  }, [value, boxId])

  const bloqueado = esperaEstacion && !boxId

  const buscar = useCallback(async () => {
    if (esperaEstacion && !boxId) {
      setResultados([])
      return
    }
    const mio = ++pedido.current
    setCargando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('buscar_ejercicios', {
        q: q.trim() || null,
        musculos: musculos.length ? musculos : null,
        box_id: boxId ? Number(boxId) : null,
        solo_con_video: soloConVideo,
        limite: 60,
      })
      if (err) throw err
      // Filters move faster than the network, so an earlier search can land after a later one
      // and put back results the coach has already filtered away.
      if (mio === pedido.current) setResultados(data || [])
    } catch (err) {
      if (mio === pedido.current) setError(err.message || String(err))
    } finally {
      if (mio === pedido.current) setCargando(false)
    }
  }, [q, musculos, boxId, soloConVideo, esperaEstacion])

  useEffect(() => {
    const t = setTimeout(buscar, 200)
    return () => clearTimeout(t)
  }, [buscar])

  const alternarMusculo = (m) =>
    setMusculos((ms) => (ms.includes(m) ? ms.filter((v) => v !== m) : [...ms, m]))

  const resumen = useMemo(() => {
    if (esperaEstacion && !boxId) return FALTA_ESTACION
    if (cargando) return 'Buscando…'
    const n = `${resultados.length}${resultados.length === 60 ? '+' : ''}`
    return estacion
      ? `${n} ejercicios que se pueden hacer en la estación ${estacion}`
      : `${n} ejercicios del catálogo`
  }, [estacion, esperaEstacion, cargando, resultados.length])

  return (
    <div style={s.contenedor}>
      {elegido && (
        <div style={{ ...s.elegido, ...(falta.length ? s.elegidoRoto : {}) }}>
          <div style={s.miniaturaChica}>
            {elegido.poster_path ? (
              <img src={mediaUrl(elegido.poster_path)} alt="" style={s.miniaturaImg} />
            ) : (
              <span style={s.sinVideoChico}>sin video</span>
            )}
          </div>
          <div style={s.elegidoTexto}>
            <span style={s.elegidoNombre}>{elegido.name}</span>
            <span style={s.elegidoMeta}>
              {[elegido.code, elegido.musculo, elegido.patron].filter(Boolean).join(' · ')}
            </span>
            {falta.length > 0 && (
              // Naming the missing equipment turns a dead end into a choice: change the
              // exercise, or move a polea to that station.
              <span style={s.elegidoFalta}>
                En la estación {estacion} falta {falta.join(' y ')} — así como está, el socio
                llega al box y no lo puede hacer.
              </span>
            )}
          </div>
          <button type="button" onClick={() => onChange('')} style={s.quitar}>
            Cambiar
          </button>
        </div>
      )}

      {!elegido && (
        <>
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Buscar por nombre o código — no hace falta escribirlo exacto"
            style={s.buscador}
            disabled={bloqueado}
          />

          {!bloqueado && (
            <div style={s.chips}>
              {opcionesMusculo.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => alternarMusculo(m)}
                  style={{ ...s.chip, ...(musculos.includes(m) ? s.chipActivo : {}) }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          <span style={s.resumen}>{resumen}</span>
          {error && <div style={s.error}>{error}</div>}

          {!bloqueado && (
            <div style={s.lista}>
              {resultados.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onChange(String(ex.id))}
                  style={s.fila}
                >
                  <div style={s.miniatura}>
                    {ex.poster_path ? (
                      <img src={mediaUrl(ex.poster_path)} alt="" style={s.miniaturaImg} />
                    ) : (
                      <span style={s.sinVideoChico}>sin video</span>
                    )}
                  </div>
                  <div style={s.filaTexto}>
                    <span style={s.filaNombre}>{ex.name}</span>
                    <span style={s.filaMeta}>
                      {[ex.code, ex.musculo, ex.patron].filter(Boolean).join(' · ')}
                    </span>
                    {ex.elementos?.length > 0 && (
                      <span style={s.filaElementos}>{ex.elementos.join(', ')}</span>
                    )}
                  </div>
                </button>
              ))}
              {!cargando && resultados.length === 0 && (
                <p style={s.vacio}>
                  {estacion
                    ? `Ningún ejercicio de la estación ${estacion} coincide con esos filtros.`
                    : 'Ningún ejercicio coincide con esos filtros.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  contenedor: { display: 'flex', flexDirection: 'column', gap: 8 },
  buscador: {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: {
    padding: '4px 9px', borderRadius: 999, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 12, cursor: 'pointer', color: '#374151',
  },
  chipActivo: { background: '#FFF1ED', borderColor: '#F45F37', color: '#B33204', fontWeight: 600 },
  resumen: { fontSize: 12, color: '#9ca3af' },
  lista: {
    display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto',
    border: '1px solid #f3f4f6', borderRadius: 12, padding: 6,
  },
  fila: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 6, borderRadius: 10,
    border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', width: '100%',
  },
  miniatura: {
    width: 64, height: 40, flexShrink: 0, borderRadius: 8, background: '#f3f4f6',
    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  miniaturaChica: {
    width: 72, height: 45, flexShrink: 0, borderRadius: 8, background: '#f3f4f6',
    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  miniaturaImg: { width: '100%', height: '100%', objectFit: 'cover' },
  sinVideoChico: { fontSize: 10, color: '#9ca3af' },
  filaTexto: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  filaNombre: { fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3 },
  filaMeta: { fontSize: 11, color: '#6b7280' },
  filaElementos: { fontSize: 10, color: '#9ca3af' },
  vacio: { textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13, margin: 0 },
  elegido: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12,
    border: '1px solid #F45F37', background: '#FFF1ED',
  },
  elegidoRoto: { borderColor: '#FDE68A', background: '#FFFBEB' },
  elegidoTexto: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  elegidoNombre: { fontSize: 14, fontWeight: 700, color: '#111827' },
  elegidoMeta: { fontSize: 11, color: '#6b7280' },
  elegidoFalta: { fontSize: 12, color: '#92400E', lineHeight: 1.4, marginTop: 2 },
  quitar: {
    border: '1px solid #e5e7eb', background: 'white', borderRadius: 8, padding: '6px 10px',
    fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  error: {
    padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA',
    color: '#B91C1C', fontSize: 12,
  },
}
