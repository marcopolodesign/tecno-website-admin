import { supabase, toCamelCase, toSnakeCase, getCurrentUser } from '../lib/supabase'

export const routinesService = {
  // ==================== TRAINING ROUTINES ====================
  async getRoutines(clientId = null, status = null) {
    try {
      let query = supabase
        .from('training_routines')
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
            status,
            completed_at
          )
        `)
        .order('created_at', { ascending: false })

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
      console.error('Error fetching routines:', error)
      throw error
    }
  },

  async getRoutine(id) {
    try {
      const { data, error } = await supabase
        .from('training_routines')
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
            description,
            status,
            completed_at,
            session_exercises (
              id,
              exercise_order,
              sets_reps,
              rest_time,
              weight_kg,
              notes,
              exercises (
                id,
                name,
                description,
                instructions,
                difficulty_level,
                exercise_categories (
                  id,
                  name,
                  body_zones (
                    id,
                    name
                  )
                )
              )
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching routine:', error)
      throw error
    }
  },

  async createRoutine(routineData) {
    try {
      const user = await getCurrentUser()
      
      // Calculate default end date (30 days from start)
      const startDate = routineData.validFrom || new Date().toISOString().split('T')[0]
      const defaultEndDate = new Date(startDate)
      defaultEndDate.setDate(defaultEndDate.getDate() + 30)
      
      const insertData = {
        client_id: routineData.clientId,
        title: routineData.title,
        description: routineData.description || null,
        valid_from: startDate,
        valid_until: routineData.validUntil || defaultEndDate.toISOString().split('T')[0],
        goals: routineData.goal ? [routineData.goal] : null,
        status: 'active',
        created_by: user?.id,
        assigned_trainer_id: routineData.assignedTrainerId || user?.id
      }

      const { data, error } = await supabase
        .from('training_routines')
        .insert([insertData])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating routine:', error)
      throw error
    }
  },

  async updateRoutine(id, routineData) {
    try {
      const { data, error } = await supabase
        .from('training_routines')
        .update(toSnakeCase(routineData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating routine:', error)
      throw error
    }
  },

  async deleteRoutine(id) {
    try {
      const { error } = await supabase
        .from('training_routines')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting routine:', error)
      throw error
    }
  },

  // ==================== ROUTINE SESSIONS ====================
  async getSessions(routineId) {
    try {
      const { data, error } = await supabase
        .from('routine_sessions')
        .select(`
          *,
          session_exercises (
            id,
            exercise_order,
            sets_reps,
            rest_time,
            weight_kg,
            notes,
            exercises (
              id,
              name,
              description,
              difficulty_level
            )
          )
        `)
        .eq('routine_id', routineId)
        .order('session_number', { ascending: true })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching sessions:', error)
      throw error
    }
  },

  async createSession(sessionData) {
    try {
      const insertData = {
        routine_id: sessionData.routineId,
        session_number: sessionData.sessionNumber,
        title: sessionData.title || `Sesión ${sessionData.sessionNumber}`,
        description: sessionData.description || null,
        status: sessionData.sessionNumber === 1 ? 'available' : 'locked'
      }

      const { data, error } = await supabase
        .from('routine_sessions')
        .insert([insertData])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating session:', error)
      throw error
    }
  },

  async updateSession(id, sessionData) {
    try {
      const { data, error } = await supabase
        .from('routine_sessions')
        .update(toSnakeCase(sessionData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating session:', error)
      throw error
    }
  },

  async deleteSession(id) {
    try {
      const { error } = await supabase
        .from('routine_sessions')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting session:', error)
      throw error
    }
  },

  // ==================== SESSION EXERCISES ====================
  async addExerciseToSession(sessionExerciseData) {
    try {
      const insertData = {
        session_id: sessionExerciseData.sessionId,
        exercise_id: sessionExerciseData.exerciseId,
        exercise_order: sessionExerciseData.exerciseOrder,
        sets_reps: sessionExerciseData.setsReps,
        rest_time: sessionExerciseData.restTime || '60s',
        weight_kg: sessionExerciseData.weightKg || null,
        notes: sessionExerciseData.notes || null
      }

      const { data, error } = await supabase
        .from('session_exercises')
        .insert([insertData])
        .select(`
          *,
          exercises (
            id,
            name,
            description,
            difficulty_level
          )
        `)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error adding exercise to session:', error)
      throw error
    }
  },

  async updateSessionExercise(id, exerciseData) {
    try {
      const { data, error } = await supabase
        .from('session_exercises')
        .update(toSnakeCase(exerciseData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating session exercise:', error)
      throw error
    }
  },

  async removeExerciseFromSession(id) {
    try {
      const { error } = await supabase
        .from('session_exercises')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error removing exercise from session:', error)
      throw error
    }
  },

  async reorderSessionExercises(sessionId, exerciseOrders) {
    try {
      // Update each exercise's order
      for (const item of exerciseOrders) {
        await supabase
          .from('session_exercises')
          .update({ exercise_order: item.order })
          .eq('id', item.id)
      }
      return { success: true }
    } catch (error) {
      console.error('Error reordering exercises:', error)
      throw error
    }
  },

  // ==================== UTILITY METHODS ====================
  async getClientRoutines(clientId) {
    return this.getRoutines(clientId)
  },

  async getActiveRoutines() {
    return this.getRoutines(null, 'active')
  },

  async duplicateRoutine(routineId, newClientId) {
    try {
      // Get the original routine with all its data
      const { data: original } = await this.getRoutine(routineId)
      if (!original) throw new Error('Routine not found')

      // Create new routine
      const { data: newRoutine } = await this.createRoutine({
        clientId: newClientId,
        title: `${original.title} (Copia)`,
        description: original.description,
        goal: original.goals?.[0] || null
      })

      // Duplicate sessions and exercises
      for (const session of original.routineSessions || []) {
        const { data: newSession } = await this.createSession({
          routineId: newRoutine.id,
          sessionNumber: session.sessionNumber,
          title: session.title,
          description: session.description
        })

        // Duplicate exercises in the session
        for (const exercise of session.sessionExercises || []) {
          await this.addExerciseToSession({
            sessionId: newSession.id,
            exerciseId: exercise.exercises.id,
            exerciseOrder: exercise.exerciseOrder,
            setsReps: exercise.setsReps,
            restTime: exercise.restTime,
            weightKg: exercise.weightKg,
            notes: exercise.notes
          })
        }
      }

      return { data: newRoutine }
    } catch (error) {
      console.error('Error duplicating routine:', error)
      throw error
    }
  }
}

export default routinesService

