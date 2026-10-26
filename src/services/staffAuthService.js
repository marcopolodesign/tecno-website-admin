import { supabase } from '../lib/supabase'

// Thin wrapper around the manage-staff-account Edge Function — the only place that's
// allowed to create/update-password/delete the auth.users account behind a coach or
// seller. Requires the caller to be signed in as a seller with role admin/super_admin
// (enforced server-side); the function returns a real error.message we surface as-is.
async function callManageStaffAccount(payload) {
  const { data, error } = await supabase.functions.invoke('manage-staff-account', {
    body: payload,
  })

  if (error) {
    // supabase-js only puts the HTTP status in `error`; the real message is in the
    // function's JSON body, available via error.context when using invoke().
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch {
      // ignore — fall back to error.message
    }
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)

  return data
}

export const staffAuthService = {
  createAccount({ target, email, password, first_name, last_name }) {
    return callManageStaffAccount({ action: 'create', target, email, password, first_name, last_name })
  },
  updatePassword({ auth_user_id, password }) {
    return callManageStaffAccount({ action: 'update_password', auth_user_id, password })
  },
  deleteAccount({ auth_user_id }) {
    return callManageStaffAccount({ action: 'delete', auth_user_id })
  },
}
