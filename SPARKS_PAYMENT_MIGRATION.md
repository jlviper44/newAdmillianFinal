# Sparks Payment System Migration Plan

## Overview
Migrate from the current payment system to a new streamlined workflow that includes payment adjustments, payment methods, and automatic invoice generation.

## Current System
- Users create sparks
- Sparks appear in Payments tab grouped by creator
- Click "Mark as Paid" to move to Payment History
- Separate Invoices tab exists

## New System
1. Users continue to add and create sparks
2. Each user's sparks show up in Payments tab
3. Users can adjust payment amount, select payment method, and mark as paid/voided
4. On submit, entry moves to Payment History and generates invoice PDF
5. Remove Invoices tab (invoices accessible from Payment History)

---

## Migration Tasks

### Phase 1: Database Schema Updates

#### 1.1 Update Payment History Table
**File:** `server/features/sparks/payment-settings.service.js`

Add new columns to `payment_history` table:
```sql
ALTER TABLE payment_history ADD COLUMN payment_method TEXT DEFAULT 'Manual';
ALTER TABLE payment_history ADD COLUMN payment_status TEXT DEFAULT 'paid'; -- 'paid' or 'voided'
ALTER TABLE payment_history ADD COLUMN adjusted_amount REAL; -- NULL if not adjusted
ALTER TABLE payment_history ADD COLUMN invoice_url TEXT; -- Path to generated PDF
ALTER TABLE payment_history ADD COLUMN invoice_number TEXT; -- Auto-generated invoice number
```

#### 1.2 Update Initialization Function
Update `initializePaymentTables()` to include new columns in CREATE TABLE statement.

---

### Phase 2: Frontend - Payments Tab Updates

#### 2.1 Update Payment Summary Component
**File:** `src/views/Dashboard/components/Sparks/components/PaymentsTab.vue`

**Current Structure:**
```
Payment Summary by Creator
├── Creator Name
├── Video Count
├── Base Amount
├── Commission
├── Total
└── [Mark as Paid] button
```

**New Structure:**
```
Payment Summary by Creator
├── Creator Name
├── Video Count
├── Base Amount (auto-calculated)
├── Commission (auto-calculated)
├── Adjusted Amount (editable input) - defaults to calculated total
├── Payment Method (dropdown)
│   ├── Wise
│   ├── Crypto
│   ├── Wire
│   ├── Zelle
│   ├── Cash
│   ├── PayPal
│   └── Other
├── Payment Status (radio buttons)
│   ├── Mark as Paid
│   └── Mark as Voided
└── [Submit Payment] button
```

**Changes Required:**
1. Add input field for adjusted amount (with validation)
2. Add payment method dropdown
3. Add payment status radio buttons (paid/voided)
4. Change button from "Mark as Paid" to "Submit Payment"
5. Update styling to accommodate new fields

#### 2.2 Update Payment Submit Logic
**File:** `src/views/Dashboard/components/Sparks/SparksView.vue`

Update `markCreatorPaid()` function:
```javascript
const submitCreatorPayment = async (creatorName, paymentData) => {
  // paymentData structure:
  // {
  //   adjustedAmount: number,
  //   paymentMethod: string,
  //   paymentStatus: 'paid' | 'voided'
  // }

  // 1. Find all unpaid sparks for creator
  // 2. Calculate base amount and commission
  // 3. Use adjusted amount if provided, otherwise use calculated total
  // 4. Create payment record with new fields
  // 5. Call API to generate invoice PDF
  // 6. Update sparks payment_status
  // 7. Move to payment history
  // 8. Show success message with invoice download link
}
```

---

### Phase 3: Backend - Invoice Generation

#### 3.1 Create Invoice Generator Service
**New File:** `server/features/sparks/invoice-generator.service.js`

Functions to implement:
```javascript
// Generate unique invoice number (e.g., INV-2024-001)
export function generateInvoiceNumber(db, userId)

// Generate PDF invoice using a library (pdf-lib or pdfkit)
export async function generateInvoicePDF(paymentData, sparksList)

// Save PDF to storage (local or cloud)
export async function saveInvoicePDF(pdfBuffer, invoiceNumber, env)

// Main function called from payment submission
export async function createInvoice(db, env, paymentRecord, sparksList)
```

**Invoice PDF Structure:**
```
┌─────────────────────────────────────────┐
│  INVOICE                                │
│                                         │
│  Invoice #: INV-2024-001               │
│  Date: MM/DD/YYYY                      │
│  Payment Method: Wise                  │
│                                         │
│  Bill To:                              │
│  Creator Name: [creator@email.com]     │
│                                         │
│  Description          Qty    Amount    │
│  ─────────────────────────────────────  │
│  Video Content         2     $2.00     │
│  Commission                  $0.00     │
│                                         │
│  Subtotal:                   $2.00     │
│  Adjusted Amount:            $2.00     │
│                              ─────      │
│  Total:                      $2.00     │
│                                         │
│  Status: PAID / VOIDED                 │
│                                         │
│  Spark Details:                        │
│  - Spark Code 1                        │
│  - Spark Code 2                        │
└─────────────────────────────────────────┘
```

#### 3.2 Update Payment Recording Endpoint
**File:** `server/features/sparks/payment-settings.service.js`

Update `recordPayment()` function:
```javascript
export async function recordPayment(db, env, paymentData) {
  // 1. Validate payment data
  // 2. Generate invoice number
  // 3. Create invoice PDF
  // 4. Save PDF and get URL
  // 5. Insert into payment_history with new fields
  // 6. Return payment record with invoice URL
}
```

---

### Phase 4: Payment History Updates

#### 4.1 Update Payment History Display
**File:** `src/views/Dashboard/components/Sparks/components/PaymentHistoryTab.vue`

Add new columns to payment history table:
- Payment Method
- Adjusted Amount (show if different from calculated)
- Payment Status (Paid/Voided badge)
- Invoice (download button/link)

#### 4.2 Add Invoice Download Action
```javascript
const downloadInvoice = async (paymentId) => {
  // Fetch invoice URL from payment record
  // Trigger download or open in new tab
}
```

---

### Phase 5: Remove Invoices Tab

#### 5.1 Update SparksView Component
**File:** `src/views/Dashboard/components/Sparks/SparksView.vue`

1. Remove Invoices tab from navigation
2. Remove InvoicesTab component import and usage
3. Remove all invoice-related state variables
4. Remove invoice-related computed properties
5. Remove invoice-related methods

#### 5.2 Clean Up Files
**Files to remove or archive:**
- `src/views/Dashboard/components/Sparks/components/InvoicesTab.vue`
- Any invoice-specific API calls in services
- Invoice-specific backend routes (if separate from payments)

---

## Implementation Order

### Sprint 1: Database & Backend Foundation
1. ✅ Update database schema (payment_history table)
2. ✅ Update initialization functions
3. ✅ Create invoice generator service
4. ✅ Implement PDF generation
5. ✅ Update payment recording endpoint

### Sprint 2: Frontend Payment Form
1. ✅ Update PaymentsTab component UI
2. ✅ Add adjusted amount input
3. ✅ Add payment method dropdown
4. ✅ Add payment status radio buttons
5. ✅ Update submit button and handler

### Sprint 3: Payment History & Invoice Display
1. ✅ Update payment history table columns
2. ✅ Add invoice download functionality
3. ✅ Test invoice PDF generation
4. ✅ Add invoice preview modal (optional)

### Sprint 4: Clean Up & Testing
1. ✅ Remove Invoices tab
2. ✅ Clean up unused code
3. ✅ Update navigation
4. ✅ End-to-end testing
5. ✅ Update documentation

---

## Data Migration

### Existing Payment Records
```sql
-- Add default values to existing payment records
UPDATE payment_history
SET payment_method = 'Manual',
    payment_status = 'paid',
    adjusted_amount = total_amount
WHERE payment_method IS NULL;
```

### Existing Invoices
If there are existing invoices in a separate table:
1. Export existing invoice data
2. Link to payment history records
3. Archive old invoice table

---

## API Endpoints

### New Endpoints
```
POST   /api/sparks/submit-payment
  Body: {
    creatorName: string,
    adjustedAmount: number,
    paymentMethod: string,
    paymentStatus: 'paid' | 'voided',
    notes: string
  }
  Returns: {
    success: boolean,
    paymentId: string,
    invoiceUrl: string,
    invoiceNumber: string
  }

GET    /api/sparks/invoice/:invoiceNumber
  Returns: PDF file

GET    /api/sparks/payment-history/:paymentId/invoice
  Returns: PDF file or invoice URL
```

### Updated Endpoints
```
POST   /api/sparks/record-payment (UPDATE)
  - Add payment_method field
  - Add payment_status field
  - Add adjusted_amount field
  - Trigger invoice generation
```

---

## Testing Checklist

### Unit Tests
- [ ] Invoice number generation
- [ ] PDF generation with all fields
- [ ] Payment method validation
- [ ] Adjusted amount validation
- [ ] Payment status toggle

### Integration Tests
- [ ] Submit payment flow (happy path)
- [ ] Submit payment with adjustment
- [ ] Submit as voided
- [ ] Download invoice
- [ ] Payment history display
- [ ] Undo payment (if keeping this feature)

### E2E Tests
- [ ] Create sparks → view in payments → adjust & submit → verify in history
- [ ] Generate invoice → download PDF → verify content
- [ ] Mark as voided → verify status in history
- [ ] Test with different payment methods

---

## Rollback Plan

If issues arise:
1. Keep old code in separate branch
2. Database changes are additive (new columns), so old code still works
3. Feature flag to toggle between old and new payment flow
4. Can revert frontend changes without database rollback

---

## Dependencies

### NPM Packages to Add
```json
{
  "pdf-lib": "^1.17.1",        // PDF generation
  "pdfkit": "^0.13.0",          // Alternative PDF library
  "canvas": "^2.11.2"           // For PDF images/charts
}
```

### Environment Variables
```env
INVOICE_STORAGE_PATH=/invoices
INVOICE_URL_BASE=https://yourdomain.com/invoices
```

---

## Notes & Considerations

1. **Invoice Numbering:** Ensure uniqueness across all users
2. **PDF Storage:** Consider cloud storage (R2, S3) for production
3. **Invoice Editing:** Decide if invoices can be edited after generation
4. **Voided Payments:** Should voided payments still generate invoices?
5. **Email Notifications:** Consider sending invoice via email automatically
6. **Tax Calculations:** Add if needed for certain payment methods
7. **Currency Support:** Currently USD, expand if needed
8. **Audit Trail:** Log all payment modifications

---

## Timeline Estimate

- **Sprint 1 (Backend):** 3-4 days
- **Sprint 2 (Frontend):** 3-4 days
- **Sprint 3 (History/Invoice):** 2-3 days
- **Sprint 4 (Cleanup/Testing):** 2-3 days

**Total:** ~2-3 weeks

---

## Success Criteria

✅ Users can adjust payment amounts before submitting
✅ Users can select payment method from dropdown
✅ Users can mark payments as paid or voided
✅ Invoice PDF is automatically generated on submission
✅ Invoices are downloadable from Payment History
✅ Invoices tab is removed
✅ All existing functionality continues to work
✅ No data loss during migration
✅ System is more user-friendly than before