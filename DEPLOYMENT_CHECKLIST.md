# 🚀 Deployment Checklist - Admin Panel Updates

## Changes Summary

Updated the admin panel to properly create coaches and sellers using Supabase Admin API.

### What Changed?

1. ✅ **Coaches Creation** - Now uses `supabase.auth.admin.createUser()`
2. ✅ **Sellers Creation** - Now uses `supabase.auth.admin.createUser()`
3. ✅ **Supabase Client** - Now uses service role key for admin operations
4. ✅ **Environment Variables** - Added `VITE_SUPABASE_SERVICE_ROLE_KEY`

## Pre-Deployment Checklist

### 1. Environment Variables (Vercel)

⚠️ **CRITICAL:** You must add the service role key to Vercel environment variables before deploying!

**Steps:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your admin project (tecno-admin)
3. Go to Settings > Environment Variables
4. Add the following variable:
   ```
   Name: VITE_SUPABASE_SERVICE_ROLE_KEY
   Value: [Your Supabase Service Role Key]
   Environment: Production, Preview, Development
   ```

**How to get your Service Role Key:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings > API
4. Copy the `service_role` key (⚠️ Keep this secret!)

### 2. Local Testing (Optional but Recommended)

Before deploying, test locally:

```bash
# 1. Update your local .env file
echo "VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" >> .env

# 2. Start the dev server
npm run dev

# 3. Test in browser (http://localhost:5173)
# - Login with admin credentials
# - Try creating a coach
# - Try creating a seller
# - Verify they appear in the lists
# - Check Supabase dashboard to confirm users were created
```

### 3. Build Test

Ensure the build succeeds:

```bash
npm run build
```

Expected output:
```
✓ built in 2.19s
```

## Deployment Steps

### Option A: Automatic Deployment (Recommended)

If this is a Git repository connected to Vercel:

```bash
# 1. Commit changes
git add .
git commit -m "fix: Use admin API for creating coaches and sellers"

# 2. Push to main branch
git push origin main

# 3. Vercel will automatically deploy
# Monitor at: https://vercel.com/dashboard
```

### Option B: Manual Deployment

If not using Git:

```bash
# 1. Build the project
npm run build

# 2. Deploy to Vercel
vercel --prod

# Follow the prompts
```

## Post-Deployment Verification

### 1. Check Deployment Status

- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Verify deployment succeeded
- Check build logs for any errors

### 2. Test Production Site

Navigate to: https://tecno-admin.vercel.app

**Test Coaches:**
1. Login with admin credentials
2. Go to Coaches page
3. Click "Nuevo Coach"
4. Fill form with test data:
   - First Name: Test
   - Last Name: Coach
   - Email: test.coach.[timestamp]@tecnofit.com
   - Phone: +54 9 11 8888-8888
   - Password: Test123!
   - Specialization: Functional Training
   - Certifications: ACE-CPT, TRX
5. Submit form
6. ✅ Coach should appear in grid immediately
7. ✅ No email confirmation required

**Test Sellers:**
1. Go to Sellers page
2. Click "Nuevo Vendedor"
3. Fill form with test data:
   - First Name: Test
   - Last Name: Seller
   - Email: test.seller.[timestamp]@tecnofit.com
   - Phone: +54 9 11 9999-9999
   - Password: Test123!
   - Role: front_desk
4. Submit form
5. ✅ Seller should appear in table immediately
6. ✅ No email confirmation required

### 3. Verify in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Authentication > Users
3. ✅ Verify test users were created
4. ✅ Verify email is confirmed (green checkmark)
5. Navigate to Database > Tables
6. Check `coaches` table - ✅ Test coach record exists
7. Check `sellers` table - ✅ Test seller record exists
8. ✅ Verify `auth_user_id` matches the auth user ID

### 4. Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. ✅ No errors should appear
4. Go to Network tab
5. ✅ API calls should go to Supabase (not Strapi)
6. ✅ No 401/403 errors

## Rollback Plan

If something goes wrong:

### Quick Rollback (Vercel)
1. Go to Vercel Dashboard
2. Find the previous deployment
3. Click "Promote to Production"

### Code Rollback (Git)
```bash
git revert HEAD
git push origin main
```

## Troubleshooting

### Error: "Auth admin methods require a service role key"

**Cause:** Service role key not set in Vercel environment variables

**Fix:**
1. Go to Vercel > Settings > Environment Variables
2. Add `VITE_SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy

### Error: "User already registered"

**Cause:** Email already exists in Supabase Auth

**Fix:**
1. Use a different email address
2. Or delete the existing user from Supabase dashboard

### Error: "Failed to create coach/seller"

**Cause:** Could be RLS policy or permissions issue

**Fix:**
1. Check Supabase logs in Dashboard > Logs
2. Verify service role key is correct
3. Check RLS policies allow inserts

### Coaches/Sellers not appearing after creation

**Cause:** Could be a frontend refresh issue

**Fix:**
1. Check browser console for errors
2. Verify the `fetchCoaches()` or `fetchSellers()` is called after creation
3. Check if data exists in Supabase tables

## Success Criteria

✅ Deployment succeeded in Vercel
✅ Can login to admin panel
✅ Can create a coach (appears in grid immediately)
✅ Can create a seller (appears in table immediately)
✅ No email confirmation required
✅ Users appear in Supabase Auth
✅ Records appear in coaches/sellers tables
✅ No console errors
✅ All API calls go to Supabase

## Next Steps

After successful deployment:

1. ✅ Delete test coaches/sellers from production
2. ✅ Document the new flow for the team
3. ✅ Update any training materials
4. ✅ Monitor for any issues in first 24 hours

## Notes

- The service role key gives full admin access - keep it secret!
- Only the admin panel should use the service role key
- The public website should continue using the anon key
- Consider rotating the service role key periodically for security

## Support

If you need help:
1. Check this checklist first
2. Review `ADMIN_SETUP.md` for detailed setup instructions
3. Check Supabase and Vercel logs
4. Contact the development team

