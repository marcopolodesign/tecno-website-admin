import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'

export const leadsService = {
  async getLeads() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          prospects (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching leads:', error)
      throw error
    }
  },

  async getLead(id) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          prospects (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching lead:', error)
      throw error
    }
  },

  async updateLead(id, data) {
    try {
      const snakeData = toSnakeCase(data)
      const { data: result, error } = await supabase
        .from('leads')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(result) }
    } catch (error) {
      console.error('Error updating lead:', error)
      throw error
    }
  },

  async deleteLead(id) {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting lead:', error)
      throw error
    }
  },

  async exportLeads() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error exporting leads:', error)
      throw error
    }
  },

  async convertToUser(leadId, leadData, membershipData) {
    try {
      // Get current user for profile association
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Create user (customer) with lead data
      const userData = {
        profile_id: user.id,
        lead_id: leadId,
        first_name: leadData.firstName,
        last_name: leadData.lastName,
        email: leadData.email,
        phone: leadData.phone,
        training_goal: leadData.trainingGoal,
        membership_type: membershipData.membershipType,
        membership_status: 'activo',
        start_date: membershipData.startDate,
        end_date: membershipData.endDate,
        emergency_contact: membershipData.emergencyContact || '',
        emergency_phone: membershipData.emergencyPhone || '',
        medical_notes: membershipData.medicalNotes || '',
        notes: leadData.notes || '',
        // Inherit UTM parameters from lead
        utm_source: leadData.utmSource || null,
        utm_medium: leadData.utmMedium || null,
        utm_campaign: leadData.utmCampaign || null,
        utm_term: leadData.utmTerm || null,
        utm_content: leadData.utmContent || null,
        converted_at: new Date().toISOString()
      }

      const { data: customer, error: userError } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single()

      if (userError) throw userError

      // Update lead to mark as converted
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'convertido',
          converted_to_user: true,
          user_id: customer.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (leadError) throw leadError

      return { data: toCamelCase(customer) }
    } catch (error) {
      console.error('Error converting lead to user:', error)
      throw error
    }
  }
}
