// Reloj compartido de las pantallas de TV — el mismo patrón drift-free (timestamp absoluto +
// requestAnimationFrame, nunca un setInterval que cuenta) que ya usaban QueueTv.jsx y
// QueueMonitor.jsx por separado. Vive acá una sola vez porque ahora lo usan cuatro pantallas
// (línea, estación, sede, monitor) y una TV que cuenta mal ocho horas por día no se nota hasta
// que alguien la mira fijo.
//
// Explicación + demo (Mateo, 2026-09-23): cada box ocupado son DOS fases seguidas —
// explicación (los primeros `explicacion_seg` segundos desde `entered_at`) y después la
// estación (hasta `advances_at`, que el servidor ya calcula con explicación + estación
// incluidas). Estos defaults son los mismos que trae la migración de production_lines por si
// el payload todavía no los manda — ver nota en QueueTv.jsx.
import { useEffect, useState } from 'react'

export const DEFAULT_EXPLICACION_SEG = 60
export const DEFAULT_ESTACION_SEG = 420
export const DEFAULT_DEMO_ESTACION_SEG = 60

export function explicacionSegDeLinea(linea) {
  return Number(linea?.explicacion_seg ?? DEFAULT_EXPLICACION_SEG)
}

export function estacionSegDeLinea(linea) {
  const real = Number(linea?.estacion_seg ?? DEFAULT_ESTACION_SEG)
  const demo = Number(linea?.demo_estacion_seg ?? DEFAULT_DEMO_ESTACION_SEG)
  return linea?.modo_demo ? demo : real
}

// Cuenta regresiva contra un timestamp absoluto (ISO). Nunca cuenta hacia abajo desde un
// número guardado — deriva el restante de Date.now() en cada frame, así una pestaña en
// segundo plano (que es lo que es una TV para el navegador) no acumula drift.
export function useCountdown(targetIso) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    targetIso ? Math.max(0, Math.ceil((new Date(targetIso).getTime() - Date.now()) / 1000)) : null
  )

  useEffect(() => {
    if (!targetIso) {
      setSecondsLeft(null)
      return
    }
    const targetMs = new Date(targetIso).getTime()
    let rafId
    const loop = () => {
      const remaining = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
      setSecondsLeft((prev) => (prev !== remaining ? remaining : prev))
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [targetIso])

  return secondsLeft
}

export function formatMMSS(secondsLeft) {
  if (secondsLeft == null) return ''
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// En qué fase está un box ocupado: explicación (los primeros explicacionSeg segundos desde que
// entró) o estación (todo lo que sigue). Devuelve también el instante en que arrancó la
// estación — entered_at + explicacionSeg — que es lo que el reloj de formato (AMRAP/EMOM/
// Tabata/...) tiene que usar como origen en vez de entered_at crudo, o un Tabata que en
// realidad arranca recién al minuto 1 se ve corriendo un minuto adelantado.
export function useBoxPhase(enteredAtIso, explicacionSeg) {
  const [estado, setEstado] = useState(() => calcular(enteredAtIso, explicacionSeg))

  useEffect(() => {
    if (!enteredAtIso) {
      setEstado({ fase: null, restanteExplicacionSeg: 0, estacionInicioIso: null })
      return
    }
    let rafId
    const loop = () => {
      setEstado((prev) => {
        const next = calcular(enteredAtIso, explicacionSeg)
        return prev.fase === next.fase && prev.restanteExplicacionSeg === next.restanteExplicacionSeg
          ? prev
          : next
      })
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [enteredAtIso, explicacionSeg])

  return estado
}

function calcular(enteredAtIso, explicacionSeg) {
  if (!enteredAtIso) return { fase: null, restanteExplicacionSeg: 0, estacionInicioIso: null }
  const inicioMs = new Date(enteredAtIso).getTime()
  const explicSeg = Math.max(0, Number(explicacionSeg) || 0)
  const estacionInicioIso = new Date(inicioMs + explicSeg * 1000).toISOString()
  const transcurridoSeg = Math.floor((Date.now() - inicioMs) / 1000)
  if (transcurridoSeg < explicSeg) {
    return { fase: 'explicacion', restanteExplicacionSeg: explicSeg - transcurridoSeg, estacionInicioIso }
  }
  return { fase: 'estacion', restanteExplicacionSeg: 0, estacionInicioIso }
}
