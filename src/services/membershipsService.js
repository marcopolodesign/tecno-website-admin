import { supabase } from '../lib/supabase'
import logsService from './logsService'
import { getCurrentUserForLogging } from '../utils/logHelpers'

const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      acc[camelKey] = toCamelCase(obj[key])
      return acc
    }, {})
  }
  return obj
}

const membershipsService = {
  async getMemberships(filters = {}) {
    try {
      let query = supabase
        .from('memberships')
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          membership_plans:membership_plan_id (
            id,
            name,
            price,
            duration_months
          ),
          payments (
            id,
            amount,
            payment_method,
            payment_status,
            payment_date
          )
        `)
        .order('created_at', { ascending: false })

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      const { data, error } = await query

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching memberships:', error)
      throw error
    }
  },

  async getMembership(id) {
    try {
      // Guard: don't try to fetch if id is null/undefined
      if (!id) {
        console.warn('getMembership called with null/undefined id')
        return { data: null }
      }

      const { data, error } = await supabase
        .from('memberships')
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          membership_plans:membership_plan_id (
            id,
            name,
            price,
            duration_months
          ),
          payments (
            id,
            amount,
            payment_method,
            payment_status,
            payment_date,
            notes
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching membership:', error)
      throw error
    }
  },

  async createMembership(membershipData, paymentData) {
    try {
      // Get user info for logging
      const { data: userInfo, error: userFetchError } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', membershipData.userId)
        .single()

      if (userFetchError) throw userFetchError

      const userName = `${userInfo.first_name} ${userInfo.last_name}`

      // Look up membership_plan_id if not provided but membershipType is
      let membershipPlanId = membershipData.membershipPlanId
      if (!membershipPlanId && membershipData.membershipType) {
        const { data: plan } = await supabase
          .from('membership_plans')
          .select('id')
          .eq('name', membershipData.membershipType)
          .single()
        
        if (plan) {
          membershipPlanId = plan.id
        } else {
          // If no matching plan found, try to get any active plan as fallback
          const { data: fallbackPlan } = await supabase
            .from('membership_plans')
            .select('id')
            .eq('is_active', true)
            .limit(1)
            .single()
          
          membershipPlanId = fallbackPlan?.id || null
          console.warn(`No matching plan found for type "${membershipData.membershipType}", using fallback:`, membershipPlanId)
        }
      }

      // 1. Create membership
      const membership = {
        user_id: membershipData.userId,
        membership_plan_id: membershipPlanId,
        membership_type: membershipData.membershipType,
        start_date: membershipData.startDate,
        end_date: membershipData.endDate,
        status: 'active',
        is_renewal: membershipData.isRenewal || false,
        previous_membership_id: membershipData.previousMembershipId || null
      }

      const { data: membershipResult, error: membershipError } = await supabase
        .from('memberships')
        .insert([membership])
        .select()
        .single()

      if (membershipError) throw membershipError

      // 2. Create payment if payment data provided
      if (paymentData) {
        const payment = {
          membership_id: membershipResult.id,
          user_id: membershipData.userId,
          amount: paymentData.amount,
          payment_method: paymentData.paymentMethod,
          payment_status: paymentData.paymentStatus || 'completed',
          payment_date: paymentData.paymentDate || new Date().toISOString(),
          notes: paymentData.notes || '',
          is_renewal: membershipData.isRenewal || false
        }

        const { error: paymentError } = await supabase
          .from('payments')
          .insert([payment])

        if (paymentError) throw paymentError
      }

      // 3. Update user's current_membership_id
      const { error: userError } = await supabase
        .from('users')
        .update({ 
          current_membership_id: membershipResult.id,
          membership_type: membershipData.membershipType,
          membership_status: 'active',
          membership_start_date: membershipData.startDate,
          membership_end_date: membershipData.endDate
        })
        .eq('id', membershipData.userId)

      if (userError) throw userError

      // Log membership creation
      try {
        const performedBy = await getCurrentUserForLogging()

        await logsService.logMembershipCreated(
          membershipResult.id,
          membershipData.userId,
          userName,
          {
            type: membershipData.membershipType,
            startDate: membershipData.startDate,
            endDate: membershipData.endDate,
            paymentMethod: paymentData?.paymentMethod || 'efectivo',
            paymentAmount: paymentData?.amount || 0
          },
          performedBy
        )

        // Log payment if payment data was provided
        if (paymentData) {
          await logsService.createLog({
            actionType: 'payment_created',
            actionDescription: `Pago creado: $${paymentData.amount} por ${paymentData.paymentMethod} para ${userName}`,
            performedById: performedBy.id,
            performedByType: performedBy.type,
            performedByName: performedBy.name,
            entityType: 'payment',
            entityId: membershipResult.id, // Using membership ID as reference
            entityName: `Pago - ${userName}`,
            relatedUserId: membershipData.userId,
            relatedMembershipId: membershipResult.id,
            changes: {
              amount: paymentData.amount,
              payment_method: paymentData.paymentMethod,
              payment_status: paymentData.paymentStatus || 'completed',
              payment_date: paymentData.paymentDate || new Date().toISOString(),
              notes: paymentData.notes || ''
            },
            metadata: {
              created_via: 'membership_creation',
              timestamp: new Date().toISOString()
            }
          })
        }
      } catch (logError) {
        console.error('Error logging membership/payment creation:', logError)
        // Don't fail the operation if logging fails
      }

      return { data: toCamelCase(membershipResult) }
    } catch (error) {
      console.error('Error creating membership:', error)
      throw error
    }
  },

  async renewMembership(userId, currentMembershipId, renewalData, paymentData) {
    console.log('renewMembership called with:', { userId, currentMembershipId, renewalData: renewalData?.membershipType })
    
    try {
      // 1. Mark current membership as expired (only if it exists and is valid)
      if (currentMembershipId && currentMembershipId !== 'null' && currentMembershipId !== 'undefined') {
        console.log('Expiring current membership:', currentMembershipId)
        const { error: expireError } = await supabase
          .from('memberships')
          .update({ status: 'expired' })
          .eq('id', currentMembershipId)

        if (expireError) {
          console.error('Error expiring current membership:', expireError)
          // Don't throw - continue with renewal even if expire fails
        }
      } else {
        console.log('No current membership to expire, creating new membership directly')
      }

      // 2. Create new membership
      const newMembership = {
        userId,
        membershipPlanId: renewalData.membershipPlanId || null,
        membershipType: renewalData.membershipType,
        startDate: renewalData.startDate,
        endDate: renewalData.endDate,
        isRenewal: !!(currentMembershipId && currentMembershipId !== 'null'),
        previousMembershipId: (currentMembershipId && currentMembershipId !== 'null') ? currentMembershipId : null
      }

      console.log('Creating new membership:', newMembership)
      return await this.createMembership(newMembership, paymentData)
    } catch (error) {
      console.error('Error renewing membership:', error)
      throw error
    }
  },

  async updateMembership(id, membershipData) {
    try {
      // Guard: don't try to update if id is null/undefined
      if (!id) {
        console.warn('updateMembership called with null/undefined id, skipping')
        return { data: null }
      }

      // Get current membership data before update (for logging)
      const { data: oldMembership, error: fetchError } = await supabase
        .from('memberships')
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const updateData = {
        status: membershipData.status,
        end_date: membershipData.endDate,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('memberships')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Update user table if needed
      if (membershipData.updateUser) {
        const { error: userError } = await supabase
          .from('users')
          .update({
            membership_status: membershipData.status,
            membership_end_date: membershipData.endDate
          })
          .eq('current_membership_id', id)

        if (userError) throw userError
      }

      // Log the membership change
      const performedBy = await getCurrentUserForLogging()
      const userName = oldMembership.users ?
        `${oldMembership.users.first_name} ${oldMembership.users.last_name}` :
        'Unknown User'

      await logsService.logMembershipChanged(
        id,
        oldMembership.user_id,
        userName,
        {
          type: oldMembership.membership_type,
          startDate: oldMembership.start_date,
          endDate: oldMembership.end_date,
          status: oldMembership.status
        },
        {
          type: data.membership_type,
          startDate: data.start_date,
          endDate: data.end_date,
          status: data.status
        },
        performedBy
      )

      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating membership:', error)
      throw error
    }
  },

  async getExpiringMemberships(days = 7) {
    try {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + days)

      const { data, error } = await supabase
        .from('memberships')
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          membership_plans:membership_plan_id (
            name,
            price
          )
        `)
        .eq('status', 'active')
        .lte('end_date', futureDate.toISOString().split('T')[0])
        .order('end_date')

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching expiring memberships:', error)
      throw error
    }
  }
}

export default membershipsService

