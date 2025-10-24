import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api'
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN

const getAuthHeaders = () => {
  return {
    Authorization: `Bearer ${API_TOKEN}`
  }
}

export const usersService = {
  async getUsers() {
    try {
      const response = await axios.get(`${API_BASE_URL}/users?populate=lead`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error
    }
  },

  async getUser(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/${id}?populate=lead`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching user:', error)
      throw error
    }
  },

  async updateUser(id, data) {
    try {
      const response = await axios.put(`${API_BASE_URL}/users/${id}`, {
        data
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error updating user:', error)
      throw error
    }
  },

  async deleteUser(id) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/users/${id}`, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  }
}
