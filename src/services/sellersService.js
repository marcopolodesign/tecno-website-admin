import { supabase } from '../lib/supabase'

export const sellersService = {
  async getSellers() {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching sellers:', error)
      throw error
    }
  },

  async getSeller(id) {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching seller:', error)
      throw error
    }
  },

  async createSeller(sellerData) {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .insert([sellerData])
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error creating seller:', error)
      throw error
    }
  },

  async updateSeller(id, sellerData) {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .update(sellerData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error updating seller:', error)
      throw error
    }
  },

  async deleteSeller(id) {
    try {
      const { error } = await supabase
        .from('sellers')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Error deleting seller:', error)
      throw error
    }
  },

  async assignLeadToSeller(leadId, sellerId) {
    try {
      const { data, error } = await supabase
        .from('seller_leads')
        .insert([{
          seller_id: sellerId,
          lead_id: leadId,
          assigned_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error assigning lead to seller:', error)
      throw error
    }
  },

  async getSellerLeads(sellerId) {
    try {
      const { data, error } = await supabase
        .from('seller_leads')
        .select(`
          *,
          leads (
            id,
            first_name,
            last_name,
            email,
            phone,
            status
          )
        `)
        .eq('seller_id', sellerId)
        .order('assigned_at', { ascending: false })

      if (error) throw error
      return { data }
    } catch (error) {
      console.error('Error fetching seller leads:', error)
      throw error
    }
  }
}

