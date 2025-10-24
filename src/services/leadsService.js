import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api'
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN

const getAuthHeaders = () => {
  return {
    Authorization: `Bearer ${API_TOKEN}`
  }
}

export const leadsService = {
  async getLeads() {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching leads:', error)
      throw error
    }
  },

  async getLead(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads/${id}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching lead:', error)
      throw error
    }
  },

  async updateLead(id, data) {
    try {
      const response = await axios.put(`${API_BASE_URL}/leads/${id}`, {
        data
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error updating lead:', error)
      throw error
    }
  },

  async deleteLead(id) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/leads/${id}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error deleting lead:', error)
      throw error
    }
  },

  async exportLeads() {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error exporting leads:', error)
      throw error
    }
  },

  async convertToUser(leadId, leadData, membershipData) {
    try {
      // Create user with lead data
      const userData = {
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        email: leadData.email,
        phone: leadData.phone,
        trainingGoal: leadData.trainingGoal,
        membershipType: membershipData.membershipType,
        membershipStatus: 'activo',
        startDate: membershipData.startDate,
        endDate: membershipData.endDate,
        emergencyContact: membershipData.emergencyContact || '',
        emergencyPhone: membershipData.emergencyPhone || '',
        medicalNotes: membershipData.medicalNotes || '',
        notes: leadData.notes || '',
        convertedAt: new Date().toISOString(),
        lead: leadId,
        seller: leadData.seller || null
      }

      const userResponse = await axios.post(`${API_BASE_URL}/users`, {
        data: userData
      }, {
        headers: getAuthHeaders()
      })

      // Update lead to mark as converted
      await axios.put(`${API_BASE_URL}/leads/${leadId}`, {
        data: {
          status: 'convertido',
          convertedToUser: true,
          user: userResponse.data.data.id
        }
      }, {
        headers: getAuthHeaders()
      })

      return userResponse.data
    } catch (error) {
      console.error('Error converting lead to user:', error)
      throw error
    }
  }
}
