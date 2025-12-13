# 🌍 Environment Management Guide

This guide explains how to switch between **staging** and **production** environments for the TecnoFit Admin Panel.

## 📋 Quick Start

### 1. Setup Environment Files

First time setup:

```bash
cd /Users/mataldao/Local/tf-marcopolo/website/admin

# Copy example files
cp .env.staging.example .env.staging
cp .env.production.example .env.production

# Get staging keys from:
# https://supabase.com/dashboard/project/tmuazbkketrrnmtkzfjd/settings/api

# Edit .env.staging and add your keys
nano .env.staging
```

### 2. Switch Environments

**Option A: Using the helper script (Recommended)**

```bash
# Switch to staging
./switch-env.sh staging

# Switch to production
./switch-env.sh production

# Check current environment
./switch-env.sh
```

**Option B: Using npm scripts**

```bash
# Switch to staging
npm run env:staging

# Switch to production
npm run env:production
```

**Option C: Manual copy**

```bash
# For staging
cp .env.staging .env

# For production
cp .env.production .env
```

## 🚀 Running the Admin Panel

### Development Mode

```bash
# Run with current .env
npm run dev

# Or run directly with specific mode
npm run dev:staging      # Uses .env.staging
npm run dev:production   # Uses .env.production
```

### Build for Deployment

```bash
# Build with current .env
npm run build

# Or build for specific environment
npm run build:staging
npm run build:production
```

## 🔐 Environment Variables

### Staging Environment
- **URL:** https://tmuazbkketrrnmtkzfjd.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/tmuazbkketrrnmtkzfjd
- **Purpose:** Testing new features before production

### Production Environment
- **URL:** https://buntxbgjixlksffbscle.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/buntxbgjixlksffbscle
- **Purpose:** Live production data

## 📁 File Structure

```
admin/
├── .env                          # Active environment (gitignored)
├── .env.staging                  # Staging config (gitignored)
├── .env.staging.example          # Staging template
├── .env.production               # Production config (gitignored)
├── .env.production.example       # Production template
├── switch-env.sh                 # Helper script to switch
├── ENVIRONMENTS.md               # This file
└── package.json                  # Contains env scripts
```

## 🔄 Workflow Examples

### Testing New Features

```bash
# 1. Switch to staging
./switch-env.sh staging

# 2. Run dev server
npm run dev

# 3. Test your features at http://localhost:5173

# 4. When ready, switch to production
./switch-env.sh production
```

### Deploying to Vercel

Vercel automatically uses environment variables you set in the dashboard:

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add for **Production**:
   - `VITE_SUPABASE_URL` = https://buntxbgjixlksffbscle.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = [production anon key]
   - `VITE_SUPABASE_SERVICE_ROLE_KEY` = [production service role key]

5. Add for **Preview** (staging):
   - `VITE_SUPABASE_URL` = https://tmuazbkketrrnmtkzfjd.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = [staging anon key]
   - `VITE_SUPABASE_SERVICE_ROLE_KEY` = [staging service role key]

## ⚠️ Important Notes

1. **Never commit `.env` files** - They contain sensitive keys
2. **Always test on staging first** before pushing to production
3. **Use production carefully** - Real user data!
4. **Staging and production have separate databases** - Changes in one don't affect the other

## 🛠️ Troubleshooting

### "Cannot connect to database"
- Check your `.env` file has the correct keys
- Verify keys at: https://supabase.com/dashboard/project/[PROJECT_ID]/settings/api

### "Wrong environment"
- Run `./switch-env.sh` to check current environment
- Switch to the correct one: `./switch-env.sh staging` or `./switch-env.sh production`

### "Missing .env file"
- Copy from example: `cp .env.production.example .env.production`
- Add your keys from Supabase dashboard

## 📊 Database Sync

To sync staging with production changes:

```bash
cd /Users/mataldao/Local/tf-marcopolo/website

# Push migrations to staging
npx supabase db push --linked

# Or create a new migration
npx supabase migration new your_migration_name
# Edit the migration file
npx supabase db push --linked
```

## 🔗 Useful Links

- **Staging Dashboard:** https://supabase.com/dashboard/project/tmuazbkketrrnmtkzfjd
- **Production Dashboard:** https://supabase.com/dashboard/project/buntxbgjixlksffbscle
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Admin Panel (Production):** https://tecno-admin.vercel.app
- **Website (Production):** https://somostecnofit.com

---

**Need help?** Check the main project guide at `/Users/mataldao/Local/tf-marcopolo/website/AGENT_GUIDE.md`

