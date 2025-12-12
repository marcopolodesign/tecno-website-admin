import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'
import membershipsService from './membershipsService'
import membershipPlansService from './membershipPlansService'

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
        training_goal: data.trainingGoal,
        status: 'nuevo',
        notes: data.notes || '',
        source: data.source || 'manual',
        submitted_at: new Date().toISOString(),
        converted_to_user: false,
        utm_source: data.utmSource || null,
        utm_medium: data.utmMedium || null,
        utm_campaign: data.utmCampaign || null,
        utm_term: data.utmTerm || null,
        utm_content: data.utmContent || null
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
      // Get current user for profile association
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get membership plan to get price
      const { data: plans } = await membershipPlansService.getPlans()
      const selectedPlan = plans.find(p => p.name === membershipData.membershipType)
      if (!selectedPlan) throw new Error('Invalid membership type')

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
