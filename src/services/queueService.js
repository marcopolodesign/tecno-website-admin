import { supabase } from '../lib/supabase'
import { EXERCISE_MEDIA_FIELDS } from '../lib/exerciseMedia'

// Líneas + boxes config (production_lines/boxes, reused from the Fitness module's
// schema — see tecnofit-supabase/supabase/migrations/20260714120000_create_queue_engine.sql)
// and live monitor reads (line_box_status/queue_entries) for the new lista de
// espera admin section.

// Línea-relative box label ("B1" = box 1 of línea 2) instead of the global
// box_number — global numbering is an internal FK detail, not what staff/
// members should see on screen.
export function boxLabel(lineNumber, linePosition) {
  const letter = String.fromCharCode(64 + (lineNumber || 1)) // 1->A, 2->B, ...
  return `${letter}${linePosition ?? '?'}`
}

export const queueService = {
  // ── Líneas (production_lines) ─────────────────────────────────────────────
  async getLines(locationId = null) {
    try {
      let query = supabase
        .from('production_lines')
        .select('*, locations (id, name)')
        .order('line_number', { ascending: true })

      if (locationId) query = query.eq('location_id', locationId)

      const { data, error } = await query
      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching production lines:', error)
      throw error
    }
  },

  async createLine(lineData) {
    try {
      const { data, error } = await supabase
        .from('production_lines')
        .insert([lineData])
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error creating production line:', error)
      throw error
    }
  },

  async updateLine(id, lineData) {
    try {
      const { data, error } = await supabase
        .from('production_lines')
        .update(lineData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error updating production line:', error)
      throw error
    }
  },

  async deleteLine(id) {
    try {
      const { error } = await supabase.from('production_lines').delete().eq('id', id)
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting production line:', error)
      throw error
    }
  },

  // ── Boxes ───────────────────────────────────────────────────────────────
  async getBoxesForLine(productionLineId) {
    try {
      const { data, error } = await supabase
        .from('boxes')
        .select('*')
        .eq('production_line_id', productionLineId)
        .order('line_position', { ascending: true })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching boxes for line:', error)
      throw error
    }
  },

  async createBox(boxData) {
    try {
      const { data, error } = await supabase.from('boxes').insert([boxData]).select().single()
      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error creating box:', error)
      throw error
    }
  },

  async updateBox(id, boxData) {
    try {
      const { data, error } = await supabase
        .from('boxes')
        .update(boxData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error updating box:', error)
      throw error
    }
  },

  async deleteBox(id) {
    try {
      const { error } = await supabase.from('boxes').delete().eq('id', id)
      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting box:', error)
      throw error
    }
  },

  // ── Live monitor ────────────────────────────────────────────────────────
  async getLineBoxStatus(productionLineId) {
    try {
      const { data, error } = await supabase
        .from('line_box_status')
        .select('*, boxes (id, name, box_number, line_position), users (id, first_name, last_name)')
        .eq('production_line_id', productionLineId)
        .order('boxes(line_position)', { ascending: true })

      if (error) throw error
      // Sort client-side too — embedded-column order isn't reliable across pg versions
      const sorted = [...(data || [])].sort(
        (a, b) => (a.boxes?.line_position ?? 0) - (b.boxes?.line_position ?? 0)
      )
      return { data: sorted }
    } catch (error) {
      console.error('Error fetching line box status:', error)
      throw error
    }
  },

  async getQueueForLine(productionLineId) {
    try {
      const { data, error } = await supabase
        .from('queue_entries')
        .select('*, users (id, first_name, last_name)')
        .eq('production_line_id', productionLineId)
        .in('status', ['waiting', 'confirming'])
        .order('posicion', { ascending: true })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching queue for line:', error)
      throw error
    }
  },

  async skipQueueEntry(id) {
    try {
      const { data, error } = await supabase
        .from('queue_entries')
        .update({ status: 'skipped' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error skipping queue entry:', error)
      throw error
    }
  },

  async freeBox(lineBoxStatusId) {
    try {
      const { data, error } = await supabase
        .from('line_box_status')
        .update({ status: 'free', current_user_id: null, entered_at: null, advances_at: null })
        .eq('id', lineBoxStatusId)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error freeing box:', error)
      throw error
    }
  },

  // ── Per-box routine display (TV) ────────────────────────────────────────
  // session_exercises.box_number is "station 1-5 within the circuit" (CHECK
  // 1..5 in the original fitness schema) — it means the SAME thing on both
  // líneas (línea A's box 3 and línea B's box 3 are the same station in the
  // circuit), so this must join against boxes.line_position, NOT the queue
  // pipeline's global box_number (which runs 1-10 across two líneas).
  async getCurrentExerciseForUser(userId, linePosition) {
    if (!userId) return { data: null }
    try {
      const { data, error } = await supabase
        .from('training_routines')
        .select(
          `id, routine_sessions (
            id, session_number, status,
            session_exercises (
              id, exercise_id, box_number, is_cooldown, sets_reps, rest_time,
              repetition_time, weight_kg, exercise_order,
              exercises!session_exercises_exercise_id_fkey (${EXERCISE_MEDIA_FIELDS})
            )
          )`
        )
        .eq('client_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error
      const routine = data?.[0]
      const sessions = routine?.routine_sessions || []
      const sorted = [...sessions].sort((a, b) => a.session_number - b.session_number)
      const session =
        sorted.find((s) => s.status === 'available' || s.status === 'in_progress') ??
        sorted.find((s) => s.status !== 'completed') ??
        sorted[0] ??
        null
      if (!session) return { data: null }

      const exerciseAtBox = (session.session_exercises || [])
        .filter((se) => se.box_number === linePosition && !se.is_cooldown)
        .sort((a, b) => a.exercise_order - b.exercise_order)[0]

      return { data: exerciseAtBox || null }
    } catch (error) {
      console.error('Error fetching current exercise for user:', error)
      return { data: null }
    }
  },

  // ── Realtime subscriptions ─────────────────────────────────────────────
  // La lista de espera de la sede: una sola, sin línea (la línea se estampa recién al
  // promover). Ver migración 20260910180000.
  async getWaitingForLocation(locationId) {
    try {
      let query = supabase
        .from('queue_entries')
        .select('*, users (id, first_name, last_name)')
        .eq('status', 'waiting')
        .order('posicion', { ascending: true })
        .order('created_at', { ascending: true })
      if (locationId) query = query.eq('location_id', locationId)

      const { data, error } = await query
      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching waiting list for location:', error)
      throw error
    }
  },

  // Realtime de la cola de la sede. NO se puede reusar subscribeToLine: ése filtra por
  // `production_line_id`, y una fila en espera lo tiene en NULL — no llegaría nunca. Sin
  // esto recepción tendría que apretar Actualizar para ver quién entró, que es justo lo
  // que no queremos.
  subscribeToLocationQueue(locationId, onChange) {
    const channel = supabase
      .channel(`queue-location-${locationId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          ...(locationId ? { filter: `location_id=eq.${locationId}` } : {}),
        },
        onChange
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },

  subscribeToLine(productionLineId, onChange) {
    const channel = supabase
      .channel(`queue-line-${productionLineId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'line_box_status', filter: `production_line_id=eq.${productionLineId}` },
        onChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_entries', filter: `production_line_id=eq.${productionLineId}` },
        onChange
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },
}

export default queueService
