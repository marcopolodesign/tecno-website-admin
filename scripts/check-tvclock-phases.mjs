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

import { calcular } from '../src/lib/tvClock.js'

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

console.log('')
if (fallos > 0) {
  console.error(`${fallos} assert(s) fallaron`)
  process.exit(1)
}
console.log('check-tvclock-phases: todo OK')
