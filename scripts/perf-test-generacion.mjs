// Script temporal de medición/verificación para el fix de performance de generación de
// rutinas (2026-09-24). Corre con `npx vite-node scripts/perf-test-generacion.mjs`, así toma
// las env vars de .env.local igual que la app (import.meta.env). No se importa desde ningún
// componente — es una herramienta de una sola vez, se puede borrar después.
//
// Uso: node (vite-node) scripts/perf-test-generacion.mjs <routineId>
//   - Genera la rutina, mide el tiempo total.
//   - Imprime, por sesión, la secuencia de exercise_id elegidos (orden por exercise_order),
//     para poder diffear contra una corrida anterior (determinismo).

import { readFileSync } from 'node:fs'
import { generateRoutineSessions } from '../src/services/routineGenerationService.js'
import { supabase } from '../src/lib/supabase.js'

const routineId = Number(process.argv[2])
if (!routineId) {
  console.error('Uso: vite-node scripts/perf-test-generacion.mjs <routineId> [sessionJsonPath]')
  process.exit(1)
}

// RLS exige un auth.uid() de coach/admin — se autentica con la sesión abierta por
// scripts/supabase-session.py (mateoaldao@gmail.com es super_admin en sellers, staging).
const sessionPath = process.argv[3] || '/tmp/tecno_staging_full_session.json'
const sessionData = JSON.parse(readFileSync(sessionPath, 'utf8'))
const { error: authError } = await supabase.auth.setSession({
  access_token: sessionData.access_token,
  refresh_token: sessionData.refresh_token,
})
if (authError) {
  console.error('No se pudo autenticar:', authError.message)
  process.exit(1)
}

const t0 = Date.now()
const resultado = await generateRoutineSessions(routineId)
const t1 = Date.now()

console.log(`\n=== Generación de rutina ${routineId} ===`)
console.log(`Tiempo total: ${((t1 - t0) / 1000).toFixed(1)}s`)
console.log(`Sesiones generadas: ${resultado.generadas} (desde ${resultado.desde} escritas a mano)`)

const { data: sesiones, error } = await supabase
  .from('routine_sessions')
  .select('session_number, session_exercises(exercise_id, exercise_order, box_number, is_cooldown)')
  .eq('routine_id', routineId)
  .order('session_number')

if (error) {
  console.error('Error leyendo sesiones:', error.message)
  process.exit(1)
}

console.log('\n=== Huella determinística (session_number: [exercise_ids en orden]) ===')
for (const s of sesiones) {
  const ids = [...(s.session_exercises || [])]
    .sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
    .map((se) => se.exercise_id)
  console.log(`${s.session_number}: ${ids.join(',')}`)
}
