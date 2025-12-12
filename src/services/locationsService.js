import { supabase } from '../lib/supabase'

export const locationsService = {
  async getLocations() {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching locations:', error)
      throw error
    }
  },

  async getLocation(id) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching location:', error)
      throw error
    }
  },

  async createLocation(locationData) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .insert([locationData])
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error creating location:', error)
      throw error
    }
  },

  async updateLocation(id, locationData) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .update(locationData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error updating location:', error)
      throw error
    }
  },

  async deleteLocation(id) {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting location:', error)
      throw error
    }
  }
}
