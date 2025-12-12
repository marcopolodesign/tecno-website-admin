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

const paymentsService = {
  async getPayments(filters = {}) {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            email
          ),
          memberships:membership_id (
            id,
            membership_type,
            start_date,
            end_date
          )
        `)
        .order('payment_date', { ascending: false })

      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters.paymentStatus) {
        query = query.eq('payment_status', filters.paymentStatus)
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .gte('payment_date', filters.startDate)
          .lte('payment_date', filters.endDate)
      }

      const { data, error } = await query

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching payments:', error)
      throw error
    }
  },

  async getPayment(id) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          users:user_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          memberships:membership_id (
            id,
            membership_type,
            start_date,
            end_date,
            status
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching payment:', error)
      throw error
    }
  },

  async getRevenueStats(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, is_renewal, payment_date, memberships(membership_type)')
        .eq('payment_status', 'completed')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)

      if (error) throw error

      const stats = {
        totalRevenue: 0,
        newCustomersRevenue: 0,
        renewalsRevenue: 0,
        newCustomersCount: 0,
        renewalsCount: 0,
        byMembershipType: {}
      }

      data.forEach(payment => {
        const amount = parseFloat(payment.amount)
        stats.totalRevenue += amount

        if (payment.is_renewal) {
          stats.renewalsRevenue += amount
          stats.renewalsCount++
        } else {
          stats.newCustomersRevenue += amount
          stats.newCustomersCount++
        }

        // Group by membership type
        const membershipType = payment.memberships?.membership_type || 'unknown'
        if (!stats.byMembershipType[membershipType]) {
          stats.byMembershipType[membershipType] = {
            revenue: 0,
            count: 0
          }
        }
        stats.byMembershipType[membershipType].revenue += amount
        stats.byMembershipType[membershipType].count++
      })

      return { data: stats }
    } catch (error) {
      console.error('Error fetching revenue stats:', error)
      throw error
    }
  }
}

export default paymentsService

