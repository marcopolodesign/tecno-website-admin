import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'

export const exercisesService = {
  // ==================== BODY ZONES ====================
  async getBodyZones() {
    try {
      const { data, error } = await supabase
        .from('body_zones')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching body zones:', error)
      throw error
    }
  },

  async createBodyZone(zoneData) {
    try {
      const { data, error } = await supabase
        .from('body_zones')
        .insert([toSnakeCase(zoneData)])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating body zone:', error)
      throw error
    }
  },

  async updateBodyZone(id, zoneData) {
    try {
      const { data, error } = await supabase
        .from('body_zones')
        .update(toSnakeCase(zoneData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating body zone:', error)
      throw error
    }
  },

  async deleteBodyZone(id) {
    try {
      const { error } = await supabase
        .from('body_zones')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting body zone:', error)
      throw error
    }
  },

  // ==================== EXERCISE CATEGORIES ====================
  async getCategories(bodyZoneId = null) {
    try {
      let query = supabase
        .from('exercise_categories')
        .select(`
          *,
          body_zones (
            id,
            name
          )
        `)
        .order('display_order', { ascending: true })

      if (bodyZoneId) {
        query = query.eq('body_zone_id', bodyZoneId)
      }

      const { data, error } = await query

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching categories:', error)
      throw error
    }
  },

  async createCategory(categoryData) {
    try {
      const { data, error } = await supabase
        .from('exercise_categories')
        .insert([toSnakeCase(categoryData)])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating category:', error)
      throw error
    }
  },

  async updateCategory(id, categoryData) {
    try {
      const { data, error } = await supabase
        .from('exercise_categories')
        .update(toSnakeCase(categoryData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating category:', error)
      throw error
    }
  },

  async deleteCategory(id) {
    try {
      const { error } = await supabase
        .from('exercise_categories')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  },

  // ==================== EXERCISES ====================
  async getExercises(categoryId = null, search = '') {
    try {
      let query = supabase
        .from('exercises')
        .select(`
          *,
          exercise_categories (
            id,
            name,
            body_zones (
              id,
              name
            )
          ),
          easier_variation:exercises!easier_variation_id (
            id,
            name,
            difficulty_level
          ),
          harder_variation:exercises!harder_variation_id (
            id,
            name,
            difficulty_level
          )
        `)
        .order('name', { ascending: true })

      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching exercises:', error)
      throw error
    }
  },

  async getExercise(id) {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          *,
          exercise_categories (
            id,
            name,
            body_zones (
              id,
              name
            )
          ),
          easier_variation:exercises!easier_variation_id (
            id,
            name,
            difficulty_level,
            video_thumbnail_url
          ),
          harder_variation:exercises!harder_variation_id (
            id,
            name,
            difficulty_level,
            video_thumbnail_url
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching exercise:', error)
      throw error
    }
  },

  async createExercise(exerciseData) {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert([toSnakeCase(exerciseData)])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating exercise:', error)
      throw error
    }
  },

  async updateExercise(id, exerciseData) {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .update(toSnakeCase(exerciseData))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating exercise:', error)
      throw error
    }
  },

  async deleteExercise(id) {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting exercise:', error)
      throw error
    }
  },

  // ==================== UTILITY METHODS ====================
  async getExercisesByBodyZone(bodyZoneId) {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          *,
          exercise_categories!inner (
            id,
            name,
            body_zone_id
          )
        `)
        .eq('exercise_categories.body_zone_id', bodyZoneId)
        .order('name', { ascending: true })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching exercises by body zone:', error)
      throw error
    }
  },

  async searchExercises(query) {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          *,
          exercise_categories (
            id,
            name,
            body_zones (
              id,
              name
            )
          )
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(20)

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error searching exercises:', error)
      throw error
    }
  },

  // Get simplified list for modification dropdowns
  async getExercisesForSelect() {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, difficulty_level, category_id')
        .order('name', { ascending: true })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching exercises for select:', error)
      throw error
    }
  },

  // Helper to generate video embed HTML
  getVideoEmbed(exercise, width = 320, height = 180) {
    if (!exercise?.videoUrl) return null
    
    if (exercise.videoPlatform === 'youtube' && exercise.videoEmbedId) {
      return `<iframe width="${width}" height="${height}" src="https://www.youtube.com/embed/${exercise.videoEmbedId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    }
    
    if (exercise.videoPlatform === 'vimeo' && exercise.videoEmbedId) {
      return `<iframe width="${width}" height="${height}" src="https://player.vimeo.com/video/${exercise.videoEmbedId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    }
    
    if (exercise.videoPlatform === 'direct') {
      return `<video width="${width}" height="${height}" controls><source src="${exercise.videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`
    }
    
    return null
  }
}

export default exercisesService

