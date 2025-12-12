-- Add reason columns for tracking lost leads and non-renewals
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/buntxbgjixlksffbscle/sql

-- Add lost_reason column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- Add non_renewal_reason column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS non_renewal_reason TEXT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' AND column_name = 'lost_reason';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'non_renewal_reason';

