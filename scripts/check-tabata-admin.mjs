// "Lo arreglado no vuelve": Tabata = 6 rondas de 60 s (40/20 o 30/30), pisos 30/20.
// Corre con: node scripts/check-tabata-admin.mjs  (espejo del check SQL en tecnofit-supabase).
import assert from 'node:assert/strict'
import { PRESETS, TABATA_PRESETS, acotarTiemposTabata, duracionSeg, BLOQUE_SEG } from '../src/lib/formatos.js'

for (const p of [PRESETS.Tabata, ...Object.values(TABATA_PRESETS)]) {
  assert.equal(p.rondas, 6)
  assert.equal(p.trabajoSeg + p.descansoSeg, 60)
  assert.ok(p.trabajoSeg >= 30 && p.descansoSeg >= 20)
  assert.equal(duracionSeg(p), BLOQUE_SEG)
}
assert.deepEqual([TABATA_PRESETS.normal.trabajoSeg, TABATA_PRESETS.normal.descansoSeg], [40, 20])
assert.deepEqual([TABATA_PRESETS.suave.trabajoSeg, TABATA_PRESETS.suave.descansoSeg], [30, 30])

for (const [t, d, r, esperado] of [
  [20, 10, 12, [30, 30]], [25, 10, 8, [30, 30]], [35, 99, 3, [35, 25]],
  [40, 0, 6, [40, 20]], [50, 5, 6, [40, 20]], [30, 20, 7, [30, 30]], [undefined, undefined, undefined, [40, 20]],
]) {
  const a = acotarTiemposTabata('Tabata', t, d, r)
  assert.equal(a.rondas, 6, `rondas para ${t}/${d}`)
  assert.deepEqual([a.trabajoSeg, a.descansoSeg], esperado, `${t}/${d}`)
}
const otro = acotarTiemposTabata('EMOM', 60, 0, 6)
assert.deepEqual(otro, { rondas: 6, trabajoSeg: 60, descansoSeg: 0 })
console.log('OK: Tabata admin = 6 x (40/20 | 30/30), trabajo 30-40, descanso = 60 - trabajo')
