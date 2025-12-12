-- Add location and age columns to coaches table
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add coach_id to users table for the relationship
ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES coaches(id);

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'coaches' AND column_name IN ('location', 'age');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'coach_id';
