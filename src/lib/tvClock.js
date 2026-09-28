// Reloj compartido de las pantallas de TV — timestamp absoluto + un timer que sólo dispara el
// recálculo (nunca cuenta él mismo) — el mismo patrón que ya usaban QueueTv.jsx y
// QueueMonitor.jsx por separado. Vive acá una sola vez porque ahora lo usan cuatro pantallas
// (línea, estación, sede, monitor) y una TV que cuenta mal ocho horas por día no se nota hasta
// que alguien la mira fijo.
//
// 2026-09-28: el timer pasó de requestAnimationFrame a setInterval(250ms). rAF sólo dispara en
// un tab visible y sin ocluir — Chrome lo pausa en segundo plano o detrás de otra ventana, así
// que una TV minimizada o tapada por el mouse se quedaba congelada aunque el reloj de verdad
// (Date.now(), server-side) siguiera corriendo: "no cambió de pantalla cuando me tocaba
// entrenar" (prueba de la sala). setInterval sigue disparando igual en background; como todo
// acá deriva de un timestamp absoluto y no de un contador propio, no hay drift que perder.
//
// Explicación + estación + transición (Mateo, 2026-09-23, transición sumada 2026-09-28): cada
// box ocupado son TRES fases seguidas — explicación (los primeros `explicacion_seg` segundos
// desde `entered_at`), estación (los `estacion_seg` que siguen) y transición (lo que queda
// hasta `advances_at`, que el servidor ya calcula con las tres sumadas). Estos defaults son
// los mismos que trae la migración de production_lines por si el payload todavía no los manda.
import { useEffect, useState } from 'react'

const TICK_MS = 250

export const DEFAULT_EXPLICACION_SEG = 60
export const DEFAULT_ESTACION_SEG = 420
export const DEFAULT_DEMO_ESTACION_SEG = 60
export const DEFAULT_TRANSICION_SEG = 45
export const DEFAULT_DEMO_TRANSICION_SEG = 30

export function explicacionSegDeLinea(linea) {
  return Number(linea?.explicacion_seg ?? DEFAULT_EXPLICACION_SEG)
}

export function estacionSegDeLinea(linea) {
  const real = Number(linea?.estacion_seg ?? DEFAULT_ESTACION_SEG)
  const demo = Number(linea?.demo_estacion_seg ?? DEFAULT_DEMO_ESTACION_SEG)
  return linea?.modo_demo ? demo : real
}

export function transicionSegDeLinea(linea) {
  const real = Number(linea?.transicion_seg ?? DEFAULT_TRANSICION_SEG)
  const demo = Number(linea?.demo_transicion_seg ?? DEFAULT_DEMO_TRANSICION_SEG)
  return linea?.modo_demo ? demo : real
}

// Cuánto ocupa un box en total — explicación + estación + transición. Mismo número que
// duracion_box_seg() en la base (ver 20260928140000_transicion_entre_estaciones.sql).
export function duracionBoxSegDeLinea(linea) {
  return explicacionSegDeLinea(linea) + estacionSegDeLinea(linea) + transicionSegDeLinea(linea)
}

// Cuenta regresiva contra un timestamp absoluto (ISO). Nunca cuenta hacia abajo desde un
// número guardado — deriva el restante de Date.now() en cada tick, así una pestaña en
// segundo plano o tapada (que es lo que es una TV para el navegador) no se congela ni acumula
// drift.
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
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
      setSecondsLeft((prev) => (prev !== remaining ? remaining : prev))
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
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
// entró), estación (los estacionSeg que siguen) o transición (todo lo que sigue, hasta que el
// tick lo mueva). Devuelve también los instantes en que arrancó la estación —
// entered_at + explicacionSeg, que es lo que el reloj de formato (AMRAP/EMOM/Tabata/...) tiene
// que usar como origen en vez de entered_at crudo— y en que arrancó la transición.
//
// estacionSeg es opcional: sin él (compatibilidad con pantallas que todavía no lo pasan) la
// fase nunca llega a 'transicion' — se comporta como antes de 2026-09-28, estación indefinida.
export function useBoxPhase(enteredAtIso, explicacionSeg, estacionSeg) {
  const [estado, setEstado] = useState(() => calcular(enteredAtIso, explicacionSeg, estacionSeg))

  useEffect(() => {
    if (!enteredAtIso) {
      setEstado({ fase: null, restanteExplicacionSeg: 0, estacionInicioIso: null, transicionInicioIso: null })
      return
    }
    const tick = () => {
      setEstado((prev) => {
        const next = calcular(enteredAtIso, explicacionSeg, estacionSeg)
        return prev.fase === next.fase && prev.restanteExplicacionSeg === next.restanteExplicacionSeg
          ? prev
          : next
      })
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [enteredAtIso, explicacionSeg, estacionSeg])

  return estado
}

// Exportada aparte de useBoxPhase para poder testear la matemática de fases sin React ni
// timers — ver scripts/check-tvclock-phases.mjs ("lo arreglado no vuelve" del lado del
// admin: rAF->setInterval y la fase de transición no tienen test runner en este repo, así
// que el control es un script de Node que llama esta función pura directamente).
export function calcular(enteredAtIso, explicacionSeg, estacionSeg) {
  if (!enteredAtIso) return { fase: null, restanteExplicacionSeg: 0, estacionInicioIso: null, transicionInicioIso: null }
  const inicioMs = new Date(enteredAtIso).getTime()
  const explicSeg = Math.max(0, Number(explicacionSeg) || 0)
  const estacSeg = estacionSeg == null ? null : Math.max(0, Number(estacionSeg) || 0)
  const estacionInicioIso = new Date(inicioMs + explicSeg * 1000).toISOString()
  const transicionInicioIso =
    estacSeg == null ? null : new Date(inicioMs + (explicSeg + estacSeg) * 1000).toISOString()
  const transcurridoSeg = Math.floor((Date.now() - inicioMs) / 1000)

  if (transcurridoSeg < explicSeg) {
    return { fase: 'explicacion', restanteExplicacionSeg: explicSeg - transcurridoSeg, estacionInicioIso, transicionInicioIso }
  }
  if (estacSeg == null || transcurridoSeg < explicSeg + estacSeg) {
    return { fase: 'estacion', restanteExplicacionSeg: 0, estacionInicioIso, transicionInicioIso }
  }
  return { fase: 'transicion', restanteExplicacionSeg: 0, estacionInicioIso, transicionInicioIso }
}
