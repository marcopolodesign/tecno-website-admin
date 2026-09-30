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
import { serverNow } from './serverClock.js'

const TICK_MS = 250

export const DEFAULT_EXPLICACION_SEG = 60
export const DEFAULT_ESTACION_SEG = 420
export const DEFAULT_DEMO_ESTACION_SEG = 60
export const DEFAULT_TRANSICION_SEG = 30
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
// número guardado — deriva el restante de serverNow() en cada tick, así una pestaña en
// segundo plano o tapada (que es lo que es una TV para el navegador) no se congela ni acumula
// drift.
export function useCountdown(targetIso) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    targetIso ? Math.max(0, Math.ceil((new Date(targetIso).getTime() - serverNow()) / 1000)) : null
  )

  useEffect(() => {
    if (!targetIso) {
      setSecondsLeft(null)
      return
    }
    const targetMs = new Date(targetIso).getTime()
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((targetMs - serverNow()) / 1000))
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
export function calcular(enteredAtIso, explicacionSeg, estacionSeg, nowMs = serverNow()) {
  if (!enteredAtIso) return { fase: null, restanteExplicacionSeg: 0, estacionInicioIso: null, transicionInicioIso: null }
  const inicioMs = new Date(enteredAtIso).getTime()
  const explicSeg = Math.max(0, Number(explicacionSeg) || 0)
  const estacSeg = estacionSeg == null ? null : Math.max(0, Number(estacionSeg) || 0)
  const estacionInicioIso = new Date(inicioMs + explicSeg * 1000).toISOString()
  const transicionInicioIso =
    estacSeg == null ? null : new Date(inicioMs + (explicSeg + estacSeg) * 1000).toISOString()
  const transcurridoSeg = Math.floor((nowMs - inicioMs) / 1000)

  if (transcurridoSeg < explicSeg) {
    return { fase: 'explicacion', restanteExplicacionSeg: explicSeg - transcurridoSeg, estacionInicioIso, transicionInicioIso }
  }
  if (estacSeg == null || transcurridoSeg < explicSeg + estacSeg) {
    return { fase: 'estacion', restanteExplicacionSeg: 0, estacionInicioIso, transicionInicioIso }
  }
  return { fase: 'transicion', restanteExplicacionSeg: 0, estacionInicioIso, transicionInicioIso }
}

// ── Estado de la pantalla de estación (2026-09-28) ─────────────────────────────────────────
// La TV de estación es UNA pantalla con estados (off / llegando / explicacion / preparate /
// estacion / chau). Esta función pura decide en cuál está a partir del payload de tv_linea y
// de la hora, así se puede testear sin React (scripts/check-tvclock-phases.mjs).
//
// 'llegando' junta dos casos que se ven igual ("Hola <nombre>"):
//   · el box está libre y viene alguien: en el box 1, `confirmando` apunta a esta línea (es el
//     único donde se apoya el teléfono, `sticker: true`); en el box N>1, el socio del box N-1
//     ya está en su transición (viene para acá).
//   · el socio recién entró a ESTE box: los primeros HOLA_SEG segundos salen del minuto de
//     explicación (sin cambios en la base) y llevan un contador 5-4-3-2-1.
export const HOLA_SEG = 5
export const PREPARATE_SEG = 5

export function primerNombre(socio) {
  return String(socio || '').trim().split(/\s+/)[0] || ''
}

// Cómo saludar (2026-09-30): el nombre de pila (users.first_name) o, si falta, el apodo
// (preferred_name) — los dos ya vienen resueltos en `nombre` desde tv_linea. Si el payload es
// viejo y no trae `nombre`, cae al primer token de `socio` ("Valentina R." -> "Valentina").
export function nombreDeSaludo(obj) {
  return String(obj?.nombre || '').trim() || primerNombre(obj?.socio)
}

// Resumen de fin de circuito en la TV de la última estación: los últimos RESUMEN_MAX_SEG de la
// transición (o la mitad de ella si es más corta). Va DENTRO de la transición y no después:
// cuando el box se libera el que llega ya está entrando y le taparía la explicación.
export const RESUMEN_MAX_SEG = 15

// Movimiento box→box PREDICHO en el instante de advances_at (2026-09-29). El tick del servidor
// corre cada 10 s y la TV se enteraba recién por realtime/poll: hasta ~20 s clavada en 0:00.
// Como todo sale de timestamps que ya vienen en tv_linea, se calcula acá mismo, sin ida y
// vuelta, con la misma regla que advance-queue-tick (de atrás para adelante, así el box que
// se libera en el mismo instante ya cuenta como libre para el de atrás):
//   · el último box: quien vence sale (queda libre).
//   · el siguiente libre: el socio entra ahí con entered_at = su advances_at (o cuando el
//     siguiente se liberó, si fue después) y advances_at = entered_at + duración del box.
//   · el siguiente ocupado y que NO vence: cuello de botella, no se predice nada.
// Idempotente: sobre un payload ya movido por el servidor no cambia nada (reconciliación
// silenciosa: si el servidor coincide no hay parpadeo; si no, manda el servidor).
export function predecirBoxes(boxes = [], line, nowMs = serverNow()) {
  if (!boxes.length) return boxes
  const dur = duracionBoxSegDeLinea(line)
  const orden = [...boxes].sort((a, b) => Number(b.line_position) - Number(a.line_position))
  const por = new Map(boxes.map((b) => [Number(b.line_position), { ...b }]))
  const liberadoEn = new Map()
  let huboCambios = false
  for (const orig of orden) {
    const b = por.get(Number(orig.line_position))
    if (b.status !== 'occupied' || !b.advances_at) continue
    const vence = new Date(b.advances_at).getTime()
    if (vence > nowMs) continue
    const sig = por.get(Number(b.line_position) + 1)
    const libre = (x) => ({ ...x, status: 'free', socio: null, nombre: null, ingreso_at: null, kg: null, entered_at: null, advances_at: null, riesgo: null })
    if (!sig) {
      por.set(Number(b.line_position), libre(b))
      liberadoEn.set(Number(b.line_position), vence)
      huboCambios = true
    } else if (sig.status === 'free') {
      const entrada = Math.max(vence, liberadoEn.get(Number(sig.line_position)) ?? 0)
      por.set(Number(sig.line_position), {
        ...sig,
        status: 'occupied',
        socio: b.socio,
        nombre: b.nombre,
        riesgo: b.riesgo,
        entered_at: new Date(entrada).toISOString(),
        advances_at: new Date(entrada + dur * 1000).toISOString(),
      })
      por.set(Number(b.line_position), libre(b))
      liberadoEn.set(Number(b.line_position), vence)
      huboCambios = true
    }
  }
  return huboCambios ? boxes.map((b) => por.get(Number(b.line_position))) : boxes
}

export function calcularEstadoEstacion({ box: boxCrudo, boxes: boxesCrudos = [], confirmando = null, posicion, line, nowMs = serverNow() }) {
  const boxes = predecirBoxes(boxesCrudos, line, nowMs)
  const box = boxes.find((b) => Number(b.line_position) === Number(posicion)) ?? boxCrudo
  const E = explicacionSegDeLinea(line)
  const S = estacionSegDeLinea(line)
  const pos = Number(posicion)

  if (box?.status === 'occupied' && box.entered_at) {
    const c = calcular(box.entered_at, E, S, nowMs)
    const transcurrido = Math.floor((nowMs - new Date(box.entered_at).getTime()) / 1000)
    if (c.fase === 'explicacion') {
      if (transcurrido < HOLA_SEG) {
        return { estado: 'llegando', nombre: nombreDeSaludo(box), sticker: false, restanteHolaSeg: HOLA_SEG - transcurrido }
      }
      const r = c.restanteExplicacionSeg
      if (r > 0 && r <= PREPARATE_SEG) return { estado: 'preparate', restanteExplicacionSeg: r }
      return { estado: 'explicacion', restanteExplicacionSeg: r, estacionInicioIso: c.estacionInicioIso }
    }
    if (c.fase === 'transicion') {
      const esUltima = pos === Math.max(...boxes.map((b) => Number(b.line_position)))
      if (esUltima && box.advances_at) {
        const resumenSeg = Math.min(RESUMEN_MAX_SEG, Math.floor(transicionSegDeLinea(line) / 2))
        const finMs = new Date(box.advances_at).getTime()
        if (resumenSeg > 0 && nowMs >= finMs - resumenSeg * 1000) {
          const desdeMs = new Date(box.ingreso_at || box.entered_at).getTime()
          return {
            estado: 'resumen',
            nombre: nombreDeSaludo(box),
            minutos: box.ingreso_at ? Math.max(1, Math.round((finMs - desdeMs) / 60000)) : null,
            estaciones: boxes.length,
            kg: Number(box.kg) > 0 ? Number(box.kg) : null,
          }
        }
      }
      return { estado: 'chau' }
    }
    return { estado: 'estacion', estacionInicioIso: c.estacionInicioIso }
  }

  if (pos === 1 && confirmando) {
    return { estado: 'llegando', nombre: nombreDeSaludo(confirmando), sticker: true, restanteHolaSeg: null }
  }
  if (pos > 1) {
    const prev = boxes.find((b) => Number(b.line_position) === pos - 1)
    if (prev?.status === 'occupied' && prev.entered_at && calcular(prev.entered_at, E, S, nowMs).fase === 'transicion') {
      return { estado: 'llegando', nombre: nombreDeSaludo(prev), sticker: false, restanteHolaSeg: null }
    }
  }
  return { estado: 'off' }
}
