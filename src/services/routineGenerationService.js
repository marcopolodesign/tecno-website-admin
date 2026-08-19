import { supabase } from '../lib/supabase'

/**
 * Service for routine auto-generation and coach overrides
 */

// =====================================================
// EXERCISE GROUPS
// =====================================================

// Cuántas sesiones escribe el coach a mano antes de que el motor siga solo.
const SESIONES_A_MANO = 5

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
async function perfilesDeEsfuerzo() {
  // The whole catalog in one query rather than a lookup per generated station: a month of five
  // stations is 125 of them, and this is 310 rows of two smallint columns.
  const { data } = await supabase
    .from('exercises')
    .select('id, complejidad_tecnica, intensidad_relativa')
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

/**
 * Turn a station's timed work into a different format of the same length.
 *
 * The station keeps its slot in the line — a member spends the same minutes at box 3 whether it
 * is an EMOM, an AMRAP or a Tabata — so the queue and the rest of the line are untouched. What
 * changes is how those minutes are spent, which is the whole point: without this, box 3 is EMOM
 * for the entire month because that is what the coach happened to write in session 1.
 *
 * Rounds are derived from the template's total so the time budget survives the swap, and the
 * pick is seeded, so regenerating lands on the same month.
 */
function variarFormato(plantilla, ejercicio, semilla) {
  // Series is a prescription of load and reps — the coach decided this station is strength work.
  // Rotating it into a Tabata would change what the station is for, not just how it is measured.
  if (!plantilla.formato || plantilla.formato === 'Series') return null

  const total =
    (plantilla.rondas ?? 0) * ((plantilla.trabajo_seg ?? 0) + (plantilla.descanso_seg ?? 0))
  if (total <= 0) return null

  const posibles = formatosPosibles(ejercicio)
  const formato = posibles[seededIndex(semilla, posibles.length)]

  const acotar = (v, min, max) => Math.max(min, Math.min(max, v))
  switch (formato) {
    case 'Tabata': {
      // 30s cycles. Eight of them is the classic four minutes; longer stations get more rounds.
      const rondas = acotar(Math.round(total / 30), 4, 16)
      return { formato, rondas, trabajo_seg: 20, descanso_seg: 10, sets_reps: 'máx por ronda' }
    }
    case 'AMRAP': {
      // One round against the clock. The cap is the station's whole turn.
      const cap = acotar(total, 180, 1200)
      return {
        formato, rondas: 1, trabajo_seg: cap, descanso_seg: 0,
        sets_reps: `máx en ${Math.round(cap / 60)} min`,
      }
    }
    default: {
      const rondas = acotar(Math.round(total / 60), 4, 20)
      return {
        formato: 'EMOM', rondas, trabajo_seg: 60, descanso_seg: 0,
        sets_reps: `${rondas}x${repsPorRonda(plantilla)}`,
      }
    }
  }
}

/**
 * How many reps go in each round of an EMOM.
 *
 * Taken from the template when it was already an EMOM — that number is the coach's dose for this
 * station and should survive. When the template was a Tabata or an AMRAP there is no rep count to
 * inherit ("máx por ronda" is not a number), so it falls back to ten.
 */
function repsPorRonda(plantilla) {
  const m = plantilla.formato === 'EMOM' && /(\d+)\s*x\s*(\d+)/i.exec(plantilla.sets_reps || '')
  return m ? m[2] : 10
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
  // The hand-made ones. Five is what the gym writes; a routine can say otherwise.
  const aMano = routine.template_sessions || SESIONES_A_MANO

  const { data: plantillas, error: pError } = await supabase
    .from('routine_sessions')
    .select('id, session_number, session_exercises (*)')
    .eq('routine_id', routineId)
    .lte('session_number', aMano)
    .order('session_number')
  if (pError) throw pError

  const conEjercicios = (plantillas || []).filter((s) => (s.session_exercises || []).length > 0)
  if (conEjercicios.length === 0) {
    throw new Error(
      `No hay ninguna sesión cargada a mano para usar de base. Armá al menos la Sesión 1 antes de generar.`
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

    // What the last hand-written session used. Without this the first generated session is the
    // only one in the month that does not know what came the day before, and it can repeat it —
    // which is exactly what it did: session 5 finished with squats and session 6 opened with them.
    const ultima = conEjercicios[conEjercicios.length - 1]
    let anterior = (ultima.session_exercises || []).map((se) => se.exercise_id)
    for (let n = aMano + 1; n <= totalSessions; n++) {
      // Rotate through the hand-made sessions so the month keeps their variety instead of
      // orbiting one of them.
      const base = conEjercicios[(n - aMano - 1) % conEjercicios.length]
      anterior = await generarSesion(routineId, routine.client_id, base, n, anterior, perfiles)
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
async function generarSesion(routineId, clientId, base, sessionNumber, evitar, perfiles) {
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

  const ejercicios = [...(base.session_exercises || [])].sort(
    (a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0)
  )

  for (const te of ejercicios) {
    orden += 1
    let exerciseId = te.exercise_id
    let fuente = 'template'

    // A cooldown has no station, so there is nothing to rotate it against — it carries over.
    if (!te.is_cooldown && te.box_number) {
      const { data: candidatos } = await supabase.rpc('sustitutos_para_ejercicio', {
        p_exercise_id: te.exercise_id,
        p_line_position: te.box_number,
        p_user_id: clientId,
        // Never twice in the same session, and not what yesterday already had.
        p_excluir: [...new Set([...usados, ...evitar])],
        p_limite: 8,
      })

      if (candidatos?.length) {
        // The engine's own order is the same every time for a given member and station, so the
        // session number is what makes session 7 differ from session 12. seededIndex keeps it
        // reproducible: same routine, same month, every time.
        const semilla = `${routineId}-${sessionNumber}-b${te.box_number}-o${te.exercise_order}`
        exerciseId = candidatos[seededIndex(semilla, candidatos.length)].id
        fuente = 'similar'
      }
    }

    usados.push(exerciseId)

    const peso = await getProposedWeight(clientId, exerciseId)

    // The station's format rotates too. Without this, whatever the coach wrote in the first
    // session is what box 3 does for the whole month.
    const trabajo =
      variarFormato(te, perfiles?.get(exerciseId), `${routineId}-${sessionNumber}-f${te.box_number}`) ?? {
        formato: te.formato || 'Series',
        rondas: te.rondas,
        trabajo_seg: te.trabajo_seg,
        descanso_seg: te.descanso_seg,
        sets_reps: te.sets_reps,
      }

    await supabase.from('session_exercises').insert([{
      session_id: session.id,
      exercise_id: exerciseId,
      box_id: te.box_id,
      box_number: te.box_number,
      exercise_order: orden,
      // The rep prescription belongs to the format: carrying "8x10" into an AMRAP reads as a
      // contradiction on the box screen.
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

  return usados
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
