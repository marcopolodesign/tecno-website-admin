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
  async getPlans(includeInactive = false) {
    try {
      let query = supabase
        .from('membership_plans')
        .select('*')
        .order('duration_months')
      
      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error fetching membership plans:', error)
      throw error
    }
  },

  async createPlan(planData) {
    try {
      const insertData = {
        name: planData.name,
        duration_months: planData.durationMonths,
        price: planData.price,
        price_efectivo: planData.priceEfectivo || planData.price,
        price_debito_automatico: planData.priceDebitoAutomatico || planData.price,
        price_tarjeta_transferencia: planData.priceTarjetaTransferencia || planData.price,
        description: planData.description,
        is_active: planData.isActive ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('membership_plans')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error creating membership plan:', error)
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
      // Get current plan data before update (for logging)
      const { data: oldPlan, error: fetchError } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const updateData = {
        price: planData.price,
        price_efectivo: planData.priceEfectivo || planData.price,
        price_debito_automatico: planData.priceDebitoAutomatico || planData.price,
        price_tarjeta_transferencia: planData.priceTarjetaTransferencia || planData.price,
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

      // Log membership plan changes
      try {
        const performedBy = await getCurrentUserForLogging()

        await logsService.createLog({
          actionType: 'membership_updated',  // Using existing enum value for plan changes
          actionDescription: `Plan "${oldPlan.name}" modificado`,
          performedById: performedBy.id,
          performedByType: performedBy.type,
          performedByName: performedBy.name,
          entityType: 'membership_plan',
          entityId: id,
          entityName: oldPlan.name,
          changes: {
            old_price: oldPlan.price,
            new_price: planData.price,
            old_description: oldPlan.description,
            new_description: planData.description,
            old_is_active: oldPlan.is_active,
            new_is_active: planData.isActive
          },
          metadata: {
            plan_name: oldPlan.name,
            timestamp: new Date().toISOString()
          }
        })
      } catch (logError) {
        console.error('Error logging membership plan change:', logError)
        // Don't fail the operation if logging fails
      }

      return { data: toCamelCase(data) }
    } catch (error) {
      console.error('Error updating membership plan:', error)
      throw error
    }
  }
}

export default membershipPlansService

