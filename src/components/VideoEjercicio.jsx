import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { blobDe } from './tv/precargaBlob'

// An exercise clip playing the way it was set up: framed by its crop, looping only the span
// that was kept.
//
// Neither the crop nor the trim is baked into the file — both are stored on the row and applied
// here. That is what makes changing either of them instant and reversible, and what keeps a
// public URL that every TV has cached from ever pointing at different pixels than it did an
// hour ago.
//
// The loop is done by hand rather than with the `loop` attribute, because `loop` restarts at
// zero and the whole point is that zero is usually someone walking into frame.

// Arranque explícito (2026-10-26, TV de la sala con el póster quieto): no se confía sólo en el
// atributo `autoplay`. Hasta que el clip arranca por primera vez se llama a play() en
// loadedmetadata / loadeddata / canplay, y `muted` va también como atributo (React lo pone sólo
// como propiedad). En Chrome 47 play() devuelve undefined, no una Promise. Después del primer
// `playing` no se insiste más (el editor de recorte puede pausarlo a mano).
// Control: scripts/check-tv-un-video.mjs (TV que ignora autoplay).
export function reproducirSeguro(v) {
  if (!v || !v.paused) return
  try {
    const p = v.play()
    if (p && p.catch) p.catch(() => {})
  } catch (e) { /* TVs viejas pueden tirar si todavía no hay fuente */ }
}

// Respaldo (prueba 4, 2026-11-18): si llega `srcRespaldo` (video del server local del gimnasio con el de
// Supabase de respaldo) y el principal tira error o no arranca en RESPALDO_MS, se pasa al respaldo y se
// avisa al Monitor de TVs (evento video_respaldo).
const RESPALDO_MS = 7000

export default function VideoEjercicio({ src: srcPrincipal, srcRespaldo, poster, style, recorte, alProgreso, onLoadedData, onCanPlay, onPlaying, ...rest }) {
  const [usarRespaldo, setUsarRespaldo] = useState(false)
  useEffect(() => { setUsarRespaldo(false) }, [srcPrincipal])
  const srcRed = usarRespaldo && srcRespaldo ? srcRespaldo : srcPrincipal
  // Si el video ya está bajado en memoria (precargaBlob, TVs de la sala), se reproduce de ahí. Se decide al
  // cambiar la fuente, no a mitad de reproducción (cambiarle el src a un video que ya corre lo reinicia).
  const src = useMemo(() => blobDe(srcRed) || srcRed, [srcRed])
  const ref = useRef(null)
  const arranco = useRef(false)
  const inicio = Number(recorte?.inicio) || 0
  const fin = Number(recorte?.fin) || null

  const alInicio = useCallback(() => {
    const v = ref.current
    if (!v) return
    // Seeking before the browser knows the duration is ignored silently, which is why this
    // runs on loadedmetadata and not on mount.
    if (inicio > 0 && Math.abs(v.currentTime - inicio) > 0.05) v.currentTime = inicio
  }, [inicio])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (v.readyState >= 1) alInicio()
  }, [alInicio, src])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    arranco.current = false
    v.defaultMuted = true
    v.muted = true
    v.setAttribute('muted', '')
    reproducirSeguro(v)
  }, [src])

  const pasarAlRespaldo = useCallback((motivo) => {
    if (!srcRespaldo || usarRespaldo) return
    setUsarRespaldo(true)
    try { if (window.__tvEvento) window.__tvEvento('video_respaldo', `${String(srcPrincipal).split('/').pop()} → Supabase (${motivo})`) } catch (e) { /* sin telemetría */ }
  }, [srcRespaldo, usarRespaldo, srcPrincipal])

  useEffect(() => {
    if (!srcRespaldo || usarRespaldo) return undefined
    const t = setTimeout(() => { if (!arranco.current) pasarAlRespaldo(`no arrancó en ${RESPALDO_MS / 1000} s`) }, RESPALDO_MS)
    return () => clearTimeout(t)
  }, [srcPrincipal, srcRespaldo, usarRespaldo, pasarAlRespaldo])

  const insistir = (ev) => {
    if (!arranco.current) reproducirSeguro(ev.currentTarget)
  }

  const alAvanzar = (ev) => {
    const v = ev.currentTarget
    if (alProgreso) alProgreso(v.currentTime)
    if (!fin) return
    // A tenth of a second of slack: timeupdate fires every ~250ms, so testing for equality
    // would let the clip run past the cut on a slow frame.
    if (v.currentTime >= fin - 0.05) v.currentTime = inicio
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={poster || undefined}
      autoPlay
      muted
      playsInline
      // `loop` only when nothing was trimmed. With a trim, wrapping is handled on timeupdate so
      // it returns to the chosen start rather than to zero.
      loop={!fin}
      onLoadedMetadata={(ev) => { alInicio(); insistir(ev) }}
      onLoadedData={(ev) => { insistir(ev); if (onLoadedData) onLoadedData(ev) }}
      onCanPlay={(ev) => { insistir(ev); if (onCanPlay) onCanPlay(ev) }}
      onPlaying={(ev) => { arranco.current = true; if (onPlaying) onPlaying(ev) }}
      onTimeUpdate={alAvanzar}
      onError={() => pasarAlRespaldo('error al cargar')}
      onEnded={alInicio}
      style={style}
      {...rest}
    />
  )
}
