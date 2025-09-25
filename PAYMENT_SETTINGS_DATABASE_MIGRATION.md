# Payment Settings Database Migration Plan

## Overview
Migrate payment settings from localStorage to a proper database table to support automated processes and production deployment.

## Database Schema

### Create `payment_settings` Table

```sql
CREATE TABLE IF NOT EXISTS payment_settings (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    setting_type TEXT NOT NULL, -- 'default' or 'creator'
    creator_email TEXT, -- NULL for default settings, email for creator-specific settings
    rate_per_video DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    commission_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    commission_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(setting_type, creator_email),
    CHECK(setting_type IN ('default', 'creator')),
    CHECK(commission_type IN ('percentage', 'fixed')),
    CHECK(rate_per_video >= 0),
    CHECK(commission_rate >= 0)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_settings_creator ON payment_settings(creator_email);
CREATE INDEX IF NOT EXISTS idx_payment_settings_type ON payment_settings(setting_type);
```

### Insert Default Settings

```sql
INSERT OR IGNORE INTO payment_settings (setting_type, creator_email, rate_per_video, commission_rate, commission_type)
VALUES ('default', NULL, 1.00, 0.00, 'percentage');
```

## Backend Implementation

### 1. Database Migration Script
- **File**: `server/database/migrations/add_payment_settings_table.js`
- **Purpose**: Create the table structure and insert default settings

### 2. API Routes
- **File**: `server/routes/payment-settings.routes.js`
- **Endpoints**:
  - `GET /api/payment-settings` - Get all payment settings (default + creator-specific)
  - `PUT /api/payment-settings/default` - Update default settings
  - `PUT /api/payment-settings/creator/:email` - Update creator-specific settings
  - `DELETE /api/payment-settings/creator/:email` - Remove creator-specific settings

### 3. Database Service
- **File**: `server/services/payment-settings.service.js`
- **Functions**:
  - `getPaymentSettings()`
  - `updateDefaultSettings(settings)`
  - `updateCreatorSettings(email, settings)`
  - `deleteCreatorSettings(email)`
  - `getSettingsForCreator(email)` - Gets creator settings or falls back to default

### 4. Controller
- **File**: `server/controllers/payment-settings.controller.js`
- **Handles**: Request validation, error handling, and response formatting

## Frontend Updates

### 1. Update API Service
- **File**: `src/services/api.js`
- **Add**: Payment settings endpoints

### 2. Update usePayments Composable
- **File**: `src/views/Dashboard/components/NewSparks/components/Payments/composables/usePayments.js`
- **Changes**:
  - Replace localStorage calls with API calls
  - Add proper loading states
  - Add error handling for network failures
  - Keep reactive state for UI responsiveness

### 3. Migration Strategy
- **Phase 1**: Keep localStorage as fallback while implementing database
- **Phase 2**: Add database reads/writes alongside localStorage
- **Phase 3**: Remove localStorage dependency once database is stable

## Implementation Steps

### Step 1: Database Setup ✅ TODO
1. Create migration script
2. Run migration on development database
3. Test table creation and constraints

### Step 2: Backend API ✅ TODO
1. Create service layer for database operations
2. Implement API routes with proper validation
3. Add error handling and logging
4. Test all CRUD operations

### Step 3: Frontend Integration ✅ TODO
1. Update API service with new endpoints
2. Modify usePayments composable to use API
3. Add loading states and error handling
4. Test UI responsiveness during API calls

### Step 4: Migration & Testing ✅ TODO
1. Create data migration utility (localStorage → database)
2. Test automated payment calculation with database settings
3. Verify settings persistence across server restarts
4. Performance testing with multiple creators

### Step 5: Production Deployment ✅ TODO
1. Run database migration on production
2. Deploy updated backend and frontend
3. Monitor for any issues
4. Remove localStorage fallback code

## Data Structure Examples

### Default Settings
```json
{
  "id": "abc123",
  "setting_type": "default",
  "creator_email": null,
  "rate_per_video": 1.00,
  "commission_rate": 0.00,
  "commission_type": "percentage"
}
```

### Creator-Specific Settings
```json
{
  "id": "def456",
  "setting_type": "creator",
  "creator_email": "justin.m.lee.dev@gmail.com",
  "rate_per_video": 2.00,
  "commission_rate": 5.00,
  "commission_type": "percentage"
}
```

## API Response Format

### GET /api/payment-settings
```json
{
  "success": true,
  "data": {
    "default": {
      "rate_per_video": 1.00,
      "commission_rate": 0.00,
      "commission_type": "percentage"
    },
    "creators": {
      "justin.m.lee.dev@gmail.com": {
        "rate_per_video": 2.00,
        "commission_rate": 5.00,
        "commission_type": "percentage"
      }
    }
  }
}
```

## Benefits of Database Migration

1. **Automated Processes**: Cron jobs can access payment settings directly from database
2. **Data Persistence**: Settings survive browser cache clears and server restarts
3. **Multi-User Support**: Different users can have different default settings
4. **Audit Trail**: Track when settings were changed and by whom
5. **Backup & Recovery**: Settings are included in database backups
6. **Scalability**: No browser storage limitations
7. **Security**: Server-side validation and access control

## Migration Checklist

- [ ] Create database table and indexes
- [ ] Implement backend service layer
- [ ] Create API routes with validation
- [ ] Add error handling and logging
- [ ] Update frontend API service
- [ ] Modify usePayments composable
- [ ] Add loading states to UI
- [ ] Create localStorage → database migration utility
- [ ] Test automated payment calculations
- [ ] Verify settings persistence
- [ ] Deploy to production
- [ ] Monitor and verify functionality
- [ ] **CRITICAL: Remove ALL localStorage code and clear existing localStorage**
- [ ] Add localStorage cleanup function to remove old data from users' browsers

## Timeline Estimate
- **Database Setup**: 1-2 hours
- **Backend Implementation**: 3-4 hours
- **Frontend Updates**: 2-3 hours
- **Testing & Migration**: 2-3 hours
- **Total**: 8-12 hours

## localStorage Cleanup Strategy

### 1. Identify All localStorage Usage
Current localStorage keys used:
- `va_payment_settings` - Main payment settings storage

### 2. Cleanup Implementation
**File**: `src/views/Dashboard/components/NewSparks/components/Payments/composables/usePayments.js`

Add cleanup function:
```javascript
// Function to clean up old localStorage data
const cleanupLocalStorage = () => {
  try {
    console.log('Cleaning up old payment settings from localStorage...');
    localStorage.removeItem('va_payment_settings');
    console.log('localStorage cleanup completed');
  } catch (error) {
    console.error('Error cleaning up localStorage:', error);
  }
};

// Call cleanup on first load after migration
const performOneTimeCleanup = () => {
  const cleanupDone = localStorage.getItem('payment_settings_cleanup_done');
  if (!cleanupDone) {
    cleanupLocalStorage();
    localStorage.setItem('payment_settings_cleanup_done', 'true');
  }
};
```

### 3. Remove All localStorage Code
**Files to Update**:
- Remove `loadPaymentSettings()` function
- Remove `localStorage.setItem()` calls in `savePaymentSettings()`
- Remove all localStorage references and fallback logic
- Replace with API calls only

### 4. Code Removal Checklist
- [ ] Remove `loadPaymentSettings()` function
- [ ] Remove localStorage.setItem in `savePaymentSettings()`
- [ ] Remove localStorage.getItem calls
- [ ] Remove `paymentSettingsLoaded` state (no longer needed)
- [ ] Add cleanup function call in component mount
- [ ] Update initialization to use API only
- [ ] Remove localStorage error handling

### 5. Final Verification
- [ ] Search codebase for any remaining `localStorage` references
- [ ] Test that settings persist only in database
- [ ] Verify automated processes work without localStorage
- [ ] Confirm browser localStorage is clean after migration

This migration will make the payment settings system production-ready and enable reliable automated payment calculations with NO localStorage dependency.