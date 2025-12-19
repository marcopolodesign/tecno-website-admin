# Local Development with Supabase

This guide explains how to run the admin panel with a local Supabase instance.

## Prerequisites

- Docker Desktop must be installed and running
- Node.js and npm installed

## ⚠️ IMPORTANT: Command Location

**ALL commands in this guide must be run from the `admin/` folder:**

```bash
cd /Users/mataldao/Local/tf-marcopolo/website/admin
```

## Quick Start

### 1. Navigate to Admin Folder

```bash
cd /Users/mataldao/Local/tf-marcopolo/website/admin
```

### 2. Start Local Supabase

```bash
npm run supabase:start
```

This will start all Supabase services locally:
- **API**: http://127.0.0.1:54321
- **Studio**: http://127.0.0.1:54323
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres

### 2. Switch to Local Environment

```bash
npm run env:local
```

This copies `.env.local` to `.env` so your app uses the local Supabase instance.

### 4. Run the Admin Panel

```bash
npm run dev:local
```

The admin panel will now connect to your local Supabase instance at http://localhost:5173

---

**Complete workflow in one go:**

```bash
cd /Users/mataldao/Local/tf-marcopolo/website/admin
npm run supabase:start
npm run env:local
npm run dev:local
```

## Local Supabase Credentials

These are the default credentials for local Supabase (already configured in `.env.local`):

- **API URL**: http://127.0.0.1:54321
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`
- **Database Password**: `postgres`

## Useful Commands

**Remember: Run these from `/Users/mataldao/Local/tf-marcopolo/website/admin`**

```bash
# Start local Supabase
npm run supabase:start

# Stop local Supabase
npm run supabase:stop

# Check Supabase status
npm run supabase:status

# Reset database (wipes all data and re-runs migrations)
npm run supabase:reset

# Switch environments
npm run env:local       # Local Supabase
npm run env:staging     # Staging Supabase
npm run env:production  # Production Supabase
```

## Accessing Supabase Studio

Once Supabase is running, open http://127.0.0.1:54323 to access Supabase Studio where you can:
- View and edit database tables
- Run SQL queries
- Manage authentication
- View logs
- Test API endpoints

## Database Migrations

Migrations are stored in `supabase/migrations/`. To apply migrations to your local database:

```bash
npm run supabase:reset
```

## Switching Between Environments

### Local Development
```bash
npm run env:local
npm run dev:local
```

### Staging
```bash
npm run env:staging
npm run dev:staging
```

### Production
```bash
npm run env:production
npm run dev:production
```

## Troubleshooting

### Docker not running
If you see "Cannot connect to the Docker daemon", make sure Docker Desktop is running.

### Port already in use
If ports are already allocated, stop the existing Supabase instance:
```bash
npm run supabase:stop
```

### Reset everything
To completely reset your local Supabase:
```bash
npm run supabase:stop
npm run supabase:start
npm run supabase:reset
```

## Notes

- Local Supabase data is ephemeral - it's reset when you stop/start
- Use `supabase:reset` to apply schema changes from migrations
- The local instance is completely isolated from staging and production

