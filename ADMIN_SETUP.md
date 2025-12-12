# Admin Panel Setup Guide

## Environment Variables

The admin panel requires the following environment variables:

### Required Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Getting Your Keys

1. **Supabase URL and Anon Key:**
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy the `Project URL` and `anon/public` key

2. **Service Role Key (IMPORTANT):**
   - Go to Settings > API
   - Copy the `service_role` key (⚠️ Keep this secret!)
   - This key is required for admin operations like:
     - Creating users (coaches, sellers)
     - Deleting users
     - Updating user passwords
     - Bypassing RLS policies

### Security Notes

⚠️ **NEVER commit the service role key to version control**

The service role key has full access to your database and bypasses all Row Level Security (RLS) policies. It should:
- Only be used in the admin panel (not in the public website)
- Be stored in environment variables
- Be added to `.gitignore`
- Be kept secret and rotated regularly

## Admin Operations

### Creating Coaches

The admin panel uses `supabase.auth.admin.createUser()` to create coaches:

```javascript
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: formData.email,
  password: formData.password,
  email_confirm: true, // Auto-confirm email
  user_metadata: {
    first_name: formData.first_name,
    last_name: formData.last_name
  }
})
```

This approach:
- ✅ Creates the user immediately without email confirmation
- ✅ Uses admin privileges to bypass signup restrictions
- ✅ Sets user metadata for first and last name
- ✅ Links the auth user to the coaches table via `auth_user_id`

### Creating Sellers

Similar to coaches, sellers are created using the admin API:

```javascript
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: formData.email,
  password: formData.password,
  email_confirm: true,
  user_metadata: {
    first_name: formData.first_name,
    last_name: formData.last_name
  }
})
```

Then a seller record is created in the `sellers` table with the `auth_user_id`.

## Deployment

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials (including service role key)

3. Start the dev server:
   ```bash
   npm run dev
   ```

### Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add all three environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_SERVICE_ROLE_KEY`

4. Deploy:
   ```bash
   npm run build
   vercel --prod
   ```

## Testing Coach/Seller Creation

### Test Checklist

- [ ] Navigate to Coaches page
- [ ] Click "Nuevo Coach" button
- [ ] Fill out the form with test data
- [ ] Submit the form
- [ ] Verify coach appears in the grid
- [ ] Check Supabase dashboard:
  - [ ] Auth user was created
  - [ ] Coach record was created with correct `auth_user_id`
  - [ ] Email is confirmed (no confirmation email sent)

- [ ] Navigate to Sellers page
- [ ] Click "Nuevo Vendedor" button
- [ ] Fill out the form with test data
- [ ] Submit the form
- [ ] Verify seller appears in the table
- [ ] Check Supabase dashboard:
  - [ ] Auth user was created
  - [ ] Seller record was created with correct `auth_user_id`
  - [ ] Email is confirmed

### Common Issues

**Issue:** "Auth admin methods require a service role key"
- **Solution:** Make sure `VITE_SUPABASE_SERVICE_ROLE_KEY` is set in your environment variables

**Issue:** "User already registered"
- **Solution:** Use a different email address or delete the existing user from Supabase Auth

**Issue:** "Row Level Security policy violation"
- **Solution:** The service role key should bypass RLS. Check that the key is correctly set.

## Changes Made

### Updated Files

1. **`src/lib/supabase.js`**
   - Now uses `VITE_SUPABASE_SERVICE_ROLE_KEY` if available
   - Falls back to anon key for backward compatibility

2. **`src/components/Coaches.jsx`**
   - Changed from `supabase.auth.signUp()` to `supabase.auth.admin.createUser()`
   - Added `email_confirm: true` to skip email verification

3. **`src/components/Sellers.jsx`**
   - Changed from `supabase.auth.signUp()` to `supabase.auth.admin.createUser()`
   - Added `email_confirm: true` to skip email verification

4. **`.env.example`**
   - Added `VITE_SUPABASE_SERVICE_ROLE_KEY` with documentation

### Why These Changes?

The previous implementation used `supabase.auth.signUp()` which:
- ❌ Requires email confirmation (sends confirmation emails)
- ❌ May be disabled in Supabase settings
- ❌ Doesn't work well for admin-created accounts

The new implementation uses `supabase.auth.admin.createUser()` which:
- ✅ Creates users immediately without confirmation
- ✅ Works regardless of Supabase email settings
- ✅ Is the recommended approach for admin panels
- ✅ Allows setting `email_confirm: true` to skip verification

## Support

If you encounter issues:
1. Check that all environment variables are set correctly
2. Verify the service role key is valid in Supabase dashboard
3. Check browser console for error messages
4. Check Supabase dashboard > Auth > Users to see if users were created
5. Check Supabase dashboard > Database > Tables to see if records were created

