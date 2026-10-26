import { supabase } from '../lib/supabase'

/**
 * Genera el resto del mes a partir de las sesiones que el coach escribió a mano
 * (botón "Generar Sesiones"/"Regenerar" en Rutinas).
 *
 * Del lado del servidor desde el 2026-09-24 (ver la migración
 * `20260924140000_generar_sesion_server_side.sql` en tecnofit-supabase): este archivo tenía
 * ~600 líneas que eran el motor entero — qué ejercicio elegía cada estación, qué formato, qué
 * peso — corriendo en el navegador del coach, con ~3 ida-y-vuelta a la base POR SESIÓN
 * (sustitutos en lote por rutina, pesos en lote por sesión, un INSERT por sesión). Con la
 * conexión del admin (~90ms) eso alcanzaba: un mes de 30 sesiones salía en ~10s. Pero Lucas
 * entrena con ~1s de latencia real, y 3 viajes secuenciales × 30 sesiones siguen siendo 90
 * viajes — con 1s cada uno, un minuto y medio de spinner.
 *
 * La solución no era optimizar más el número de viajes: era sacarlos del cliente. Todo el
 * motor (perfilesDeEsfuerzo, techosDelSocio, poolDeSustitutos, generarSesion,
 * filaDeSessionExercise, seededIndex, CIRCUITO/formatoDelBloque/trabajoDelBloque — quien busque
 * alguno de estos nombres, están en la función de Postgres `generar_sesion`, traducidos función
 * por función y verificados con un diff determinístico contra el motor viejo, ver catchup.md)
 * vive ahora en una función de Postgres. Este archivo quedó como el loop: pide una sesión a la
 * vez —eso es lo que permite mostrar "Generando sesión N de 30" en vivo y listar las sesiones a
 * medida que aparecen (Routines.jsx las sondea/suscribe mientras generation_status='generating')—
 * pero cada sesión ahora cuesta UN viaje a la base, no tres, y ninguno de esos tres viajes
 * escondía adentro la verdadera multiplicación (ida-y-vuelta por ejercicio de la sesión): eso
 * quedó como SQL-contra-SQL dentro de la función, no como round-trips de red.
 */
export const generateRoutineSessions = async (routineId) => {
  const { data: routine, error: rError } = await supabase
    .from('training_routines')
    .select('*, users (id)')
    .eq('id', routineId)
    .single()
  if (rError) throw rError

  const totalSessions = routine.total_sessions || 30

  const { data: plantillas, error: pError } = await supabase
    .from('routine_sessions')
    .select('id, session_number, session_exercises (*)')
    .eq('routine_id', routineId)
    .order('session_number')
  if (pError) throw pError

  // What the coach wrote is whatever is not the engine's own work — not the first five sessions.
  // Five is what the gym happens to write on a good week, and hardcoding it meant a coach who
  // wrote one day had nothing to generate from, and a coach who wrote six had the sixth ignored
  // and then overwritten. The base is the hand-written sessions, however many there are.
  const conEjercicios = (plantillas || []).filter((s) =>
    (s.session_exercises || []).some((se) => !se.is_auto_generated)
  )
  const aMano = conEjercicios.length
    ? Math.max(...conEjercicios.map((s) => s.session_number))
    : 0
  if (conEjercicios.length === 0) {
    throw new Error(
      'No hay ninguna sesión cargada a mano para usar de base. Con una alcanza: armá la Sesión 1 y volvé a generar.'
    )
  }

  // Candado: sólo se toma la generación si nadie más la tiene, o si la tiene hace más de 10
  // minutos sin avanzar — eso es "quedó colgada", no "está en curso". La condición vive en el
  // propio UPDATE (no en el SELECT de `routine`, más arriba) porque es la única forma atómica:
  // si dos coaches aprietan "Generar" a la vez, Postgres serializa las dos UPDATE contra la
  // misma fila y sólo la primera encuentra la fila todavía elegible — la segunda vuelve con
  // `tomado` vacío y no sigue. Sin este candado, las dos corridas generaban session_number
  // repetidos y chocaban con routine_sessions_routine_id_session_number_key.
  const DIEZ_MIN_MS = 10 * 60 * 1000
  const staleDesde = new Date(Date.now() - DIEZ_MIN_MS).toISOString()
  const { data: tomado, error: lockError } = await supabase
    .from('training_routines')
    .update({ generation_status: 'generating', generation_progress: 0 })
    .eq('id', routineId)
    .or(`generation_status.neq.generating,updated_at.lt.${staleDesde}`)
    .select('id')
  if (lockError) throw lockError
  if (!tomado?.length) {
    if (routine.generation_status === 'generating') {
      const minutos = routine.updated_at
        ? Math.max(1, Math.round((Date.now() - new Date(routine.updated_at).getTime()) / 60000))
        : null
      throw new Error(
        minutos != null
          ? `Se está generando desde hace ${minutos} min. Esperá a que termine.`
          : 'Se está generando ahora mismo. Esperá a que termine.'
      )
    }
    throw new Error('Otra persona la generó justo ahora. Volvé a intentar en un momento.')
  }

  try {
    // Anything previously generated is replaced. Regenerating after fixing a station should not
    // leave the old month interleaved with the new one.
    const { data: viejas } = await supabase
      .from('routine_sessions')
      .select('id')
      .eq('routine_id', routineId)
      .gt('session_number', aMano)
    if (viejas?.length) {
      await supabase.from('routine_sessions').delete().in('id', viejas.map((s) => s.id))
    }

    // What the last hand-written session used. Without this the first generated session is the
    // only one in the month that does not know what came the day before, and it can repeat it —
    // which is exactly what it did: session 5 finished with squats and session 6 opened with them.
    const ultima = conEjercicios[conEjercicios.length - 1]
    let anterior = (ultima.session_exercises || []).map((se) => se.exercise_id)
    for (let n = aMano + 1; n <= totalSessions; n++) {
      // Rotate through the hand-made sessions so the month keeps their variety instead of
      // orbiting one of them.
      const base = conEjercicios[(n - aMano - 1) % conEjercicios.length]
      // Un solo viaje a la base por sesión: generar_sesion hace TODO adentro (insertar la
      // sesión, elegir cada ejercicio de cada estación, resolver el peso, insertar las filas) y
      // devuelve los exercise_id usados, para pasarlos como "evitar" a la sesión siguiente —
      // mismo contrato que devolvía generarSesion() en JS.
      const { data: usados, error: genError } = await supabase.rpc('generar_sesion', {
        p_routine_id: routineId,
        p_client_id: routine.client_id,
        p_base_session_id: base.id,
        p_session_number: n,
        p_evitar: anterior,
      })
      if (genError) {
        throw new Error(`No se pudo generar la sesión ${n}: ${genError.message}`)
      }
      anterior = usados || []
      // Progreso visible para cualquier pestaña/coach que esté mirando esta rutina (Routines.jsx
      // la sondea/suscribe mientras generation_status = 'generating'). De paso, cada UPDATE
      // re-toca updated_at (trigger ya existente en training_routines) — es el latido que el
      // candado de arriba usa para distinguir una generación en curso de una que quedó colgada.
      await supabase.from('training_routines').update({ generation_progress: n }).eq('id', routineId)
    }

    await supabase
      .from('training_routines')
      .update({ generation_status: 'completed' })
      .eq('id', routineId)

    return { generadas: totalSessions - aMano, desde: conEjercicios.length }
  } catch (error) {
    await supabase
      .from('training_routines')
      .update({ generation_status: 'failed' })
      .eq('id', routineId)
    throw error
  }
}
