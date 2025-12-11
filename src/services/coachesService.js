import { supabase } from '../lib/supabase'

export const coachesService = {
  async getCoaches() {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching coaches:', error)
      throw error
    }
  },

  async getCoach(id) {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching coach:', error)
      throw error
    }
  },

  async createCoach(coachData) {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .insert([coachData])
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error creating coach:', error)
      throw error
    }
  },

  async updateCoach(id, coachData) {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .update(coachData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error updating coach:', error)
      throw error
    }
  },

  async deleteCoach(id) {
    try {
      const { error } = await supabase
        .from('coaches')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting coach:', error)
      throw error
    }
  },

  async getCoachClients(coachId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching coach clients:', error)
      throw error
    }
  },

  async assignCoachToUser(userId, coachId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ coach_id: coachId })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error assigning coach to user:', error)
      throw error
    }
  }
}

