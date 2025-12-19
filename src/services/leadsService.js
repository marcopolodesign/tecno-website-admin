import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'
import membershipsService from './membershipsService'
import membershipPlansService from './membershipPlansService'
import logsService from './logsService'
import { getCurrentUserForLogging } from '../utils/logHelpers'

// Map frontend training goal values to database enum values
const trainingGoalMap = {
  'perdida-peso': 'weight_loss',
  'aumento-masa-muscular': 'muscle_gain',
  'mejora-resistencia': 'general_fitness',
  'tonificacion': 'general_fitness',
  'entrenamiento-funcional': 'general_fitness',
  'preparacion-competencias': 'sports_performance',
  'rehabilitacion': 'rehabilitation',
  'reduccion-estres': 'general_fitness',
  // Direct mappings (in case already in DB format)
  'weight_loss': 'weight_loss',
  'muscle_gain': 'muscle_gain',
  'general_fitness': 'general_fitness',
  'sports_performance': 'sports_performance',
  'rehabilitation': 'rehabilitation'
}

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
      const { data, error} = await supabase
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

  async createLead(data) {
    try {
      const leadData = {
        first_name: data.firstName,
        last_name: data.lastName || '',
        email: data.email,
        phone: data.phone,
        training_goal: trainingGoalMap[data.trainingGoal] || data.trainingGoal,
        status: 'new',
        notes: data.notes || '',
        submitted_at: new Date().toISOString(),
        converted_to_user: false,
        utm_source: data.utmSource || null,
        utm_medium: data.utmMedium || null,
        utm_campaign: data.utmCampaign || null,
        utm_term: data.utmTerm || null,
        utm_content: data.utmContent || null
      }
      
      // Add source field only if provided (requires schema cache refresh after adding column)
      if (data.source) {
        leadData.source = data.source
      }

      const { data: result, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(result) }
    } catch (error) {
      console.error('Error creating lead:', error)
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

  async convertToUser(leadId, leadData, membershipData, paymentData = null) {
    try {
      // Get current user for logging (optional - don't fail if not authenticated)
      const { data: { user } } = await supabase.auth.getUser()

      // Get membership plan to get price
      const { data: plans } = await membershipPlansService.getPlans()
      const selectedPlan = plans.find(p => p.name === membershipData.membershipType)
      if (!selectedPlan) throw new Error('Invalid membership type')

      // Create user (customer) with lead data
      const userData = {
        lead_id: leadId,
        first_name: leadData.firstName,
        last_name: leadData.lastName,
        email: leadData.email,
        phone: leadData.phone,
        training_goal: leadData.trainingGoal,
        membership_type: membershipData.membershipType,
        membership_status: 'active',
        membership_start_date: membershipData.startDate,
        membership_end_date: membershipData.endDate,
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

      // Create membership and payment
      const membershipInfo = {
        userId: customer.id,
        membershipPlanId: selectedPlan.id,
        membershipType: membershipData.membershipType,
        startDate: membershipData.startDate,
        endDate: membershipData.endDate,
        isRenewal: false
      }

      const payment = {
        amount: paymentData?.amount || selectedPlan.price,
        paymentMethod: paymentData?.paymentMethod || 'efectivo',
        paymentStatus: 'completed',
        paymentDate: paymentData?.paymentDate || new Date().toISOString(),
        notes: paymentData?.notes || 'Conversión de lead a usuario'
      }

      await membershipsService.createMembership(membershipInfo, payment)

      // Update lead to mark as converted (don't update user_id as it references profiles, not users)
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_to_user: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (leadError) throw leadError

      // Log the conversion
      try {
        const performedBy = await getCurrentUserForLogging()
        const userName = `${leadData.firstName} ${leadData.lastName}`
        await logsService.logLeadConvertedToUser(
          leadId,
          customer.id,
          customer.current_membership_id,
          userName,
          {
            type: membershipData.membershipType,
            startDate: membershipData.startDate,
            endDate: membershipData.endDate,
            paymentMethod: paymentData?.paymentMethod || 'efectivo',
            paymentAmount: paymentData?.amount || selectedPlan.price
          },
          performedBy
        )
      } catch (logError) {
        console.error('Error logging lead conversion:', logError)
        // Don't throw - logging should never break the main flow
      }

      return { data: toCamelCase(customer) }
    } catch (error) {
      console.error('Error converting lead to user:', error)
      throw error
    }
  }
}
