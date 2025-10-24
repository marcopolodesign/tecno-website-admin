import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api'
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN

const getAuthHeaders = () => {
  return {
    Authorization: `Bearer ${API_TOKEN}`
  }
}

export const sellersService = {
  async getSellers() {
    try {
      const response = await axios.get(`${API_BASE_URL}/sellers`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching sellers:', error)
      throw error
    }
  },

  async getSeller(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/sellers/${id}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching seller:', error)
      throw error
    }
  },

  async createSeller(data) {
    try {
      const response = await axios.post(`${API_BASE_URL}/sellers`, {
        data
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error creating seller:', error)
      throw error
    }
  },

  async updateSeller(id, data) {
    try {
      const response = await axios.put(`${API_BASE_URL}/sellers/${id}`, {
        data
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error updating seller:', error)
      throw error
    }
  },

  async deleteSeller(id) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/sellers/${id}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error deleting seller:', error)
      throw error
    }
  }
}

