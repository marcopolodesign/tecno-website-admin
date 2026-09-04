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
  },

  // Copia única (al crear la sede) y sync manual ("Sincronizar ahora") son la misma llamada —
  // ver el comentario de la función en la migración: sincronizar es correr la copia de nuevo.
  async copiarEquipamiento(sedeOrigenId, sedeDestinoId) {
    try {
      const { data, error } = await supabase.rpc('copiar_equipamiento_de_sede', {
        p_sede_origen_id: sedeOrigenId,
        p_sede_destino_id: sedeDestinoId
      })
      if (error) throw error
      return { data: data?.[0] || null }
    } catch (error) {
      console.error('Error copying equipamiento:', error)
      throw error
    }
  }
}






