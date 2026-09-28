#!/usr/bin/env node
// "Lo arreglado no vuelve" — control para la matemática de fases de tvClock.js (2026-09-28).
//
// El repo no tiene test runner (sin vitest/jest en package.json), así que esto es un script
// de Node liso: llama a `calcular()` (exportada aparte de useBoxPhase para poder testearla
// sin React ni timers) con timestamps sintéticos y afirma en qué fase cae cada uno. Corre con
// `node scripts/check-tvclock-phases.mjs` — sale con status != 0 si algo falla.
//
// Cubre el bug de fondo que motivó el cambio de requestAnimationFrame a setInterval (una TV
// en background se quedaba en la fase vieja) indirectamente: como `calcular()` deriva todo de
// Date.now() en cada llamada y no de un contador que se va acumulando, correrla "tarde" (como
// pasaría en una pestaña que estuvo pausada) tiene que dar la fase correcta igual — así que
// este script llama calcular() en momentos salteados, no en una secuencia continua, y eso ya
// es la prueba de que no depende de haber sido invocada a tiempo.

import { calcular, calcularEstadoEstacion, HOLA_SEG, primerNombre } from '../src/lib/tvClock.js'

let fallos = 0

function assertEq(desc, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado)
  if (!ok) {
    fallos++
    console.error(`FAIL  ${desc}\n      esperado: ${JSON.stringify(esperado)}\n      real:     ${JSON.stringify(real)}`)
  } else {
    console.log(`OK    ${desc}`)
  }
}

function assert(desc, cond) {
  if (!cond) {
    fallos++
    console.error(`FAIL  ${desc}`)
  } else {
    console.log(`OK    ${desc}`)
  }
}

// entered_at fijo, offsets calculados por segundos-atrás para no pelear con el reloj real.
const ahoraMs = Date.now()
function haceSeg(seg) {
  return new Date(ahoraMs - seg * 1000).toISOString()
}

const E = 15 // explicacion_seg
const S = 25 // estacion_seg (o demo)
const T = 12 // transicion_seg (o demo) — no entra en calcular(), sólo delimita fases E/S

// ── null / sin enteredAtIso ────────────────────────────────────────────────────────────
assertEq('sin enteredAtIso -> fase null', calcular(null, E, S), {
  fase: null, restanteExplicacionSeg: 0, estacionInicioIso: null, transicionInicioIso: null,
})

// ── explicación: [0, E) ────────────────────────────────────────────────────────────────
{
  const r = calcular(haceSeg(0), E, S)
  assertEq('recién entró -> explicacion, restante = E', { fase: r.fase, restante: r.restanteExplicacionSeg }, { fase: 'explicacion', restante: E })
}
{
  const r = calcular(haceSeg(E - 1), E, S)
  assertEq('un segundo antes de que termine la explicación -> explicacion, restante = 1', { fase: r.fase, restante: r.restanteExplicacionSeg }, { fase: 'explicacion', restante: 1 })
}

// ── estación: [E, E+S) ─────────────────────────────────────────────────────────────────
{
  const r = calcular(haceSeg(E), E, S)
  assertEq('justo al terminar la explicación -> estacion', r.fase, 'estacion')
}
{
  const r = calcular(haceSeg(E + S - 1), E, S)
  assertEq('un segundo antes de que termine la estación -> estacion', r.fase, 'estacion')
}

// ── transición: [E+S, ...) ─────────────────────────────────────────────────────────────
{
  const r = calcular(haceSeg(E + S), E, S)
  assertEq('justo al terminar la estación -> transicion', r.fase, 'transicion')
}
{
  const r = calcular(haceSeg(E + S + T + 999), E, S)
  assertEq('mucho después (el tick todavía no lo movió) -> sigue en transicion, no hay una cuarta fase', r.fase, 'transicion')
}

// ── compatibilidad: sin estacionSeg (pantallas viejas) nunca llega a transición ─────────
{
  const r = calcular(haceSeg(E + S + T + 999), E, null)
  assertEq('sin estacionSeg -> nunca transicion, se queda en estacion indefinida', r.fase, 'estacion')
}

// ── estacionInicioIso / transicionInicioIso son E y E+S segundos después de entered_at ──
{
  const entrada = haceSeg(0)
  const r = calcular(entrada, E, S)
  const inicioMs = new Date(entrada).getTime()
  assert('estacionInicioIso = entered_at + E', Math.abs(new Date(r.estacionInicioIso).getTime() - (inicioMs + E * 1000)) < 5)
  assert('transicionInicioIso = entered_at + E + S', Math.abs(new Date(r.transicionInicioIso).getTime() - (inicioMs + (E + S) * 1000)) < 5)
}

// ── Estado de la pantalla de estación: off / llegando (hola) / explicacion / preparate /
//    estacion / chau (2026-09-28) ───────────────────────────────────────────────────────────
{
  const linea = { explicacion_seg: 60, estacion_seg: 420, demo_estacion_seg: 60, modo_demo: true }
  const ocupado = (segAtras, socio = 'Valentina R.') => ({ status: 'occupied', line_position: 1, entered_at: haceSeg(segAtras), socio })
  const est = (o) => calcularEstadoEstacion({ line: linea, posicion: 1, boxes: [], nowMs: ahoraMs, ...o })

  assertEq('primerNombre toma sólo el nombre de pila', primerNombre('Valentina R.'), 'Valentina')

  // socio recién entrado: los primeros HOLA_SEG segundos son "Hola" con contador 5..1
  assertEq('recién entró -> llegando con contador HOLA_SEG', est({ box: ocupado(0) }),
    { estado: 'llegando', nombre: 'Valentina', sticker: false, restanteHolaSeg: HOLA_SEG })
  assertEq('a los 4 s -> llegando, contador 1', est({ box: ocupado(HOLA_SEG - 1) }).restanteHolaSeg, 1)
  assertEq('a los 5 s -> ya es explicacion', est({ box: ocupado(HOLA_SEG) }).estado, 'explicacion')
  assertEq('explicacion conserva el restante del minuto entero (los 5 s salen de ahí)', est({ box: ocupado(20) }).restanteExplicacionSeg, 40)

  // últimos 10 s de la explicación -> preparate
  assertEq('a 11 s del final -> explicacion', est({ box: ocupado(49) }).estado, 'explicacion')
  assertEq('a 10 s del final -> preparate', est({ box: ocupado(50) }), { estado: 'preparate', restanteExplicacionSeg: 10 })
  assertEq('a 1 s del final -> preparate, restante 1', est({ box: ocupado(59) }).restanteExplicacionSeg, 1)

  // estación y chau (transición)
  assertEq('estación corriendo', est({ box: ocupado(60) }).estado, 'estacion')
  assertEq('fin de estación -> chau', est({ box: ocupado(120) }).estado, 'chau')

  // box libre
  assertEq('libre y nadie viene -> off', est({ box: { status: 'free', line_position: 1 } }).estado, 'off')
  assertEq('box 1 libre con confirmando -> llegando con sticker', est({ box: { status: 'free', line_position: 1 }, confirmando: { socio: 'Joaquín P.' } }),
    { estado: 'llegando', nombre: 'Joaquín', sticker: true, restanteHolaSeg: null })
  {
    const boxes = (segAtras) => [
      { status: 'occupied', line_position: 1, entered_at: haceSeg(segAtras), socio: 'Valentina R.' },
      { status: 'free', line_position: 2 },
    ]
    const libre2 = { status: 'free', line_position: 2 }
    const e2 = (segAtras) => est({ posicion: 2, box: libre2, boxes: boxes(segAtras), confirmando: { socio: 'No importa' } })
    assertEq('box 2 libre, el del box 1 sigue en estación -> off (confirmando no aplica al box 2)', e2(90).estado, 'off')
    assertEq('box 2 libre, el del box 1 entró en transición -> llegando SIN sticker', e2(125),
      { estado: 'llegando', nombre: 'Valentina', sticker: false, restanteHolaSeg: null })
  }
}

console.log('')
if (fallos > 0) {
  console.error(`${fallos} assert(s) fallaron`)
  process.exit(1)
}
console.log('check-tvclock-phases: todo OK')
