import { supabase } from '../lib/supabase'

const authService = {
  async login(email, password) {
    try {
      // First, authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Credenciales inválidas. Verifica tu email y contraseña.')
        } else if (authError.message.includes('Email not confirmed')) {
          throw new Error('Email no confirmado. Revisa tu bandeja de entrada.')
        } else {
          throw new Error(`Error de autenticación: ${authError.message}`)
        }
      }

      // Check if user is a seller (admin/front_desk/super_admin)
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single()

      if (!sellerError && seller) {
        // User is a seller
        return {
          user: authData.user,
          session: authData.session,
          jwt: authData.session?.access_token,
          profile: {
            type: 'seller',
            role: seller.role,
            ...seller
          }
        }
      }

      // Check if user is a coach
      const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single()

      if (!coachError && coach) {
        // User is a coach
        return {
          user: authData.user,
          session: authData.session,
          jwt: authData.session?.access_token,
          profile: {
            type: 'coach',
            role: 'coach',
            ...coach
          }
        }
      }

      // User authenticated but not a seller or coach
      await supabase.auth.signOut()
      throw new Error('No tienes permisos para acceder al panel de administración.')

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
      // Clear local storage
      localStorage.removeItem('userProfile')
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
      
      if (!session) return false

      // Verify user is still a seller or coach
      const profile = await this.getCurrentUserProfile()
      return !!profile
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

  async getCurrentUserProfile() {
    try {
      const user = await this.getCurrentUser()
      if (!user) return null

      // Check if cached profile exists
      const cachedProfile = localStorage.getItem('userProfile')
      if (cachedProfile) {
        return JSON.parse(cachedProfile)
      }

      // Check sellers table
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!sellerError && seller) {
        const profile = {
          type: 'seller',
          role: seller.role,
          ...seller
        }
        localStorage.setItem('userProfile', JSON.stringify(profile))
        return profile
      }

      // Check coaches table
      const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!coachError && coach) {
        const profile = {
          type: 'coach',
          role: 'coach',
          ...coach
        }
        localStorage.setItem('userProfile', JSON.stringify(profile))
        return profile
      }

      return null
    } catch (error) {
      console.error('Get current user profile error:', error)
      return null
    }
  },

  // Listen for auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

export { authService }
