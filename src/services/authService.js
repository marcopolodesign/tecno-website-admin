import { supabase } from '../lib/supabase'

const authService = {
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Credenciales inválidas. Verifica tu email y contraseña.')
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Email no confirmado. Revisa tu bandeja de entrada.')
        } else {
          throw new Error(`Error de autenticación: ${error.message}`)
        }
      }

      return {
        user: data.user,
        session: data.session,
        jwt: data.session?.access_token
      }
    } catch (error) {
      throw error
    }
  },

  async logout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error during logout:', error)
      }
      return { success: !error }
    } catch (error) {
      console.error('Logout error:', error)
      return { success: false, error }
    }
  },

  async verifyToken() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Session verification error:', error)
        return false
      }
      return !!session
    } catch (error) {
      console.error('Token verification error:', error)
      return false
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Get user error:', error)
        return null
      }
      return user
    } catch (error) {
      console.error('Get current user error:', error)
      return null
    }
  },

  // Listen for auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

export { authService }
