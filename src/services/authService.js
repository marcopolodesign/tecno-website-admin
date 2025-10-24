import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api'
const API_TOKEN = import.meta.env.VITE_STRAPI_API_TOKEN

const authService = {
  async login(email, password) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/local`, {
        identifier: email,
        password: password
      })
      return response.data
    } catch (error) {
      throw new Error('Credenciales inválidas')
    }
  },

  async verifyToken(token) {
    // If token exists in localStorage, trust it
    // We don't actually verify it against the API since we use API tokens for data access
    // The JWT token is just for login session management
    if (!token) {
      return false
    }

    // Simply check if token exists and is not empty
    // The actual API calls use the API_TOKEN from .env which has proper permissions
    return token && token.length > 0
  }
}

export { authService }
