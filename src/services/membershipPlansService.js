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

const toSnakeCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      acc[snakeKey] = toSnakeCase(obj[key])
      return acc
    }, {})
  }
  return obj
}

const membershipPlansService = {
  async getPlans() {
    try {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('is_active', true)
        .order('duration_months')

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching membership plans:', error)
      throw error
    }
  },

  // Helper to get price based on payment method
  getPriceForPaymentMethod(plan, paymentMethod) {
    if (!plan) return 0
    switch (paymentMethod) {
      case 'efectivo':
        return plan.priceEfectivo || plan.price
      case 'debito_automatico':
        return plan.priceDebitoAutomatico || plan.price
      case 'tarjeta':
      case 'transferencia':
      case 'tarjeta_transferencia':
        return plan.priceTarjetaTransferencia || plan.price
      default:
        return plan.price
    }
  },

  async getPlan(id) {
    try {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching membership plan:', error)
      throw error
    }
  },

  async updatePlan(id, planData) {
    try {
      const updateData = {
        price: planData.price,
        description: planData.description,
        is_active: planData.isActive,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('membership_plans')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating membership plan:', error)
      throw error
    }
  }
}

export default membershipPlansService

