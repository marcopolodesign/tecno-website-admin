import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'

export const usersService = {
  async getUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          leads (
            first_name,
            last_name,
            email,
            training_goal
          ),
          profiles (
            username,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error
    }
  },

  async getUser(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          leads (
            first_name,
            last_name,
            email,
            training_goal
          ),
          profiles (
            username,
            first_name,
            last_name
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching user:', error)
      throw error
    }
  },

  async updateUser(id, data) {
    try {
      const snakeData = toSnakeCase(data)
      const { data: result, error } = await supabase
        .from('users')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(result) }
    } catch (error) {
      console.error('Error updating user:', error)
      throw error
    }
  },

  async deleteUser(id) {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  },

  async exportUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error exporting users:', error)
      throw error
    }
  }
}
