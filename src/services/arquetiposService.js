import { supabase } from '../lib/supabase'

export const arquetiposService = {
  async getArquetipos() {
    try {
      const { data, error } = await supabase
        .from('arquetipos')
        .select('*')
        .order('orden', { ascending: true })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching arquetipos:', error)
      throw error
    }
  },

  async createArquetipo(arquetipoData) {
    try {
      const { data, error } = await supabase
        .from('arquetipos')
        .insert([arquetipoData])
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error creating arquetipo:', error)
      throw error
    }
  },

  async updateArquetipo(id, arquetipoData) {
    try {
      const { data, error } = await supabase
        .from('arquetipos')
        .update(arquetipoData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error updating arquetipo:', error)
      throw error
    }
  },

  async deleteArquetipo(id) {
    try {
      const { error } = await supabase
        .from('arquetipos')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting arquetipo:', error)
      throw error
    }
  },

  // La rutina de ejemplo de un arquetipo es una rutina común marcada como plantilla — no hay
  // un modelo aparte. Se arma y edita con el editor de Rutinas de siempre; acá sólo se elige
  // CUÁL rutina cumple ese rol.
  async getPlantilla(arquetipoId) {
    try {
      const { data, error } = await supabase
        .from('training_routines')
        .select('id, title, client_id, users(id, first_name, last_name)')
        .eq('arquetipo_id', arquetipoId)
        .eq('is_template', true)
        .maybeSingle()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching plantilla:', error)
      throw error
    }
  },

  // Buscar rutinas para elegir cuál usar como plantilla — no hace falta que sean del gym real,
  // cualquier rutina sirve de punto de partida.
  async buscarRutinas(q) {
    try {
      let query = supabase
        .from('training_routines')
        .select('id, title, client_id, is_template, arquetipo_id, users(id, first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(20)

      if (q && q.trim()) {
        query = query.ilike('title', `%${q.trim()}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error searching routines:', error)
      throw error
    }
  },

  // Marca una rutina como la plantilla del arquetipo. El índice único de la tabla
  // (un solo is_template por arquetipo) es la garantía real; esto sólo evita el 409 más común
  // desarmando la plantilla vieja antes de armar la nueva.
  async setPlantilla(arquetipoId, routineId) {
    try {
      const { error: errClear } = await supabase
        .from('training_routines')
        .update({ is_template: false, arquetipo_id: null })
        .eq('arquetipo_id', arquetipoId)
        .eq('is_template', true)
      if (errClear) throw errClear

      const { data, error } = await supabase
        .from('training_routines')
        .update({ arquetipo_id: arquetipoId, is_template: true })
        .eq('id', routineId)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error setting plantilla:', error)
      throw error
    }
  },

  async quitarPlantilla(routineId) {
    try {
      const { error } = await supabase
        .from('training_routines')
        .update({ is_template: false, arquetipo_id: null })
        .eq('id', routineId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error clearing plantilla:', error)
      throw error
    }
  }
}

export default arquetiposService
