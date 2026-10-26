import { useCallback, useEffect, useRef } from 'react'

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

export default function VideoEjercicio({ src, poster, style, recorte, ...rest }) {
  const ref = useRef(null)
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

  const alAvanzar = (ev) => {
    if (!fin) return
    const v = ev.currentTarget
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
      onLoadedMetadata={alInicio}
      onTimeUpdate={alAvanzar}
      onEnded={alInicio}
      style={style}
      {...rest}
    />
  )
}
