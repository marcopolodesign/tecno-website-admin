import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'

export const prospectsService = {
  async getProspects() {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching prospects:', error)
      throw error
    }
  },

  async getProspect(id) {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching prospect:', error)
      throw error
    }
  },

  async updateProspect(id, data) {
    try {
      const snakeData = toSnakeCase(data)
      const { data: result, error } = await supabase
        .from('prospects')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(result) }
    } catch (error) {
      console.error('Error updating prospect:', error)
      throw error
    }
  },

  async deleteProspect(id) {
    try {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting prospect:', error)
      throw error
    }
  },

  async convertToLead(prospectId, prospectData, additionalData = {}) {
    try {
      // Create lead with prospect data
      const leadData = {
        prospect_id: prospectId,
        first_name: prospectData.firstName || additionalData.firstName,
        last_name: prospectData.lastName || additionalData.lastName,
        email: prospectData.email,
        phone: prospectData.phone || additionalData.phone,
        training_goal: prospectData.trainingGoal || additionalData.trainingGoal,
        status: 'nuevo',
        submitted_at: new Date().toISOString(),
        converted_to_user: false,
        notes: prospectData.notes || '',
        // Inherit UTM params from prospect
        utm_source: prospectData.utmSource || '',
        utm_medium: prospectData.utmMedium || '',
        utm_campaign: prospectData.utmCampaign || '',
        utm_term: prospectData.utmTerm || '',
        utm_content: prospectData.utmContent || ''
      }

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()

      if (leadError) throw leadError

      // Update prospect to mark as converted
      const { error: prospectError } = await supabase
        .from('prospects')
        .update({
          converted_to_lead: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospectId)

      if (prospectError) throw prospectError

      return { data: toCamelCase(lead) }
    } catch (error) {
      console.error('Error converting prospect to lead:', error)
      throw error
    }
  }
}
