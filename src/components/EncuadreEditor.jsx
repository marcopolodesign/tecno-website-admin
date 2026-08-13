import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mediaUrl, cropStyle } from '../lib/exerciseMedia'

// Reframing an exercise for each screen.
//
// The gym films horizontally on a phone and nobody centres the movement in the frame. The
// box screen is wide, the phone is not, and the same clip has to look deliberate on both.
//
// Nothing is re-encoded. The frame is stored as a normalised rectangle on the row and the
// players apply it, so a reframe takes effect the moment it is saved: no re-upload, no
// re-render, no waiting, and no chance of a screen showing a stale cut because a cached
// public file was overwritten in place. It is also endlessly reversible — the pixels are
// never thrown away.
//
// The interaction is zoom + drag rather than drag-the-corners. It is the same gesture as
// framing a photo, it cannot produce an invalid rectangle, and one finger does it on the
// gym's iPad.

const DESTINOS = {
  tv: { etiqueta: 'Pantalla del box', aspecto: 16 / 10, campo: 'crop_tv' },
  app: { etiqueta: 'Celular del socio', aspecto: 16 / 9, campo: 'crop_app' },
}

const SIN_ENCUADRE = { zoom: 1, cx: 0.5, cy: 0.5 }

// The row stores {x, y, w, h}: what part of the source frame to show. The editor thinks in
// zoom and centre because that is what the hand is doing. These convert between the two.
function aRect(estado, aspecto, videoAspecto) {
  const { zoom, cx, cy } = estado
  // Width of the visible window as a fraction of the source, before zoom: the widest
  // rectangle of the target aspect that fits inside the source frame.
  const baseW = videoAspecto >= aspecto ? aspecto / videoAspecto : 1
  const baseH = videoAspecto >= aspecto ? 1 : videoAspecto / aspecto
  const w = Math.min(1, baseW / zoom)
  const h = Math.min(1, baseH / zoom)
  return {
    x: Math.min(Math.max(cx - w / 2, 0), 1 - w),
    y: Math.min(Math.max(cy - h / 2, 0), 1 - h),
    w,
    h,
    aspect: aspecto === 16 / 10 ? '16:10' : '16:9',
  }
}

function aEstado(rect, aspecto, videoAspecto) {
  if (!rect || !rect.w) return SIN_ENCUADRE
  const baseW = videoAspecto >= aspecto ? aspecto / videoAspecto : 1
  return {
    zoom: Math.max(1, baseW / rect.w),
    cx: rect.x + rect.w / 2,
    cy: rect.y + rect.h / 2,
  }
}

export default function EncuadreEditor({ ejercicio, onGuardado, onCerrar }) {
  const [destino, setDestino] = useState('tv')
  const [estado, setEstado] = useState(SIN_ENCUADRE)
  const [videoAspecto, setVideoAspecto] = useState(16 / 9)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const arrastre = useRef(null)
  const marcoRef = useRef(null)

  const { aspecto, campo, etiqueta } = DESTINOS[destino]
  const src = mediaUrl(ejercicio?.tv_path)

  // Switching destination loads that destination's own frame — they are independent, and
  // that is the point: what reads well on a wall is not what reads well in a hand.
  useEffect(() => {
    setEstado(aEstado(ejercicio?.[campo], aspecto, videoAspecto))
    setGuardado(false)
    setError(null)
  }, [destino, ejercicio?.id, campo, aspecto, videoAspecto])

  const alCargarVideo = (e) => {
    const v = e.currentTarget
    if (v.videoWidth && v.videoHeight) setVideoAspecto(v.videoWidth / v.videoHeight)
  }

  const empezarArrastre = (e) => {
    const punto = e.touches?.[0] ?? e
    arrastre.current = { x: punto.clientX, y: punto.clientY, cx: estado.cx, cy: estado.cy }
  }

  const mover = useCallback(
    (e) => {
      if (!arrastre.current || !marcoRef.current) return
      const punto = e.touches?.[0] ?? e
      const caja = marcoRef.current.getBoundingClientRect()
      const rect = aRect(estado, aspecto, videoAspecto)
      // Dragging moves the picture, so the window moves the other way, scaled by how much
      // of the source is currently visible.
      const dx = ((punto.clientX - arrastre.current.x) / caja.width) * rect.w
      const dy = ((punto.clientY - arrastre.current.y) / caja.height) * rect.h
      setEstado((s) => ({
        ...s,
        cx: Math.min(Math.max(arrastre.current.cx - dx, 0), 1),
        cy: Math.min(Math.max(arrastre.current.cy - dy, 0), 1),
      }))
      setGuardado(false)
    },
    [estado, aspecto, videoAspecto]
  )

  useEffect(() => {
    const soltar = () => {
      arrastre.current = null
    }
    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
    window.addEventListener('touchmove', mover, { passive: true })
    window.addEventListener('touchend', soltar)
    return () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
      window.removeEventListener('touchmove', mover)
      window.removeEventListener('touchend', soltar)
    }
  }, [mover])

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const rect = aRect(estado, aspecto, videoAspecto)
      const { error: err } = await supabase
        .from('exercises')
        .update({ [campo]: rect })
        .eq('id', ejercicio.id)
      if (err) throw err
      setGuardado(true)
      onGuardado?.({ ...ejercicio, [campo]: rect })
    } catch (err) {
      // The real message, always: "no se pudo guardar" tells whoever is loading content
      // nothing they can act on.
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('exercises')
        .update({ [campo]: null })
        .eq('id', ejercicio.id)
      if (err) throw err
      setEstado(SIN_ENCUADRE)
      setGuardado(true)
      onGuardado?.({ ...ejercicio, [campo]: null })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  if (!src) {
    return (
      <div style={estilos.vacio}>
        Este ejercicio todavía no tiene video cargado, así que no hay nada que encuadrar.
      </div>
    )
  }

  const rect = aRect(estado, aspecto, videoAspecto)

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.encabezado}>
        <div>
          <h3 style={estilos.titulo}>{ejercicio.name}</h3>
          <span style={estilos.codigo}>{ejercicio.code}</span>
        </div>
        {onCerrar && (
          <button onClick={onCerrar} style={estilos.cerrar} aria-label="Cerrar">
            ✕
          </button>
        )}
      </div>

      <div style={estilos.tabs}>
        {Object.entries(DESTINOS).map(([clave, d]) => (
          <button
            key={clave}
            onClick={() => setDestino(clave)}
            style={{ ...estilos.tab, ...(destino === clave ? estilos.tabActiva : {}) }}
          >
            {d.etiqueta}
            {ejercicio[d.campo] ? <span style={estilos.puntito} /> : null}
          </button>
        ))}
      </div>

      <p style={estilos.ayuda}>
        Arrastrá la imagen para elegir qué parte se ve y usá el zoom para acercarte. Cada
        pantalla guarda su propio encuadre.
      </p>

      <div
        ref={marcoRef}
        onMouseDown={empezarArrastre}
        onTouchStart={empezarArrastre}
        style={{ ...estilos.marco, aspectRatio: String(aspecto) }}
      >
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          onLoadedMetadata={alCargarVideo}
          style={cropStyle(rect)}
        />
        <div style={estilos.guias} />
      </div>

      <div style={estilos.zoomFila}>
        <span style={estilos.zoomEtiqueta}>Zoom</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={estado.zoom}
          onChange={(e) => {
            setEstado((s) => ({ ...s, zoom: Number(e.target.value) }))
            setGuardado(false)
          }}
          style={{ flex: 1 }}
        />
        <span style={estilos.zoomValor}>{estado.zoom.toFixed(2)}×</span>
      </div>

      {error && <div style={estilos.error}>{error}</div>}

      <div style={estilos.acciones}>
        <button onClick={quitar} disabled={guardando} style={estilos.botonSecundario}>
          Volver al encuadre completo
        </button>
        <button onClick={guardar} disabled={guardando} style={estilos.botonPrimario}>
          {guardando ? 'Guardando…' : guardado ? 'Guardado ✓' : `Guardar para ${etiqueta.toLowerCase()}`}
        </button>
      </div>

      <p style={estilos.nota}>
        Se aplica al instante en la pantalla y en la app. No se vuelve a subir ni a procesar
        el video, así que se puede cambiar todas las veces que haga falta.
      </p>
    </div>
  )
}

const estilos = {
  contenedor: { display: 'flex', flexDirection: 'column', gap: 14 },
  encabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titulo: { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  codigo: { fontSize: 12, fontFamily: 'monospace', color: '#6b7280' },
  cerrar: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  tabs: { display: 'flex', gap: 8 },
  tab: {
    flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb',
    background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabActiva: { background: '#FFF1ED', borderColor: '#F45F37', color: '#B33204' },
  puntito: { width: 6, height: 6, borderRadius: 99, background: '#F45F37', display: 'inline-block' },
  ayuda: { margin: 0, fontSize: 13, color: '#6b7280' },
  marco: {
    position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12,
    background: '#000', cursor: 'grab', userSelect: 'none',
  },
  guias: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage:
      'linear-gradient(to right, rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.25) 1px, transparent 1px)',
    backgroundSize: '33.333% 33.333%',
  },
  zoomFila: { display: 'flex', alignItems: 'center', gap: 12 },
  zoomEtiqueta: { fontSize: 13, color: '#374151', fontWeight: 600 },
  zoomValor: { fontSize: 13, color: '#6b7280', fontFamily: 'monospace', width: 48, textAlign: 'right' },
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
