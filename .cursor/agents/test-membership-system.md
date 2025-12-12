# Membership System Testing Agent

## Purpose
Test the complete membership and payment tracking system, including user creation, lead conversion, renewals, and dashboard metrics.

## When to Run
- After any changes to membership, payment, or user-related code
- Before deploying to production
- When database schema changes
- Weekly automated testing

## Test Suite

### 1. Database Schema Validation
- [ ] Verify all tables exist: `membership_plans`, `memberships`, `payments`, `users`
- [ ] Check foreign key constraints are correct
- [ ] Verify RLS policies allow authenticated users to perform operations
- [ ] Test that `users.lead_id` correctly references `leads.id`
- [ ] Confirm `memberships.user_id` references `users.id`
- [ ] Confirm `payments.membership_id` references `memberships.id`

### 2. Membership Plans Management
- [ ] Navigate to admin → Membresías
- [ ] Verify all 4 plans are displayed (mensual, trimestral, semestral, anual)
- [ ] Test editing a plan price
- [ ] Test updating plan description
- [ ] Test toggling plan active/inactive status
- [ ] Verify changes persist after page reload

### 3. User Creation (Manual)
- [ ] Navigate to Users → Click "Crear Usuario"
- [ ] Fill all required fields:
  - firstName: "Test"
  - lastName: "User"
  - email: "test-{timestamp}@test.com"
  - phone: "+54 9 11 1234-5678"
  - trainingGoal: "perdida-peso"
  - membershipType: "mensual"
  - startDate: today
  - endDate: today + 30 days
- [ ] Check "Registrar pago"
- [ ] Select payment method: "efectivo"
- [ ] Leave amount empty (should use plan price)
- [ ] Add payment notes: "Test payment"
- [ ] Click "Crear Usuario"
- [ ] Verify success toast appears
- [ ] Verify user appears in users list
- [ ] Check Supabase tables:
  - `users` table has new record
  - `memberships` table has new record with `is_renewal = false`
  - `payments` table has new record with correct amount
  - `users.current_membership_id` points to the membership

### 4. Lead Conversion
- [ ] Create a test lead first (or use existing)
- [ ] Navigate to Leads → Select a lead
- [ ] Click "Convertir a Usuario"
- [ ] Fill membership info:
  - membershipType: "trimestral"
  - startDate: today
  - endDate: today + 90 days
  - emergencyContact: "Emergency Contact"
  - emergencyPhone: "+54 9 11 9876-5432"
- [ ] Fill payment info:
  - paymentMethod: "tarjeta"
  - amount: leave empty
  - notes: "Lead conversion payment"
- [ ] Click "Convertir a Usuario"
- [ ] Verify success alert
- [ ] Check Supabase tables:
  - `users` table has new record with `lead_id` set
  - `leads` table updated: `status = 'convertido'`, `converted_to_user = true`
  - `memberships` table has new record with `is_renewal = false`
  - `payments` table has new record with `is_renewal = false`
  - UTM parameters transferred from lead to user
- [ ] **CRITICAL**: Verify NO foreign key errors on `leads.user_id`

### 5. Membership Renewal
- [ ] Navigate to Users → Select a user with active membership
- [ ] Click user to open sidecart
- [ ] Click "Renovar Membresía" button
- [ ] Fill renewal form:
  - membershipType: "semestral"
  - startDate: current membership end_date + 1 day
  - endDate: start_date + 180 days
  - paymentMethod: "transferencia"
  - amount: leave empty
  - notes: "Renewal test"
- [ ] Click "Renovar Membresía"
- [ ] Verify success toast
- [ ] Check Supabase tables:
  - Old membership: `status = 'expired'`
  - New membership created with:
    * `is_renewal = true`
    * `previous_membership_id` points to old membership
    * `status = 'active'`
  - New payment created with `is_renewal = true`
  - `users.current_membership_id` updated to new membership
  - `users.membership_status = 'activo'`
  - `users.end_date` updated

### 6. Dashboard Metrics
- [ ] Navigate to Dashboard
- [ ] Verify "Ingresos del Mes" section displays
- [ ] Check "Ingresos Totales" shows sum of all payments this month
- [ ] Check "Clientes Nuevos" shows:
  - Revenue from payments with `is_renewal = false`
  - Count of new customers
- [ ] Check "Renovaciones" shows:
  - Revenue from payments with `is_renewal = true`
  - Count of renewals
- [ ] Verify "Ingresos por Tipo de Membresía" section shows breakdown
- [ ] Check each membership type (mensual, trimestral, etc.) displays:
  - Total revenue
  - Payment count
- [ ] If memberships expire in 30 days, verify alert shows

### 7. Edge Cases & Error Handling
- [ ] Try creating user without required fields → should show error
- [ ] Try converting lead without payment info → should show error
- [ ] Try renewing membership without dates → should show error
- [ ] Try creating user with duplicate email → should handle gracefully
- [ ] Test with very long names/notes → should truncate or handle
- [ ] Test with special characters in names → should sanitize
- [ ] Test with invalid phone formats → should validate
- [ ] Test with past dates for membership → should warn or prevent

### 8. Data Integrity Checks
Run these SQL queries in Supabase SQL Editor:

```sql
-- Check for orphaned memberships (no user)
SELECT * FROM memberships WHERE user_id NOT IN (SELECT id FROM users);

-- Check for orphaned payments (no membership)
SELECT * FROM payments WHERE membership_id NOT IN (SELECT id FROM memberships);

-- Check for users without current_membership_id
SELECT * FROM users WHERE current_membership_id IS NULL AND membership_status = 'activo';

-- Check for memberships without payments
SELECT m.* FROM memberships m
LEFT JOIN payments p ON m.id = p.membership_id
WHERE p.id IS NULL;

-- Verify is_renewal flag consistency
SELECT m.*, p.is_renewal 
FROM memberships m
JOIN payments p ON m.id = p.membership_id
WHERE m.is_renewal != p.is_renewal;

-- Check for broken renewal chains
SELECT * FROM memberships 
WHERE is_renewal = true 
AND previous_membership_id NOT IN (SELECT id FROM memberships);
```

### 9. Performance Tests
- [ ] Create 10 users rapidly → should handle without errors
- [ ] Load Dashboard with 100+ payments → should load in < 3 seconds
- [ ] Filter users by membership type → should be instant
- [ ] Search users by name → should be fast

### 10. RLS Policy Tests
- [ ] Log in as different user roles (admin, front_desk, coach)
- [ ] Verify each role can/cannot access:
  - Membership Plans tab (admin only)
  - Create users (admin, front_desk)
  - Renew memberships (admin, front_desk)
  - View payments (admin only)

## Automated Test Script

Create a test script that runs through all scenarios:

```javascript
// test-membership-system.js
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

async function runTests() {
  console.log('🧪 Starting Membership System Tests...\n')
  
  // Test 1: Check tables exist
  console.log('Test 1: Database Schema')
  const tables = ['membership_plans', 'memberships', 'payments']
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    console.log(`  ${error ? '❌' : '✅'} ${table} table`)
  }
  
  // Test 2: Check membership plans
  console.log('\nTest 2: Membership Plans')
  const { data: plans } = await supabase.from('membership_plans').select('*')
  console.log(`  ${plans.length === 4 ? '✅' : '❌'} Found ${plans.length} plans (expected 4)`)
  
  // Test 3: Create test user with membership
  console.log('\nTest 3: Create User with Membership')
  // ... implementation
  
  // Test 4: Test renewal
  console.log('\nTest 4: Membership Renewal')
  // ... implementation
  
  // Test 5: Check revenue stats
  console.log('\nTest 5: Revenue Metrics')
  // ... implementation
  
  console.log('\n✅ All tests completed!')
}

runTests()
```

## Expected Results
- All database operations should succeed without foreign key errors
- All payments should be linked to memberships
- All memberships should be linked to users
- Dashboard should show accurate revenue metrics
- New vs renewal tracking should be correct
- No orphaned records in any table

## Reporting
After running tests, report:
- ✅ Passed tests count
- ❌ Failed tests count
- 🐛 Bugs found with details
- 📊 Performance metrics
- 💡 Recommendations for improvements

## Action on Failure
If any test fails:
1. Log the exact error message
2. Identify the affected code/table
3. Create a fix
4. Re-run the test
5. Document the fix in commit message

