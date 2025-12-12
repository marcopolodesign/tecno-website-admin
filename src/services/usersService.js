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

  async createUser(data) {
    try {
      // Get current authenticated user for profile association
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const userData = {
        profile_id: user.id,
        first_name: data.firstName,
        last_name: data.lastName || '',
        email: data.email,
        phone: data.phone,
        training_goal: data.trainingGoal,
        membership_type: data.membershipType,
        membership_status: 'activo',
        start_date: data.startDate,
        end_date: data.endDate,
        emergency_contact: data.emergencyContact || '',
        emergency_phone: data.emergencyPhone || '',
        medical_notes: data.medicalNotes || '',
        notes: data.notes || '',
        utm_source: data.utmSource || null,
        utm_medium: data.utmMedium || null,
        utm_campaign: data.utmCampaign || null,
        utm_term: data.utmTerm || null,
        utm_content: data.utmContent || null,
        converted_at: new Date().toISOString()
      }

      const { data: result, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(result) }
    } catch (error) {
      console.error('Error creating user:', error)
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
