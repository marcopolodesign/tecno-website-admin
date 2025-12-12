-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add location_id to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Add location_id to coaches table
ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Add location_id to sellers table
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Enable Row Level Security on locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Create policies for locations (allow read for everyone, write for authenticated admins/sellers/coaches if needed)
-- For now, allowing all authenticated users to read
CREATE POLICY "Allow read access for authenticated users" ON locations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Verify creation
SELECT column_name, table_name 
FROM information_schema.columns 
WHERE table_name IN ('locations', 'users', 'coaches', 'sellers') 
AND column_name = 'location_id';
