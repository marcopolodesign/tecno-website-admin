import { supabase, toCamelCase, toSnakeCase, getCurrentUser } from '../lib/supabase'

export const workoutsService = {
  // ==================== WORKOUT SESSIONS ====================
  async getWorkoutSessions(clientId = null, status = null) {
    try {
      let query = supabase
        .from('workout_sessions')
        .select(`
          *,
          users (
            id,
            first_name,
            last_name,
            email
          ),
          routine_sessions (
            id,
            session_number,
            title,
            training_routines (
              id,
              title
            )
          )
        `)
        .order('started_at', { ascending: false })

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching workout sessions:', error)
      throw error
    }
  },

  async getWorkoutSession(id) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          users (
            id,
            first_name,
            last_name,
            email
          ),
          routine_sessions (
            id,
            session_number,
            title,
            training_routines (
              id,
              title
            )
          ),
          exercise_logs (
            id,
            set_number,
            target_reps,
            actual_reps,
            weight_used_kg,
            difficulty_rating,
            notes,
            completed_at,
            session_exercises (
              id,
              sets_reps,
              exercises (
                id,
                name
              )
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching workout session:', error)
      throw error
    }
  },

  async startWorkout(clientId, routineSessionId) {
    try {
      const user = await getCurrentUser()
      
      const insertData = {
        client_id: clientId,
        routine_session_id: routineSessionId,
        started_at: new Date().toISOString(),
        status: 'in_progress',
        supervised_by: user?.id
      }

      const { data, error } = await supabase
        .from('workout_sessions')
        .insert([insertData])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error starting workout:', error)
      throw error
    }
  },

  async completeWorkout(id, notes = null) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: notes
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error completing workout:', error)
      throw error
    }
  },

  async cancelWorkout(id, reason = null) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .update({
          status: 'cancelled',
          notes: reason
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error cancelling workout:', error)
      throw error
    }
  },

  // ==================== EXERCISE LOGS ====================
  async logExercise(logData) {
    try {
      const insertData = {
        workout_session_id: logData.workoutSessionId,
        session_exercise_id: logData.sessionExerciseId,
        set_number: logData.setNumber,
        target_reps: logData.targetReps || null,
        actual_reps: logData.actualReps,
        weight_used_kg: logData.weightUsedKg || null,
        difficulty_rating: logData.difficultyRating || null,
        notes: logData.notes || null,
        completed_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('exercise_logs')
        .insert([insertData])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error logging exercise:', error)
      throw error
    }
  },

  async updateExerciseLog(id, logData) {
    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .update(toSnakeCase(logData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating exercise log:', error)
      throw error
    }
  },

  async getExerciseLogs(workoutSessionId) {
    try {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select(`
          *,
          session_exercises (
            id,
            sets_reps,
            exercises (
              id,
              name
            )
          )
        `)
        .eq('workout_session_id', workoutSessionId)
        .order('completed_at', { ascending: true })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching exercise logs:', error)
      throw error
    }
  },

  // ==================== LOGGING DE RESULTADOS (coach carga lo real) ====================

  /**
   * La fila de workout_sessions para "el coach está cargando los resultados reales de esta
   * sesión". No es un tracker en vivo por serie — nada en el admin arranca un cronómetro por
   * set — así que se crea directamente en 'completed': el evento que representa es "esto ya
   * pasó y alguien lo está registrando", no "está pasando ahora mismo". Eso también evita la
   * constraint one_active_session_per_client (sólo excluye status='in_progress'): si esta fila
   * naciera 'in_progress', abrir la pantalla de resultados para dos sesiones del mismo socio
   * sin haber cerrado la primera tiraría un error de exclusión que no tiene nada que ver con lo
   * que el coach está haciendo.
   *
   * Reutiliza la fila si ya existe una para esta routine_session_id — volver a abrir la
   * pantalla para seguir cargando no crea una segunda.
   */
  async ensureLoggingSession(clientId, routineSessionId) {
    try {
      const { data: existentes, error: errBusqueda } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('routine_session_id', routineSessionId)
        .neq('status', 'cancelled')
        .order('started_at', { ascending: false })
        .limit(1)

      if (errBusqueda) throw errBusqueda
      if (existentes && existentes[0]) return { data: toCamelCase(existentes[0]) }

      const user = await getCurrentUser()
      const ahora = new Date().toISOString()
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert([{
          client_id: clientId,
          routine_session_id: routineSessionId,
          started_at: ahora,
          completed_at: ahora,
          status: 'completed',
          supervised_by: user?.id,
        }])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error ensuring logging session:', error)
      throw error
    }
  },

  /**
   * Carga o edita el resultado real de un ejercicio de la sesión. set_number fijo en 1: acá se
   * registra "lo que pasó en esa estación" al mismo grano que session_exercises.weight_kg (un
   * peso por ejercicio prescripto), no una fila por serie — no hay en esta pantalla de dónde
   * sacar series individuales.
   */
  async upsertExerciseLog(workoutSessionId, sessionExerciseId, logData = {}) {
    try {
      const { data: existente, error: errBusqueda } = await supabase
        .from('exercise_logs')
        .select('id')
        .eq('workout_session_id', workoutSessionId)
        .eq('session_exercise_id', sessionExerciseId)
        .eq('set_number', 1)
        .maybeSingle()

      if (errBusqueda) throw errBusqueda

      if (existente) {
        return await workoutsService.updateExerciseLog(existente.id, {
          ...logData,
          completedAt: new Date().toISOString(),
        })
      }

      return await workoutsService.logExercise({
        workoutSessionId,
        sessionExerciseId,
        setNumber: 1,
        ...logData,
      })
    } catch (error) {
      console.error('Error upserting exercise log:', error)
      throw error
    }
  },

  // ==================== STATISTICS & ANALYTICS ====================
  async getClientWorkoutStats(clientId) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, status, started_at, completed_at')
        .eq('client_id', clientId)

      if (error) throw error

      const stats = {
        totalWorkouts: data.length,
        completedWorkouts: data.filter(w => w.status === 'completed').length,
        inProgressWorkouts: data.filter(w => w.status === 'in_progress').length,
        cancelledWorkouts: data.filter(w => w.status === 'cancelled').length,
        completionRate: 0
      }

      if (stats.totalWorkouts > 0) {
        stats.completionRate = Math.round((stats.completedWorkouts / stats.totalWorkouts) * 100)
      }

      return { data: stats }
    } catch (error) {
      console.error('Error fetching workout stats:', error)
      throw error
    }
  },

  async getRecentWorkouts(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          users (
            id,
            first_name,
            last_name
          ),
          routine_sessions (
            title,
            training_routines (
              title
            )
          )
        `)
        .order('started_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching recent workouts:', error)
      throw error
    }
  },

  async getActiveWorkouts() {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          users (
            id,
            first_name,
            last_name
          ),
          routine_sessions (
            title,
            training_routines (
              title
            )
          )
        `)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching active workouts:', error)
      throw error
    }
  }
}

export default workoutsService

