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

/**
 * Generate remaining sessions based on template (Class 1)
 * This is a simplified version - the full logic would be in a backend function
 */
export const generateRoutineSessions = async (routineId, templateSessionId) => {
  // Get the template session exercises
  const { data: templateExercises, error: teError } = await supabase
    .from('session_exercises')
    .select('*')
    .eq('session_id', templateSessionId)
    .order('box_number')
    .order('exercise_order')
  
  if (teError) throw teError
  
  // Get routine info
  const { data: routine, error: rError } = await supabase
    .from('training_routines')
    .select('*, users (id, fitness_capacity, fitness_intensity, age_category_id)')
    .eq('id', routineId)
    .single()
  
  if (rError) throw rError
  
  // Mark routine as generating
  await supabase
    .from('training_routines')
    .update({ generation_status: 'generating' })
    .eq('id', routineId)
  
  try {
    const totalSessions = routine.total_sessions || 30
    const templateSessions = routine.template_sessions || 6
    
    // Generate sessions 2 through templateSessions (similar exercises)
    for (let sessionNum = 2; sessionNum <= templateSessions; sessionNum++) {
      await generateSimilarSession(routineId, templateExercises, sessionNum, routine.client_id)
    }
    
    // Generate sessions templateSessions+1 through totalSessions (random from first 6)
    for (let sessionNum = templateSessions + 1; sessionNum <= totalSessions; sessionNum++) {
      await generateRandomSession(routineId, sessionNum, routine.client_id)
    }
    
    // Mark as completed
    await supabase
      .from('training_routines')
      .update({ generation_status: 'completed' })
      .eq('id', routineId)
    
    return true
  } catch (error) {
    // Mark as failed
    await supabase
      .from('training_routines')
      .update({ generation_status: 'failed' })
      .eq('id', routineId)
    
    throw error
  }
}

async function generateSimilarSession(routineId, templateExercises, sessionNumber, userId) {
  // Create the session
  const { data: session, error: sError } = await supabase
    .from('routine_sessions')
    .insert([{
      routine_id: routineId,
      title: `Sesión ${sessionNumber}`,
      session_number: sessionNumber,
      status: 'locked'
    }])
    .select()
    .single()
  
  if (sError) throw sError
  
  const usedExerciseIds = []
  
  // For each template exercise, find a similar one
  for (const te of templateExercises) {
    let exerciseId = te.exercise_id
    
    // Try to find a similar exercise
    const { data: similar } = await supabase
      .rpc('get_similar_exercises', {
        p_exercise_id: te.exercise_id,
        p_user_id: userId,
        p_box_id: te.box_id,
        p_exclude_ids: usedExerciseIds
      })
    
    if (similar && similar.length > 0) {
      exerciseId = similar[0].exercise_id
    }
    
    usedExerciseIds.push(exerciseId)
    
    // Create the session exercise
    await supabase
      .from('session_exercises')
      .insert([{
        session_id: session.id,
        exercise_id: exerciseId,
        box_id: te.box_id,
        box_number: te.box_number,
        exercise_order: te.exercise_order,
        sets_reps: te.sets_reps,
        rest_time: te.rest_time,
        repetition_time: te.repetition_time,
        micro_pause: te.micro_pause,
        weight_kg: te.weight_kg,
        is_auto_generated: true,
        generation_source: exerciseId === te.exercise_id ? 'template' : 'similar'
      }])
  }
  
  return session
}

async function generateRandomSession(routineId, sessionNumber, userId) {
  // Get exercises from first 6 sessions to pick randomly
  const { data: existingExercises, error } = await supabase
    .from('session_exercises')
    .select(`
      *,
      routine_sessions!inner (routine_id, session_number)
    `)
    .eq('routine_sessions.routine_id', routineId)
    .lte('routine_sessions.session_number', 6)
  
  if (error) throw error
  
  // Group by box_number and order
  const exercisesByBoxAndOrder = {}
  existingExercises.forEach(ex => {
    const key = `${ex.box_number}-${ex.exercise_order}`
    if (!exercisesByBoxAndOrder[key]) {
      exercisesByBoxAndOrder[key] = []
    }
    exercisesByBoxAndOrder[key].push(ex)
  })
  
  // Create the session
  const { data: session, error: sError } = await supabase
    .from('routine_sessions')
    .insert([{
      routine_id: routineId,
      title: `Sesión ${sessionNumber}`,
      session_number: sessionNumber,
      status: 'locked'
    }])
    .select()
    .single()
  
  if (sError) throw sError
  
  // For each position, pick a random exercise (avoiding previous session)
  const previousSessionNum = sessionNumber - 1
  
  for (const [key, exercises] of Object.entries(exercisesByBoxAndOrder)) {
    // Filter out exercises from previous session
    let candidates = exercises.filter(ex => 
      ex.routine_sessions.session_number !== previousSessionNum
    )
    
    // If no candidates, use all
    if (candidates.length === 0) {
      candidates = exercises
    }
    
    // Pick random
    const selected = candidates[Math.floor(Math.random() * candidates.length)]
    
    // Create the session exercise
    await supabase
      .from('session_exercises')
      .insert([{
        session_id: session.id,
        exercise_id: selected.exercise_id,
        box_id: selected.box_id,
        box_number: selected.box_number,
        exercise_order: selected.exercise_order,
        sets_reps: selected.sets_reps,
        rest_time: selected.rest_time,
        repetition_time: selected.repetition_time,
        micro_pause: selected.micro_pause,
        weight_kg: selected.weight_kg,
        is_auto_generated: true,
        generation_source: 'random'
      }])
  }
  
  return session
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
