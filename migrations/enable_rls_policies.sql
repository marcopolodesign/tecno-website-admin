-- Enable RLS on all tables
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow Read Access for all Authenticated Users (Staff)
CREATE POLICY "Allow read for staff" ON prospects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for staff" ON leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for staff" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for staff" ON sellers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for staff" ON coaches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for staff" ON locations FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Allow Insert/Update for Staff
-- (Refining this later to restrict who can delete)
CREATE POLICY "Allow write for staff" ON prospects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for staff" ON leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for staff" ON users FOR ALL USING (auth.role() = 'authenticated');

-- Restrict Sellers/Coaches table modification to Admins only (via Service Key usually bypasses this, 
-- but this allows app-level logic if we switch to user-token later)
-- For now, allowing authenticated writes to unblock creating users if using client keys
CREATE POLICY "Allow write for staff" ON sellers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for staff" ON coaches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for staff" ON locations FOR ALL USING (auth.role() = 'authenticated');
