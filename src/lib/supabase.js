import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
// Browser client MUST only ever hold the anon key. VITE_* env vars are inlined into the
// public JS bundle at build time — anything with more privilege than anon here (e.g. the
// service role key) is handed to every visitor of the site. Admin-only operations
// (auth.admin.* — creating/deleting users, etc.) go through Edge Functions instead,
// which hold the service role key server-side only. See tecnofit-supabase/supabase/
// functions/manage-staff-account and kiosk-set-password.
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-key'

export const supabase = createClient(supabaseUrl, anonKey, {
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
