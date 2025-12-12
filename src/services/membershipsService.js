import { supabase } from '../lib/supabase'

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
      // 1. Create membership
      const membership = {
        user_id: membershipData.userId,
        membership_plan_id: membershipData.membershipPlanId,
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
          membership_status: 'activo',
          start_date: membershipData.startDate,
          end_date: membershipData.endDate
        })
        .eq('id', membershipData.userId)

      if (userError) throw userError

      return { data: toCamelCase(membershipResult) }
    } catch (error) {
      console.error('Error creating membership:', error)
      throw error
    }
  },

  async renewMembership(userId, currentMembershipId, renewalData, paymentData) {
    try {
      // 1. Mark current membership as expired
      const { error: expireError } = await supabase
        .from('memberships')
        .update({ status: 'expired' })
        .eq('id', currentMembershipId)

      if (expireError) throw expireError

      // 2. Create new membership with is_renewal = true
      const newMembership = {
        userId,
        membershipPlanId: renewalData.membershipPlanId,
        membershipType: renewalData.membershipType,
        startDate: renewalData.startDate,
        endDate: renewalData.endDate,
        isRenewal: true,
        previousMembershipId: currentMembershipId
      }

      return await this.createMembership(newMembership, paymentData)
    } catch (error) {
      console.error('Error renewing membership:', error)
      throw error
    }
  },

  async updateMembership(id, membershipData) {
    try {
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
            membership_status: membershipData.status === 'active' ? 'activo' : 
                             membershipData.status === 'expired' ? 'vencido' : 'cancelado',
            end_date: membershipData.endDate
          })
          .eq('current_membership_id', id)

        if (userError) throw userError
      }

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

