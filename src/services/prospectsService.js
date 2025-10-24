import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api'
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN

const getAuthHeaders = () => {
  return {
    Authorization: `Bearer ${API_TOKEN}`
  }
}

export const prospectsService = {
  async getProspects() {
    try {
      const response = await axios.get(`${API_BASE_URL}/prospects`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching prospects:', error)
      throw error
    }
  },

  async getProspect(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/prospects/${id}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching prospect:', error)
      throw error
    }
  },

  async updateProspect(documentId, data) {
    try {
      const response = await axios.put(`${API_BASE_URL}/prospects/${documentId}`, {
        data
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error updating prospect:', error)
      throw error
    }
  },

  async deleteProspect(documentId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/prospects/${documentId}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error deleting prospect:', error)
      throw error
    }
  },

  async convertToLead(prospectId, prospectData, additionalData = {}) {
    try {
      // Create lead with prospect data
      const leadData = {
        firstName: prospectData.firstName || additionalData.firstName,
        lastName: prospectData.lastName || additionalData.lastName,
        email: prospectData.email,
        phone: prospectData.phone || additionalData.phone,
        trainingGoal: prospectData.trainingGoal || additionalData.trainingGoal,
        status: 'nuevo',
        submittedAt: new Date().toISOString(),
        convertedToUser: false,
        notes: prospectData.notes || '',
        prospect: prospectId,
        seller: additionalData.seller || null
      }

      const leadResponse = await axios.post(`${API_BASE_URL}/leads`, {
        data: leadData
      }, {
        headers: getAuthHeaders()
      })

      // Update prospect to mark as converted - use documentId for Strapi v5
      await axios.put(`${API_BASE_URL}/prospects/${prospectData.documentId}`, {
        data: {
          convertedToLead: true,
          lead: leadResponse.data.data.id
        }
      }, {
        headers: getAuthHeaders()
      })

      return leadResponse.data
    } catch (error) {
      console.error('Error converting prospect to lead:', error)
      throw error
    }
  }
}
