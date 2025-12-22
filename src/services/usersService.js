import { supabase, toCamelCase, toSnakeCase } from '../lib/supabase'
import membershipsService from './membershipsService'
import membershipPlansService from './membershipPlansService'
import logsService from './logsService'
import { getCurrentUserForLogging } from '../utils/logHelpers'

export const usersService = {
  async getUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
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
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching user:', error)
      throw error
    }
  },

  async createUser(data, paymentData = null) {
    try {
      // Get current authenticated user for profile association
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get membership plan to get price
      const { data: plans } = await membershipPlansService.getPlans()
      const selectedPlan = plans.find(p => p.name === data.membershipType)
      if (!selectedPlan) throw new Error('Invalid membership type')

      const userData = {
        first_name: data.firstName,
        last_name: data.lastName || '',
        email: data.email,
        phone: data.phone,
        training_goal: data.trainingGoal,
        membership_type: data.membershipType,
        membership_status: 'active',
        membership_start_date: data.startDate,
        membership_end_date: data.endDate,
        emergency_contact: data.emergencyContact || '',
        emergency_phone: data.emergencyPhone || '',
        medical_notes: data.medicalNotes || '',
        notes: data.notes || '',
        source: data.source || null,
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

      // Create membership and payment if payment data provided
      if (paymentData && paymentData.createPayment) {
        const membershipInfo = {
          userId: result.id,
          membershipPlanId: selectedPlan.id,
          membershipType: data.membershipType,
          startDate: data.startDate,
          endDate: data.endDate,
          isRenewal: false
        }

        const payment = {
          amount: paymentData.amount || selectedPlan.price,
          paymentMethod: paymentData.paymentMethod || 'efectivo',
          paymentStatus: 'completed',
          paymentDate: paymentData.paymentDate || new Date().toISOString(),
          notes: paymentData.notes || ''
        }

        await membershipsService.createMembership(membershipInfo, payment)
      }

      // Log manual user creation
      try {
        const performedBy = await getCurrentUserForLogging()
        const userName = `${data.firstName} ${data.lastName || ''}`.trim()

        await logsService.logUserCreated(
          result.id,
          userName,
          {
            email: data.email,
            phone: data.phone,
            membershipType: data.membershipType,
            trainingGoal: data.trainingGoal,
            source: data.source,
            utmSource: data.utmSource,
            utmMedium: data.utmMedium,
            utmCampaign: data.utmCampaign
          },
          performedBy
        )
      } catch (logError) {
        console.error('Error logging user creation:', logError)
        // Don't fail the operation if logging fails
      }

      return { data: toCamelCase(result) }
    } catch (error) {
      console.error('Error creating user:', error)
      throw error
    }
  },

  async updateUser(id, data) {
    try {
      // Get current user data before update (for logging)
      const { data: oldUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const snakeData = toSnakeCase(data)
      const { data: result, error } = await supabase
        .from('users')
        .update(snakeData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Log user changes
      try {
        const performedBy = await getCurrentUserForLogging()
        const userName = `${oldUser.first_name} ${oldUser.last_name}`

        await logsService.createLog({
          actionType: 'user_updated',  // Using existing enum value
          actionDescription: `Usuario ${userName} modificado`,
          performedById: performedBy.id,
          performedByType: performedBy.type,
          performedByName: performedBy.name,
          entityType: 'user',
          entityId: id,
          entityName: userName,
          relatedUserId: id,
          changes: {
            old_first_name: oldUser.first_name,
            new_first_name: data.firstName || oldUser.first_name,
            old_last_name: oldUser.last_name,
            new_last_name: data.lastName || oldUser.last_name,
            old_email: oldUser.email,
            new_email: data.email || oldUser.email,
            old_phone: oldUser.phone,
            new_phone: data.phone || oldUser.phone,
            old_membership_type: oldUser.membership_type,
            new_membership_type: data.membershipType || oldUser.membership_type,
            old_training_goal: oldUser.training_goal,
            new_training_goal: data.trainingGoal || oldUser.training_goal,
            old_source: oldUser.source,
            new_source: data.source || oldUser.source
          },
          metadata: {
            updated_fields: Object.keys(data),
            timestamp: new Date().toISOString()
          }
        })
      } catch (logError) {
        console.error('Error logging user change:', logError)
        // Don't fail the operation if logging fails
      }

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
