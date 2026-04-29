# Home Organizer AI - Promo Codes

## Usage
Each code unlocks the AI Analysis add-on and can only be used **once**.
Distribute to friends, family, beta testers, or influencers.

## Create Database Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    tier TEXT DEFAULT 'premium',
    active BOOLEAN DEFAULT true,
    used_by UUID REFERENCES auth.users(id),
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
```

## Insert All 100 Promo Codes

```sql
INSERT INTO promo_codes (code, tier, active) VALUES
-- Friends & Family (25 codes)
('FRIEND-2024-001', 'premium', true),
('FRIEND-2024-002', 'premium', true),
('FRIEND-2024-003', 'premium', true),
('FRIEND-2024-004', 'premium', true),
('FRIEND-2024-005', 'premium', true),
('FRIEND-2024-006', 'premium', true),
('FRIEND-2024-007', 'premium', true),
('FRIEND-2024-008', 'premium', true),
('FRIEND-2024-009', 'premium', true),
('FRIEND-2024-010', 'premium', true),
('FRIEND-2024-011', 'premium', true),
('FRIEND-2024-012', 'premium', true),
('FRIEND-2024-013', 'premium', true),
('FRIEND-2024-014', 'premium', true),
('FRIEND-2024-015', 'premium', true),
('FRIEND-2024-016', 'premium', true),
('FRIEND-2024-017', 'premium', true),
('FRIEND-2024-018', 'premium', true),
('FRIEND-2024-019', 'premium', true),
('FRIEND-2024-020', 'premium', true),
('FRIEND-2024-021', 'premium', true),
('FRIEND-2024-022', 'premium', true),
('FRIEND-2024-023', 'premium', true),
('FRIEND-2024-024', 'premium', true),
('FRIEND-2024-025', 'premium', true),

-- Beta Testers (25 codes)
('BETA-2024-001', 'premium', true),
('BETA-2024-002', 'premium', true),
('BETA-2024-003', 'premium', true),
('BETA-2024-004', 'premium', true),
('BETA-2024-005', 'premium', true),
('BETA-2024-006', 'premium', true),
('BETA-2024-007', 'premium', true),
('BETA-2024-008', 'premium', true),
('BETA-2024-009', 'premium', true),
('BETA-2024-010', 'premium', true),
('BETA-2024-011', 'premium', true),
('BETA-2024-012', 'premium', true),
('BETA-2024-013', 'premium', true),
('BETA-2024-014', 'premium', true),
('BETA-2024-015', 'premium', true),
('BETA-2024-016', 'premium', true),
('BETA-2024-017', 'premium', true),
('BETA-2024-018', 'premium', true),
('BETA-2024-019', 'premium', true),
('BETA-2024-020', 'premium', true),
('BETA-2024-021', 'premium', true),
('BETA-2024-022', 'premium', true),
('BETA-2024-023', 'premium', true),
('BETA-2024-024', 'premium', true),
('BETA-2024-025', 'premium', true),

-- VIP/Influencer (25 codes)
('VIP-2024-001', 'premium', true),
('VIP-2024-002', 'premium', true),
('VIP-2024-003', 'premium', true),
('VIP-2024-004', 'premium', true),
('VIP-2024-005', 'premium', true),
('VIP-2024-006', 'premium', true),
('VIP-2024-007', 'premium', true),
('VIP-2024-008', 'premium', true),
('VIP-2024-009', 'premium', true),
('VIP-2024-010', 'premium', true),
('VIP-2024-011', 'premium', true),
('VIP-2024-012', 'premium', true),
('VIP-2024-013', 'premium', true),
('VIP-2024-014', 'premium', true),
('VIP-2024-015', 'premium', true),
('VIP-2024-016', 'premium', true),
('VIP-2024-017', 'premium', true),
('VIP-2024-018', 'premium', true),
('VIP-2024-019', 'premium', true),
('VIP-2024-020', 'premium', true),
('VIP-2024-021', 'premium', true),
('VIP-2024-022', 'premium', true),
('VIP-2024-023', 'premium', true),
('VIP-2024-024', 'premium', true),
('VIP-2024-025', 'premium', true),

-- Reserve/Emergency (25 codes)
('RESERVE-2024-001', 'premium', true),
('RESERVE-2024-002', 'premium', true),
('RESERVE-2024-003', 'premium', true),
('RESERVE-2024-004', 'premium', true),
('RESERVE-2024-005', 'premium', true),
('RESERVE-2024-006', 'premium', true),
('RESERVE-2024-007', 'premium', true),
('RESERVE-2024-008', 'premium', true),
('RESERVE-2024-009', 'premium', true),
('RESERVE-2024-010', 'premium', true),
('RESERVE-2024-011', 'premium', true),
('RESERVE-2024-012', 'premium', true),
('RESERVE-2024-013', 'premium', true),
('RESERVE-2024-014', 'premium', true),
('RESERVE-2024-015', 'premium', true),
('RESERVE-2024-016', 'premium', true),
('RESERVE-2024-017', 'premium', true),
('RESERVE-2024-018', 'premium', true),
('RESERVE-2024-019', 'premium', true),
('RESERVE-2024-020', 'premium', true),
('RESERVE-2024-021', 'premium', true),
('RESERVE-2024-022', 'premium', true),
('RESERVE-2024-023', 'premium', true),
('RESERVE-2024-024', 'premium', true),
('RESERVE-2024-025', 'premium', true);
```

## Admin Query - Check Used Codes

```sql
-- View all used codes
SELECT code, used_by, used_at 
FROM promo_codes 
WHERE used_at IS NOT NULL 
ORDER BY used_at DESC;

-- View remaining available codes
SELECT code 
FROM promo_codes 
WHERE used_at IS NULL AND active = true;

-- Count usage
SELECT 
    COUNT(*) as total_codes,
    COUNT(used_at) as used_codes,
    COUNT(*) - COUNT(used_at) as remaining_codes
FROM promo_codes;
```

## Quick Reference List

### Give these to friends & family:
```
FRIEND-2024-001 through FRIEND-2024-025
```

### Give these to beta testers:
```
BETA-2024-001 through BETA-2024-025
```

### Give these to influencers/giveaways:
```
VIP-2024-001 through VIP-2024-025
```

### Keep these in reserve:
```
RESERVE-2024-001 through RESERVE-2024-025
```

## How It Works

1. User opens app and tries to use AI analysis
2. Sees "AI Analysis Locked" modal
3. Enters promo code in the field
4. Code is validated against database
5. If valid and unused: AI access granted permanently
6. Code is marked as used (can't be reused)

## Cost for 100 Free Users

- **AI Analysis**: ~$46/year (if all use 10/day)
- **Storage**: ~$5/year
- **Total**: ~$51/year for 100 free users

Much cheaper than losing potential paying customers from lack of reviews/testing.
