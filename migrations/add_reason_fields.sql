-- Add lost_reason field to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- Add non_renewal_reason field to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS non_renewal_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN leads.lost_reason IS 'Reason why the lead was marked as lost/perdido';
COMMENT ON COLUMN users.non_renewal_reason IS 'Reason why the user is not renewing their membership';
