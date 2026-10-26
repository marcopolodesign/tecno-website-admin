import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mediaUrl } from '../lib/exerciseMedia'
import VideoEjercicio from './VideoEjercicio'

// Choosing which part of the clip loops.
//
// A phone clip of a rep is mostly not the rep: someone walks into frame, does three, walks out.
// The loop should be the three.
//
// Nothing is re-encoded. The span is stored on the row and the players read it, exactly like
// the framing — so it takes effect the instant it is saved, it can be moved a hundred times,
// and no cached public file ever disagrees with what the row says. The frames outside the cut
// are still there, which is the point: a trim one rep too tight is a slider, not a re-shoot.
//
// The preview loops the selection while it is being dragged, because the only way to know
// whether a cut is right is to watch it come round.

const paso = 0.05

export default function RecorteEditor({ ejercicio, onGuardado, onCerrar }) {
  const src = mediaUrl(ejercicio?.tv_path)
  const duracionFila = Number(ejercicio?.duration_seconds) || 0
  const [duracion, setDuracion] = useState(duracionFila)
  const [inicio, setInicio] = useState(Number(ejercicio?.recorte_inicio) || 0)
  const [fin, setFin] = useState(Number(ejercicio?.recorte_fin) || 0)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setInicio(Number(ejercicio?.recorte_inicio) || 0)
    setFin(Number(ejercicio?.recorte_fin) || 0)
    setDuracion(Number(ejercicio?.duration_seconds) || 0)
    setGuardado(false)
    setError(null)
  }, [ejercicio?.id])

  // duration_seconds is written by the processing pipeline and can be missing or stale on rows
  // loaded before it existed. The file itself is the authority.
  const alCargar = (ev) => {
    const d = ev.currentTarget.duration
    if (Number.isFinite(d) && d > 0) {
      setDuracion(d)
      setFin((f) => (f > 0 ? Math.min(f, d) : d))
    }
  }

  const finEfectivo = fin > 0 ? fin : duracion
  const hayRecorte = inicio > 0 || (fin > 0 && Math.abs(fin - duracion) > 0.05)
  const largo = Math.max(0, finEfectivo - inicio)
  const invalido = duracion > 0 && largo < 1

  const recortePreview = useMemo(
    () => (hayRecorte ? { inicio, fin: finEfectivo } : null),
    [hayRecorte, inicio, finEfectivo]
  )

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('guardar_recorte', {
        p_exercise_id: ejercicio.id,
        p_inicio: hayRecorte ? Number(inicio.toFixed(2)) : null,
        p_fin: hayRecorte ? Number(finEfectivo.toFixed(2)) : null,
      })
      if (err) throw err
      setGuardado(true)
      onGuardado?.(data)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const verCompleto = () => {
    setInicio(0)
    setFin(0)
    setGuardado(false)
  }

  if (!src) {
    return (
      <div style={s.vacio}>
        Este ejercicio todavía no tiene video cargado, así que no hay nada que recortar.
      </div>
    )
  }

  return (
    <div style={s.contenedor}>
      <p style={s.ayuda}>
        Elegí qué parte del clip se repite. Lo que queda afuera no se borra — se puede volver a
        mover todas las veces que haga falta.
      </p>

      <div style={s.marco}>
        <VideoEjercicio
          src={src}
          poster={mediaUrl(ejercicio.poster_path)}
          recorte={recortePreview}
          onLoadedMetadata={alCargar}
          style={s.video}
        />
      </div>

      <div style={s.control}>
        <span style={s.etiqueta}>Empieza</span>
        <input
          type="range"
          min="0"
          max={Math.max(duracion - 1, 0)}
          step={paso}
          value={inicio}
          onChange={(ev) => {
            const v = Number(ev.target.value)
            setInicio(v)
            if (finEfectivo - v < 1) setFin(Math.min(duracion, v + 1))
            setGuardado(false)
          }}
          style={s.rango}
        />
        <span style={s.valor}>{inicio.toFixed(2)}s</span>
      </div>

      <div style={s.control}>
        <span style={s.etiqueta}>Termina</span>
        <input
          type="range"
          min={Math.min(inicio + 1, duracion)}
          max={duracion || 1}
          step={paso}
          value={finEfectivo}
          onChange={(ev) => {
            setFin(Number(ev.target.value))
            setGuardado(false)
          }}
          style={s.rango}
        />
        <span style={s.valor}>{finEfectivo.toFixed(2)}s</span>
      </div>

      <div style={{ ...s.resumen, ...(invalido ? s.resumenRoto : {}) }}>
        {hayRecorte
          ? `El loop dura ${largo.toFixed(2)}s de los ${duracion.toFixed(2)}s del clip.`
          : `Se reproduce entero: ${duracion.toFixed(2)}s.`}
        {invalido && ' Menos de un segundo se ve como un parpadeo, no como un movimiento.'}
      </div>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.acciones}>
        <button onClick={verCompleto} disabled={guardando || !hayRecorte} style={s.botonSecundario}>
          Usar el clip entero
        </button>
        <button onClick={guardar} disabled={guardando || invalido} style={s.botonPrimario}>
          {guardando ? 'Guardando…' : guardado ? 'Guardado ✓' : 'Guardar recorte'}
        </button>
      </div>

      <p style={s.nota}>
        Se aplica al instante en la pantalla del box y en la app. No se vuelve a subir ni a
        procesar el video.
      </p>
    </div>
  )
}

const s = {
  contenedor: { display: 'flex', flexDirection: 'column', gap: 14 },
  encabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titulo: { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  codigo: { fontSize: 12, fontFamily: 'monospace', color: '#6b7280' },
  cerrar: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  ayuda: { margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.45 },
  marco: {
    position: 'relative', width: '100%', aspectRatio: '16 / 10', overflow: 'hidden',
    borderRadius: 12, background: '#000',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  control: { display: 'flex', alignItems: 'center', gap: 12 },
  etiqueta: { fontSize: 13, color: '#374151', fontWeight: 600, width: 66 },
  rango: { flex: 1 },
  valor: { fontSize: 13, color: '#6b7280', fontFamily: 'monospace', width: 60, textAlign: 'right' },
  resumen: {
    padding: '8px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0',
    color: '#166534', fontSize: 13,
  },
  resumenRoto: { background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
  acciones: { display: 'flex', gap: 10 },
  botonPrimario: {
    flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#F45F37',
    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  botonSecundario: {
    padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white',
    color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  error: {
    padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA',
    color: '#B91C1C', fontSize: 13,
  },
  nota: { margin: 0, fontSize: 12, color: '#9ca3af' },
  vacio: { padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 },
}
