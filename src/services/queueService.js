import { supabase } from '../lib/supabase'

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

  // ── Realtime subscriptions ─────────────────────────────────────────────
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
