import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
// Use service role key for admin operations (creating users, etc.)
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseKey = serviceRoleKey || anonKey || 'your-key'

// Debug log to check if service key is loaded
if (import.meta.env.DEV) {
  console.log('Supabase Init:', {
    hasServiceKey: !!serviceRoleKey,
    hasAnonKey: !!anonKey,
    usingKey: serviceRoleKey ? 'Service Role (Admin)' : 'Anon (Public)'
  })
}

export const isServiceRole = !!serviceRoleKey

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return !!session
}

// Helper function to convert snake_case to camelCase
export const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v))
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      result[camelKey] = toCamelCase(obj[key])
      return result
    }, {})
  }
  return obj
}

// Helper function to convert camelCase to snake_case
export const toSnakeCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v))
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      result[snakeKey] = toSnakeCase(obj[key])
      return result
    }, {})
  }
  return obj
}

export default supabase
