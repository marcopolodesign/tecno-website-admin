import { supabase } from '../lib/supabase'

/**
 * Service for routine auto-generation and coach overrides
 */

// =====================================================
// EXERCISE GROUPS
// =====================================================

export const getExerciseGroups = async () => {
  const { data, error } = await supabase
    .from('exercise_groups')
    .select(`
      *,
      body_zones (id, name)
    `)
    .order('display_order')
  
  if (error) throw error
  return data
}

export const createExerciseGroup = async (groupData) => {
  const { data, error } = await supabase
    .from('exercise_groups')
    .insert([groupData])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateExerciseGroup = async (id, groupData) => {
  const { data, error } = await supabase
    .from('exercise_groups')
    .update(groupData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// =====================================================
// PRODUCTION LINES
// =====================================================

export const getProductionLines = async (locationId = null) => {
  let query = supabase
    .from('production_lines')
    .select(`
      *,
      locations (id, name),
      boxes (id, name, box_number)
    `)
    .order('line_number')
  
  if (locationId) {
    query = query.eq('location_id', locationId)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export const createProductionLine = async (lineData) => {
  const { data, error } = await supabase
    .from('production_lines')
    .insert([lineData])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateProductionLine = async (id, lineData) => {
  const { data, error } = await supabase
    .from('production_lines')
    .update(lineData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// =====================================================
// LINE BOX STATUS (Real-time queue management)
// =====================================================

export const getLineBoxStatus = async (productionLineId = null) => {
  let query = supabase
    .from('line_box_status')
    .select(`
      *,
      production_lines (id, name, line_number),
      boxes (id, name, box_number),
      users (id, first_name, last_name)
    `)
  
  if (productionLineId) {
    query = query.eq('production_line_id', productionLineId)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export const updateLineBoxStatus = async (id, statusData) => {
  const { data, error } = await supabase
    .from('line_box_status')
    .update({
      ...statusData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// =====================================================
// SIMILAR EXERCISES (for auto-generation)
// =====================================================

export const getSimilarExercises = async (exerciseId, userId, boxId, excludeIds = []) => {
  const { data, error } = await supabase
    .rpc('get_similar_exercises', {
      p_exercise_id: exerciseId,
      p_user_id: userId,
      p_box_id: boxId,
      p_exclude_ids: excludeIds
    })
  
  if (error) throw error
  return data
}

// =====================================================
// COACH OVERRIDES
// =====================================================

/**
 * Override an auto-generated exercise with a coach-selected one
 * @param {number} sessionExerciseId - The session_exercise to modify
 * @param {number} newExerciseId - The new exercise to use
 * @param {string} coachId - The coach's auth user ID
 * @param {boolean} lockExercise - Whether to lock this from future regeneration
 */
export const overrideExercise = async (sessionExerciseId, newExerciseId, coachId, lockExercise = true) => {
  const { data, error } = await supabase
    .rpc('override_session_exercise', {
      p_session_exercise_id: sessionExerciseId,
      p_new_exercise_id: newExerciseId,
      p_coach_id: coachId,
      p_lock_exercise: lockExercise
    })
  
  if (error) throw error
  return data
}

/**
 * Revert a coach override back to the original auto-generated exercise
 */
export const revertExerciseOverride = async (sessionExerciseId, coachId) => {
  const { data, error } = await supabase
    .rpc('revert_exercise_override', {
      p_session_exercise_id: sessionExerciseId,
      p_coach_id: coachId
    })
  
  if (error) throw error
  return data
}

/**
 * Lock/unlock an exercise from being regenerated
 */
export const toggleExerciseLock = async (sessionExerciseId, isLocked) => {
  const { data, error } = await supabase
    .from('session_exercises')
    .update({ 
      is_locked: isLocked,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionExerciseId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// =====================================================
// SESSION EXERCISES WITH OVERRIDE INFO
// =====================================================

export const getSessionExercisesWithOverrides = async (sessionId) => {
  const { data, error } = await supabase
    .from('session_exercises')
    .select(`
      *,
      exercises!session_exercises_exercise_id_fkey (
        id, name, description, difficulty_level,
        exercise_groups (id, name, body_zones (id, name))
      ),
      original_exercise:exercises!session_exercises_original_exercise_id_fkey (
        id, name
      ),
      boxes (id, name, box_number)
    `)
    .eq('session_id', sessionId)
    .order('box_number')
    .order('exercise_order')
  
  if (error) throw error
  
  // Add computed fields
  return data.map(se => ({
    ...se,
    sourceDescription: getSourceDescription(se),
    canRevert: se.is_coach_override && se.original_exercise_id != null
  }))
}

function getSourceDescription(sessionExercise) {
  if (sessionExercise.is_coach_override) return 'Coach Override'
  if (sessionExercise.is_auto_generated) {
    switch (sessionExercise.generation_source) {
      case 'similar': return 'Auto (Similar)'
      case 'random': return 'Auto (Random)'
      case 'template': return 'From Template'
      default: return 'Auto-generated'
    }
  }
  return 'Manual'
}

// =====================================================
// ROUTINE GENERATION
// =====================================================

/**
 * Get exercises suitable for a specific box based on user profile
 */
export const getExercisesForBox = async (boxId, userId) => {
  // First get the user's fitness profile
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('fitness_capacity, fitness_intensity, age_category_id')
    .eq('id', userId)
    .single()
  
  if (userError) throw userError
  
  // Get groups available for this box
  const { data: boxGroups, error: bgError } = await supabase
    .from('box_groups')
    .select('group_id')
    .eq('box_id', boxId)
  
  if (bgError) throw bgError
  
  const groupIds = boxGroups.map(bg => bg.group_id)
  
  // Get exercises from those groups
  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select(`
      *,
      exercise_groups (id, name, body_zones (id, name))
    `)
    .in('group_id', groupIds.length > 0 ? groupIds : [0])
    .eq('is_active', true)
    .order('priority', { ascending: false })
  
  if (exError) throw exError
  
  return exercises
}

// Deterministic string hash (FNV-1a) — same inputs always produce the same pick, so
// regenerating a routine is reproducible instead of silently landing on a different exercise
// every run. Concept ported (not code — his was PHP crc32) from Lucas Barral's
// RutinaMaterializerService.
function seededIndex(seed, length) {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return length > 0 ? hash % length : 0
}

/**
 * What to put in the weight field of a generated exercise.
 *
 * Uses peso_sugerido, which falls back to the exercise's family when the member has no history
 * on this one — which is most of the time here, since the whole point of generating is that the
 * exercise is new to them. The old helper only matched the exact exercise, so a generated month
 * came out with every weight blank.
 */
async function getProposedWeight(userId, exerciseId) {
  if (!userId || !exerciseId) return null
  const { data } = await supabase.rpc('peso_sugerido', {
    p_user_id: userId,
    p_exercise_id: exerciseId,
  })
  return data?.[0]?.kg ?? null
}

/**
 * Which timed formats a given exercise can be run as.
 *
 * The three formats are not interchangeable, and the difference is the exercise, not the taste
 * of whoever wrote the session:
 *
 *   EMOM   — reps inside a 60s window; the rest is whatever is left over, so the member paces
 *            themselves and the pause is forced. Tolerates anything. Always allowed.
 *   Tabata — 20s all-out, eight times. Only works on something you can do fast without thinking.
 *   AMRAP  — eight continuous minutes. Nothing forces a pause, so it needs a movement you can
 *            still hold together while tired.
 *
 * The two catalog fields answer two different questions, and mixing them up is what makes a
 * generated session look wrong to a coach:
 *
 *   complejidad_tecnica  — can this be done fast at all? A coordination-ladder drill cannot,
 *                          at any intensity. Complejidad 3 gets EMOM and nothing else.
 *   intensidad_relativa  — can this be sustained for eight minutes? Burpees are the textbook
 *                          Tabata and a terrible AMRAP; that is intensidad 3, not complexity.
 *
 * Both are 1-3 and filled in for 298 of the 310 exercises. Missing means EMOM only — the
 * conservative one — rather than a guess made from an empty field.
 */
/**
 * Los techos que le pone el arquetipo del socio.
 *
 * Un arquetipo no dice qué entrenar, dice hasta dónde: alguien que arranca no debería recibir lo
 * más técnico del catálogo por más que el patrón de movimiento coincida. Sin arquetipo cargado no
 * hay techo y el motor se comporta como siempre.
 */
async function techosDelSocio(userId) {
  if (!userId) return null
  const { data } = await supabase.rpc('techos_del_socio', { p_user_id: userId })
  return data?.[0] ?? null
}

async function perfilesDeEsfuerzo() {
  // The whole catalog in one query rather than a lookup per generated station: a month of five
  // stations is 125 of them, and this is 310 rows of three small columns.
  const { data } = await supabase
    .from('exercises')
    .select('id, complejidad_tecnica, intensidad_relativa, family_code')
    .eq('is_active', true)
  return new Map((data || []).map((e) => [e.id, e]))
}

function formatosPosibles(ejercicio) {
  const posibles = ['EMOM']
  const complejidad = ejercicio?.complejidad_tecnica
  const intensidad = ejercicio?.intensidad_relativa
  if (complejidad == null || intensidad == null) return posibles

  if (complejidad <= 2) posibles.push('Tabata')
  if (complejidad <= 2 && intensidad <= 2) posibles.push('AMRAP')
  return posibles
}

// A station is a circuit, not an exercise. The gym runs five stations of about six minutes each,
// and inside a station the member cycles through several movements — the routines CENTRAL has for
// August are all three exercises of 25s work / 15s rest, repeated three times: 3 × 3 × 40s = 6:00.
//
// Six minutes is the target, not a rule. What is fixed is that the station takes the same slot in
// the line whichever format it runs, so the queue never has to care.
const BLOQUE_SEG = 360

/**
 * Si un ejercicio entra bajo el techo del arquetipo del socio.
 *
 * El techo se aplica sólo cuando queda alguien debajo: es preferible ofrecerle algo por encima
 * del techo que dejarle un hueco en el circuito, porque el hueco lo ve en el piso y el techo es
 * una preferencia, no una contraindicación. Para lo que no se negocia están las
 * contraindicaciones, que filtran antes y sin excepción.
 */
function dentroDelTecho(ejercicio, techos) {
  if (!techos) return true
  const { complejidad_max: cMax, intensidad_max: iMax } = techos
  const c = ejercicio?.complejidad_tecnica
  const i = ejercicio?.intensidad_relativa
  if (cMax != null && c != null && c > cMax) return false
  if (iMax != null && i != null && i > iMax) return false
  return true
}

/**
 * How a station of BLOQUE_SEG runs under each format: how long the circuit prefers to be, and
 * what one turn of one exercise costs.
 *
 * Locking every station to three exercises is a limitation of Tabata, not of the gym — with a
 * clock per round it is the count that divides evenly. EMOM and AMRAP do not have that problem,
 * so the circuit length changes with the format and the member stops recognising the station by
 * its shape.
 *
 *   Tabata  4 × (20s + 10s) × 3 vueltas = 6:00   — el clásico, con un ejercicio más
 *   EMOM    3 × 60s × 2 vueltas          = 6:00   — un movimiento por minuto
 *   AMRAP   4 ejercicios en 6:00 corridos         — las vueltas las pone el socio
 *   Series  lo que escribió el coach, sin reloj   — carga y repeticiones
 *
 * `rondas` no está acá: sale de dividir los seis minutos por lo que ocupa una vuelta del
 * circuito, así el bloque cierra en 6:00 aunque queden menos ejercicios de los preferidos.
 */
const CIRCUITO = {
  Tabata: { ejercicios: 4, celda: 30, trabajo: 20, descanso: 10, reps: 'máx por ronda' },
  EMOM: { ejercicios: 3, celda: 60, trabajo: 60, descanso: 0, reps: '10 por minuto' },
  AMRAP: { ejercicios: 4, celda: null, trabajo: null, descanso: 0, reps: '10 por vuelta' },
}

/**
 * El trabajo de una estación: cuántas vueltas y cuánto dura cada turno, para que el bloque cierre
 * en seis minutos con los ejercicios que efectivamente entraron.
 *
 * En AMRAP el reloj es uno solo para todo el bloque — el socio da las vueltas que pueda. Se
 * reparte igual entre los ejercicios porque la duración de la estación es lo que la cola tiene
 * que poder consultar, y una estación que dice durar veinticuatro minutos rompe la línea.
 */
function trabajoDelBloque(formato, cantidad) {
  const c = CIRCUITO[formato]
  if (formato === 'AMRAP') {
    const parte = Math.round(BLOQUE_SEG / cantidad)
    return { formato, rondas: 1, trabajo_seg: parte, descanso_seg: 0, sets_reps: c.reps }
  }
  const rondas = Math.max(1, Math.round(BLOQUE_SEG / (cantidad * c.celda)))
  return {
    formato, rondas, trabajo_seg: c.trabajo, descanso_seg: c.descanso, sets_reps: c.reps,
  }
}

/**
 * Which format the station is going to run — decided before the exercises, not after.
 *
 * The whole circuit runs under one format, so every movement in it has to tolerate that format:
 * one technical lift at 20s all-out is enough to make a Tabata a bad idea for the whole station.
 * Choosing the format first and then filling the circuit with movements that tolerate it is what
 * keeps the variety; deciding afterwards means one awkward candidate drags every station back to
 * EMOM, which is what happened the first time.
 *
 * Series is left alone. The coach prescribing sets and reps decided the station is strength work;
 * turning it into a Tabata changes what the station is for, not how it is measured.
 */
function formatoDelBloque(plantilla, semilla, techos) {
  if (!plantilla.formato || plantilla.formato === 'Series') return null
  // Las que prefiere el arquetipo, si declaró alguna. Sigue eligiendo entre varias: una sola
  // modalidad para todo el mes es el problema que vinimos a resolver.
  const preferidas = (techos?.formatos_preferidos || []).filter((f) => CIRCUITO[f])
  const opciones = preferidas.length ? preferidas : Object.keys(CIRCUITO)
  return opciones[seededIndex(semilla, opciones.length)]
}

/**
 * Generate the rest of the month from the sessions the coach wrote by hand.
 *
 * The gym's flow: the first few sessions are written by a person, the rest are the engine's job.
 * Each generated session takes one of the hand-made ones as its shape — same stations, same sets
 * and reps, same rest — and swaps every exercise for one that shares its movement pattern, that
 * the station can actually run, and that the member is not contraindicated for.
 *
 * Deterministic on purpose. Regenerating a routine has to land on the same month, or nobody can
 * tell whether a change they made did anything.
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

  await supabase
    .from('training_routines')
    .update({ generation_status: 'generating' })
    .eq('id', routineId)

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

    const perfiles = await perfilesDeEsfuerzo()
    const techos = await techosDelSocio(routine.client_id)

    // What the last hand-written session used. Without this the first generated session is the
    // only one in the month that does not know what came the day before, and it can repeat it —
    // which is exactly what it did: session 5 finished with squats and session 6 opened with them.
    const ultima = conEjercicios[conEjercicios.length - 1]
    let anterior = (ultima.session_exercises || []).map((se) => se.exercise_id)
    for (let n = aMano + 1; n <= totalSessions; n++) {
      // Rotate through the hand-made sessions so the month keeps their variety instead of
      // orbiting one of them.
      const base = conEjercicios[(n - aMano - 1) % conEjercicios.length]
      anterior = await generarSesion(routineId, routine.client_id, base, n, anterior, perfiles, techos)
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

/** One generated session. Returns the exercise ids it used, for the next one to avoid. */
async function generarSesion(routineId, clientId, base, sessionNumber, evitar, perfiles, techos) {
  // Yesterday's movements, as families rather than ids.
  const familiasAyer = new Set(
    evitar.map((id) => perfiles?.get(id)?.family_code).filter(Boolean)
  )

  const { data: session, error: sError } = await supabase
    .from('routine_sessions')
    .insert([{
      routine_id: routineId,
      title: `Sesión ${sessionNumber}`,
      session_number: sessionNumber,
      status: 'locked',
    }])
    .select()
    .single()
  if (sError) throw sError

  const usados = []
  // exercise_order is UNIQUE per session, so it is numbered across the session and not per
  // station — the same constraint that used to make the admin's own form collide.
  let orden = 0

  // Group the template by station. The station is what gets generated: its format, how long the
  // circuit is and which movements are in it are one decision, not one per row.
  const estaciones = new Map()
  for (const te of [...(base.session_exercises || [])].sort(
    (a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0)
  )) {
    const clave = te.is_cooldown ? `cool-${te.exercise_order}` : `box-${te.box_number}`
    if (!estaciones.has(clave)) estaciones.set(clave, [])
    estaciones.get(clave).push(te)
  }

  for (const [, plantillas] of estaciones) {
    const cabeza = plantillas[0]

    // A cooldown has no station, so there is nothing to rotate it against — it carries over.
    if (cabeza.is_cooldown || !cabeza.box_number) {
      orden += 1
      await insertarEjercicio(session.id, cabeza, cabeza.exercise_id, orden, 'template', {
        formato: cabeza.formato || 'Series',
        rondas: cabeza.rondas,
        trabajo_seg: cabeza.trabajo_seg,
        descanso_seg: cabeza.descanso_seg,
        sets_reps: cabeza.sets_reps,
      }, await getProposedWeight(clientId, cabeza.exercise_id))
      usados.push(cabeza.exercise_id)
      continue
    }

    const semillaEstacion = `${routineId}-${sessionNumber}-f${cabeza.box_number}`
    const formato = formatoDelBloque(cabeza, semillaEstacion, techos)
    // Series keeps the circuit the coach wrote; a timed format sizes it to fill the six minutes.
    const cupo = formato ? CIRCUITO[formato].ejercicios : plantillas.length

    // One candidate per slot. When the format asks for more exercises than the coach wrote, the
    // extra slots reuse the template's movements in order — the fourth exercise of a Tabata
    // rotates the first one's pattern again, into a different movement.
    const candidatos = []
    for (let i = 0; i < cupo; i++) {
      const te = plantillas[i % plantillas.length]
      const pedir = async (excluir) => {
        const { data } = await supabase.rpc('sustitutos_para_ejercicio', {
          p_exercise_id: te.exercise_id,
          // El box, no la posición: la posición 3 existe en cada línea de cada sede, y preguntar
          // por número devolvía lo que tenían en común todas ellas.
          p_box_id: te.box_id,
          p_user_id: clientId,
          p_excluir: [...new Set(excluir)],
          p_limite: 12,
        })
        return data || []
      }

      // Las concesiones tienen orden, y el orden es por lo que le cuesta al socio.
      //
      //   1. Contraindicaciones — no se ceden nunca; filtran del lado de la base.
      //   2. No repetir dentro del circuito de hoy — lo peor de ver en el piso.
      //   3. El techo del arquetipo — al que arranca no se le ofrece lo más técnico, aunque el
      //      patrón coincida. Cede antes que 2 y después que 4.
      //   4. No repetir el movimiento de ayer — molesto, pero es lo más barato de resolver.
      //
      // La versión anterior cedía el techo primero, y al que arranca le aparecían sentadillas
      // sobre bosu con sandbag porque el pool de esa estación no tenía nada más simple sin
      // repetir. Repetir una sentadilla sin carga es mejor que eso.
      const bajoTecho = (lista) => lista.filter((o) => dentroDelTecho(perfiles?.get(o.id), techos))

      // Un id distinto no es un movimiento distinto. El catálogo lo dice con family_code:
      // sentadilla con sandbag y sentadilla con kettlebell son una sentadilla agarrando otra cosa.
      const otraFamilia = (lista) => {
        const fuera = lista.filter((o) => {
          const fam = perfiles?.get(o.id)?.family_code
          return !fam || !familiasAyer.has(fam)
        })
        return fuera.length ? fuera : lista
      }

      const conAyerFuera = await pedir([...usados, ...evitar, ...candidatos])
      let opciones = bajoTecho(otraFamilia(conAyerFuera))

      if (!opciones.length) {
        // Se afloja lo de ayer, manteniendo el techo.
        const conAyerAdentro = await pedir([...usados, ...candidatos])
        opciones = bajoTecho(conAyerAdentro)
        // Y recién si tampoco hay nada bajo techo, se cede el techo.
        if (!opciones.length) opciones = conAyerAdentro
      }

      // Only movements that tolerate the station's format get into the station's circuit.
      const admiten = opciones.filter(
        (o) => !formato || formatosPosibles(perfiles?.get(o.id)).includes(formato)
      )
      const elegibles = admiten.length ? admiten : opciones

      if (elegibles.length) {
        // The engine's own order is the same every time for a given member and station, so the
        // session number is what makes session 7 differ from session 12. seededIndex keeps it
        // reproducible: same routine, same month, every time.
        const semilla = `${semillaEstacion}-s${i}`
        candidatos.push(elegibles[seededIndex(semilla, elegibles.length)].id)
      } else if (i < plantillas.length && !candidatos.includes(te.exercise_id)) {
        // No substitute available: the coach's own choice is better than a hole in the circuit.
        candidatos.push(te.exercise_id)
      }
    }
    if (!candidatos.length) continue

    // A format nobody in the circuit tolerates would be a station the member cannot do. EMOM is
    // the one everything tolerates, so it is where an impossible station lands.
    const formatoFinal =
      formato && candidatos.every((id) => formatosPosibles(perfiles?.get(id)).includes(formato))
        ? formato
        : formato && 'EMOM'
    // Falling back re-sizes the circuit too: four exercises at a minute each is eight minutes, not
    // six, and the station has to give the line back its slot on time.
    const delBloque = formatoFinal
      ? candidatos.slice(0, CIRCUITO[formatoFinal].ejercicios)
      : candidatos
    // Rounds come from how many exercises actually made it in, so the block still closes at 6:00.
    const trabajo = formatoFinal ? trabajoDelBloque(formatoFinal, delBloque.length) : null

    for (const [i, exerciseId] of delBloque.entries()) {
      orden += 1
      usados.push(exerciseId)
      const te = plantillas[i % plantillas.length]
      const fuente = exerciseId === te.exercise_id ? 'template' : 'similar'
      await insertarEjercicio(
        session.id, te, exerciseId, orden, fuente,
        trabajo ?? {
          formato: 'Series',
          rondas: null,
          trabajo_seg: null,
          descanso_seg: null,
          sets_reps: te.sets_reps,
        },
        await getProposedWeight(clientId, exerciseId)
      )
    }
  }

  return usados
}

/** Una fila de session_exercises. La forma sale de la plantilla; el trabajo, del bloque. */
async function insertarEjercicio(sessionId, te, exerciseId, orden, fuente, trabajo, peso) {
  await supabase.from('session_exercises').insert([{
      session_id: sessionId,
      exercise_id: exerciseId,
      box_id: te.box_id,
      box_number: te.box_number,
      exercise_order: orden,
      sets_reps: trabajo.sets_reps,
      rest_time: te.rest_time,
      repetition_time: te.repetition_time,
      micro_pause: te.micro_pause,
      weight_kg: peso ?? te.weight_kg,
      // Same minutes at the station, a different way of spending them.
      formato: trabajo.formato,
      rondas: trabajo.rondas,
      trabajo_seg: trabajo.trabajo_seg,
      descanso_seg: trabajo.descanso_seg,
      is_auto_generated: true,
      is_cooldown: te.is_cooldown || false,
      generation_source: fuente,
  }])
}

// =====================================================
// GENERATION LOG
// =====================================================

export const getGenerationLog = async (routineId) => {
  const { data, error } = await supabase
    .from('routine_generation_log')
    .select(`
      *,
      routine_sessions (id, title, session_number),
      original:exercises!routine_generation_log_original_exercise_id_fkey (id, name),
      new:exercises!routine_generation_log_new_exercise_id_fkey (id, name),
      sellers!routine_generation_log_performed_by_fkey (id, first_name, last_name)
    `)
    .eq('routine_id', routineId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

// =====================================================
// ROUTINE GENERATION SUMMARY
// =====================================================

export const getRoutineGenerationSummary = async (routineId = null) => {
  let query = supabase
    .from('training_routines')
    .select(`
      id,
      title,
      generation_status,
      total_sessions,
      template_sessions,
      users (id, first_name, last_name),
      routine_sessions (
        id,
        session_exercises (
          id,
          is_auto_generated,
          is_coach_override,
          is_locked,
          generation_source
        )
      )
    `)
  
  if (routineId) {
    query = query.eq('id', routineId)
  }
  
  const { data, error } = await query
  if (error) throw error
  
  // Calculate summary stats
  return data.map(routine => {
    let totalExercises = 0
    let autoGenerated = 0
    let coachOverrides = 0
    let locked = 0
    
    routine.routine_sessions?.forEach(session => {
      session.session_exercises?.forEach(se => {
        totalExercises++
        if (se.is_auto_generated) autoGenerated++
        if (se.is_coach_override) coachOverrides++
        if (se.is_locked) locked++
      })
    })
    
    return {
      id: routine.id,
      title: routine.title,
      generationStatus: routine.generation_status,
      clientName: routine.users ? `${routine.users.first_name} ${routine.users.last_name}` : 'N/A',
      totalSessions: routine.routine_sessions?.length || 0,
      totalExercises,
      autoGenerated,
      coachOverrides,
      locked
    }
  })
}

export default {
  // Exercise Groups
  getExerciseGroups,
  createExerciseGroup,
  updateExerciseGroup,
  
  // Production Lines
  getProductionLines,
  createProductionLine,
  updateProductionLine,
  
  // Line Box Status
  getLineBoxStatus,
  updateLineBoxStatus,
  
  // Similar Exercises
  getSimilarExercises,
  
  // Coach Overrides
  overrideExercise,
  revertExerciseOverride,
  toggleExerciseLock,
  
  // Session Exercises with Overrides
  getSessionExercisesWithOverrides,
  
  // Routine Generation
  getExercisesForBox,
  generateRoutineSessions,
  
  // Generation Log
  getGenerationLog,
  getRoutineGenerationSummary
}
