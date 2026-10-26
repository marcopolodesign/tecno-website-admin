import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mediaUrl } from '../lib/exerciseMedia'

// Swapping the exercise on one row of a session.
//
// The engine rotates on the movement pattern — a squat and a calf raise are both "legs" and are
// not substitutes, a dumbbell row and an assisted pull-up are — and prefers a different family,
// because the same movement with another implement is not variety. Every candidate is already
// runnable at that station and safe for that member, so the list is a choice, not a shortlist
// to re-check.
//
// The empty case matters as much as the list. "No hay sustitutos" is three different
// situations: nothing to rotate on, the station is missing equipment, or the member must avoid
// this whole family of movement. The last is common and not a fault — most unilateral leg work
// is contraindicated for a knee — and the coach's next move is different in each case, so the
// panel says which one happened.

// El título y el cerrar los pone el Sidecart — repetirlos acá era la única razón por la
// que este componente conocía cómo se abre.
export default function PanelSustitutos({ filaId, ejercicioActual, estacion, boxId, onSustituido }) {
  const [candidatos, setCandidatos] = useState([])
  const [diagnostico, setDiagnostico] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aplicando, setAplicando] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('sustitutos_para_fila', {
        p_session_exercise_id: filaId,
        p_limite: 8,
      })
      if (err) throw err
      setCandidatos(data || [])
      // Only asked when there is nothing to show — it exists to explain an absence.
      if (!data || data.length === 0) {
        const { data: diag } = await supabase.rpc('diagnostico_sustitutos', {
          p_exercise_id: ejercicioActual?.id,
          p_box_id: boxId,
          p_user_id: null,
        })
        setDiagnostico(diag?.[0] || null)
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCargando(false)
    }
  }, [filaId, ejercicioActual?.id, boxId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const aplicar = async (candidato) => {
    setAplicando(candidato.id)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('sustituir_ejercicio', {
        p_session_exercise_id: filaId,
        p_exercise_id: candidato.id,
      })
      if (err) throw err
      onSustituido?.(candidato)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setAplicando(null)
    }
  }

  return (
    <div style={s.contenedor}>
      {error && <div style={s.error}>{error}</div>}

      {cargando && <p style={s.vacio}>Buscando alternativas…</p>}

      {!cargando && candidatos.length > 0 && (
        <>
          <p style={s.ayuda}>
            Mismo patrón de movimiento, que la estación {estacion} puede correr y que el socio
            puede hacer. Primero lo que cambia de familia y lo que menos hizo.
          </p>
          <div style={s.lista}>
            {candidatos.map((c) => (
              <div key={c.id} style={s.fila}>
                <div style={s.miniatura}>
                  {c.poster_path ? (
                    <img src={mediaUrl(c.poster_path)} alt="" style={s.miniaturaImg} />
                  ) : (
                    <span style={s.sinVideo}>sin video</span>
                  )}
                </div>
                <div style={s.texto}>
                  <span style={s.nombre}>{c.name}</span>
                  <span style={s.meta}>
                    {[c.code, c.musculo, c.patron].filter(Boolean).join(' · ')}
                  </span>
                  <span style={s.motivo}>
                    {c.motivo}
                    {c.veces_hecho > 0 && ` · lo hizo ${c.veces_hecho} ${c.veces_hecho === 1 ? 'vez' : 'veces'}`}
                  </span>
                </div>
                <button
                  onClick={() => aplicar(c)}
                  disabled={aplicando !== null}
                  style={s.usar}
                >
                  {aplicando === c.id ? 'Cambiando…' : 'Usar este'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {!cargando && candidatos.length === 0 && (
        <div style={s.aviso}>{explicar(diagnostico, estacion)}</div>
      )}
    </div>
  )
}

// The three ways the list ends up empty, each with the move the coach would actually make.
function explicar(d, estacion) {
  if (!d) return 'No se pudo averiguar por qué no hay alternativas.'
  if (!d.tiene_patron) {
    return 'Este ejercicio todavía no tiene patrón de movimiento cargado, así que no hay con qué compararlo. Clasificalo en el catálogo y vuelve a tener alternativas.'
  }
  if (d.mismo_patron === 0) {
    return 'No hay ningún otro ejercicio del catálogo con este patrón de movimiento.'
  }
  if (d.caben_en_estacion === 0) {
    return `Hay ${d.mismo_patron} ejercicios con el mismo patrón, pero ninguno se puede hacer en la estación ${estacion} con el material que tiene. Se resuelve en Equipamiento, no acá.`
  }
  if (d.aptos_para_el_socio === 0) {
    return `Los ${d.caben_en_estacion} que entran en la estación ${estacion} están contraindicados para este socio. No es un error: para su lesión, este patrón de movimiento entero queda afuera — hay que cambiar el patrón, no el implemento.`
  }
  return 'Los que quedaban ya están en esta misma sesión.'
}

const s = {
  contenedor: { display: 'flex', flexDirection: 'column', gap: 14 },
  encabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titulo: { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280' },
  cerrar: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  ayuda: { margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.45 },
  lista: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' },
  fila: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12,
    border: '1px solid #f3f4f6',
  },
  miniatura: {
    width: 72, height: 45, flexShrink: 0, borderRadius: 8, background: '#f3f4f6',
    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  miniaturaImg: { width: '100%', height: '100%', objectFit: 'cover' },
  sinVideo: { fontSize: 10, color: '#9ca3af' },
  texto: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 },
  nombre: { fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3 },
  meta: { fontSize: 11, color: '#6b7280' },
  motivo: { fontSize: 11, color: '#059669' },
  usar: {
    border: 'none', background: '#F45F37', color: 'white', borderRadius: 8,
    padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  vacio: { margin: 0, fontSize: 13, color: '#9ca3af', padding: 12, textAlign: 'center' },
  aviso: {
    padding: '12px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A',
    color: '#92400E', fontSize: 13, lineHeight: 1.5,
  },
  error: {
    padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA',
    color: '#B91C1C', fontSize: 13,
  },
}
