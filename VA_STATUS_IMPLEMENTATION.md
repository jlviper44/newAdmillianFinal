# VA Status & Automated Weekly Payment System Implementation Plan

## Overview
This document outlines the implementation of a VA Status tab that tracks weekly spark creation, automatically calculates payments every Monday at 9am EST, and generates PDFs and invoice entries upon payment completion.

## 1. VA Status Tab Implementation

### 1.1 Frontend Components

#### Create VA Status Tab Component
**File**: `src/views/Dashboard/components/NewSparks/components/VAStatus/VAStatusTab.vue`

**Features**:
- Weekly spark creation tracking per VA
- Date range selector (current week, previous weeks)
- Visual charts/graphs showing productivity
- Summary cards showing:
  - Total sparks this week
  - Total sparks last week
  - Week-over-week change
  - Average per day
- Table showing daily breakdown per VA
- **Early Report Generation**:
  - "Generate Early Report" button for current week
  - "Generate Report for Date Range" with custom date picker
  - Confirmation dialog showing calculated amounts
  - Option to generate for all VAs or selected VAs only

#### Create VA Status Composable
**File**: `src/views/Dashboard/components/NewSparks/components/VAStatus/composables/useVAStatus.js`

**Functions**:
```javascript
- getWeeklySparksByVA(startDate, endDate)
- getCurrentWeekSparks()
- getPreviousWeekSparks()
- getVAProductivityStats()
- getWeeklyComparison()
- generateEarlyReport(startDate, endDate, vaList)
- previewEarlyReport(startDate, endDate, vaList)
- checkExistingReports(startDate, endDate)
```

### 1.2 Data Structure

#### Weekly VA Stats Schema
```javascript
{
  va_email: "va@example.com",
  week_start: "2024-01-01",
  week_end: "2024-01-07",
  sparks_created: 25,
  daily_breakdown: {
    "monday": 5,
    "tuesday": 4,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 2,
    "sunday": 2
  },
  total_earnings: 125.00, // sparks_created * rate
  status: "pending" | "calculated" | "paid" | "voided",
  generation_type: "automatic" | "early" | "custom",
  generated_by: "system" | "user@example.com",
  generated_at: "2024-01-08T09:00:00Z"
}
```

## 2. Early Report Generation System

### 2.1 Frontend Implementation

#### Early Report Generation Modal
**File**: `src/views/Dashboard/components/NewSparks/components/VAStatus/components/EarlyReportModal.vue`

**Features**:
- Date range picker with validation
- VA selection (all VAs or specific ones)
- Preview table showing calculated amounts
- Conflict detection (if reports already exist)
- Confirmation step before generation

#### Early Report Preview Component
```vue
<template>
  <v-dialog v-model="showModal" max-width="900">
    <v-card>
      <v-card-title>Generate Early Payment Report</v-card-title>
      <v-card-text>
        <!-- Date Range Selection -->
        <v-row>
          <v-col cols="6">
            <v-date-picker v-model="dateRange.start" label="Start Date" />
          </v-col>
          <v-col cols="6">
            <v-date-picker v-model="dateRange.end" label="End Date" />
          </v-col>
        </v-row>

        <!-- VA Selection -->
        <v-select
          v-model="selectedVAs"
          :items="availableVAs"
          label="Select VAs (leave empty for all)"
          multiple
          chips
        />

        <!-- Preview Button -->
        <v-btn @click="previewReport" color="info" class="mb-4">
          Preview Report
        </v-btn>

        <!-- Preview Table -->
        <v-data-table
          v-if="previewData.length > 0"
          :headers="previewHeaders"
          :items="previewData"
          density="compact"
        >
          <template v-slot:item.amount="{ item }">
            ${{ item.amount.toFixed(2) }}
          </template>
        </v-data-table>

        <!-- Conflict Warning -->
        <v-alert
          v-if="hasConflicts"
          type="warning"
          class="mt-4"
        >
          Some VAs already have reports for this period. Generating will create duplicate entries.
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="closeModal">Cancel</v-btn>
        <v-btn
          @click="generateReport"
          color="primary"
          :disabled="previewData.length === 0"
          :loading="isGenerating"
        >
          Generate Report ({{ previewData.length }} VAs)
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
```

### 2.2 Backend API Endpoints

#### Early Report Generation Endpoint
**File**: `server/routes/va-reports.routes.js`

**Endpoints**:
```javascript
// Preview early report
POST /api/va-reports/preview
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-07",
  "vaEmails": ["va1@example.com", "va2@example.com"] // optional
}

// Generate early report
POST /api/va-reports/generate-early
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-07",
  "vaEmails": ["va1@example.com"],
  "generatedBy": "admin@example.com"
}

// Check for existing reports
GET /api/va-reports/check-conflicts?start=2024-01-01&end=2024-01-07&vas=va1,va2
```

#### Early Report Service
**File**: `server/services/early-report.service.js`

```javascript
async function generateEarlyReport(startDate, endDate, vaEmails, generatedBy) {
  try {
    const vas = vaEmails || await getAllActiveVAs();
    const reports = [];

    for (const vaEmail of vas) {
      // Check for existing reports
      const existingReport = await checkExistingReport(vaEmail, startDate, endDate);
      if (existingReport) {
        console.warn(`Report already exists for ${vaEmail} in period ${startDate} - ${endDate}`);
      }

      // Calculate sparks and earnings
      const sparks = await getSparksCreatedByVA(vaEmail, startDate, endDate);
      const vaRate = await getVARate(vaEmail);
      const earnings = sparks.length * vaRate;

      // Create payment entry
      const paymentEntry = await createPaymentEntry({
        va_email: vaEmail,
        period_start: startDate,
        period_end: endDate,
        sparks_count: sparks.length,
        amount: earnings,
        status: 'pending',
        type: 'early_va_payment',
        generated_by: generatedBy,
        generation_type: 'early'
      });

      reports.push({
        vaEmail,
        sparksCount: sparks.length,
        earnings,
        paymentId: paymentEntry.id
      });
    }

    return { success: true, reports, generatedAt: new Date().toISOString() };
  } catch (error) {
    console.error('Early report generation failed:', error);
    throw error;
  }
}

async function previewEarlyReport(startDate, endDate, vaEmails) {
  try {
    const vas = vaEmails || await getAllActiveVAs();
    const preview = [];

    for (const vaEmail of vas) {
      const sparks = await getSparksCreatedByVA(vaEmail, startDate, endDate);
      const vaRate = await getVARate(vaEmail);
      const earnings = sparks.length * vaRate;

      // Check if report already exists
      const existingReport = await checkExistingReport(vaEmail, startDate, endDate);

      preview.push({
        vaEmail,
        sparksCount: sparks.length,
        rate: vaRate,
        earnings,
        hasExistingReport: !!existingReport,
        sparkIds: sparks.map(s => s.id)
      });
    }

    return preview;
  } catch (error) {
    console.error('Preview generation failed:', error);
    throw error;
  }
}
```

## 3. Automated Weekly Payment Calculation

### 2.1 Backend Cron Job Implementation

#### Server-side Cron Job
**File**: `server/jobs/weekly-payment-calculator.js`

**Schedule**: Every Monday at 9:00 AM EST
**Cron Expression**: `0 9 * * 1` (with timezone handling)

**Logic**:
1. Calculate previous week's date range (Monday-Sunday)
2. Query sparks created by each VA in that period
3. Calculate earnings based on VA rates
4. Create payment entries in payments system
5. Update VA status records
6. Send notifications (optional)

```javascript
async function calculateWeeklyPayments() {
  const lastWeek = getPreviousWeekRange();
  const vas = await getActiveVAs();

  for (const va of vas) {
    const sparks = await getSparksCreatedByVA(va.email, lastWeek);
    const earnings = sparks.length * va.rate;

    await createPaymentEntry({
      va_email: va.email,
      period_start: lastWeek.start,
      period_end: lastWeek.end,
      sparks_count: sparks.length,
      amount: earnings,
      status: 'pending',
      type: 'weekly_va_payment'
    });
  }
}
```

### 2.2 Database Schema Updates

#### Add VA Weekly Stats Table
```sql
CREATE TABLE va_weekly_stats (
  id TEXT PRIMARY KEY,
  va_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  sparks_created INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Add Weekly Payment Type to Payments
```sql
-- Add new column to existing payments table
ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'manual';
ALTER TABLE payments ADD COLUMN week_start DATE;
ALTER TABLE payments ADD COLUMN week_end DATE;
ALTER TABLE payments ADD COLUMN sparks_count INTEGER;
```

## 3. Enhanced Payments Tab Integration

### 3.1 Payment Entry Structure for Weekly Payments

```javascript
{
  id: "weekly_payment_001",
  va_email: "va@example.com",
  payment_type: "weekly_va_payment" | "early_va_payment",
  week_start: "2024-01-01",
  week_end: "2024-01-07",
  sparks_count: 25,
  calculated_amount: 125.00,
  final_amount: 125.00, // editable
  status: "pending" | "paid" | "voided",
  created_at: "2024-01-08T09:00:00Z",
  paid_at: null,
  invoice_id: null,
  pdf_path: null
}
```

### 3.2 Update Payments Tab to Handle Weekly Payments

**Features to Add**:
- Filter by payment type (manual vs weekly vs early)
- Show week range for weekly payments
- Display spark count in addition to amount
- Special handling for weekly payment workflows
- **Early Payment Indicators**:
  - Badge/chip showing "Early Payment" for early reports
  - Show generation date and who generated it
  - Display date range instead of standard week ranges
  - Special styling for early payments vs automatic weekly payments

## 4. PDF Generation System

### 4.1 PDF Template for VA Payments

**File**: `server/templates/va-payment-invoice.html`

**Template Contents**:
- Company header
- Invoice number and date
- VA details (name, email)
- Payment period (week range)
- Breakdown:
  - Number of sparks created
  - Rate per spark
  - Total amount
- Payment status
- Terms and conditions

### 4.2 PDF Generation Service

**File**: `server/services/pdf-generator.service.js`

**Dependencies**:
- `puppeteer` for PDF generation
- `handlebars` for template rendering

```javascript
async function generateVAPaymentPDF(paymentData) {
  const template = await loadTemplate('va-payment-invoice.html');
  const html = compileTemplate(template, paymentData);

  const pdf = await generatePDF(html, {
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm' }
  });

  const filename = `VA_Payment_${paymentData.va_email}_${paymentData.week_start}.pdf`;
  const filePath = await savePDF(pdf, filename);

  return { filename, filePath };
}
```

## 5. Invoices Tab Integration

### 5.1 Invoice Entry Creation

When a payment is marked as paid, automatically create an invoice entry:

```javascript
async function createInvoiceFromPayment(paymentData) {
  const invoice = {
    id: generateInvoiceId(),
    type: 'va_payment',
    va_email: paymentData.va_email,
    amount: paymentData.final_amount,
    period_start: paymentData.week_start,
    period_end: paymentData.week_end,
    sparks_count: paymentData.sparks_count,
    pdf_path: paymentData.pdf_path,
    status: 'completed',
    created_at: new Date().toISOString()
  };

  await saveInvoice(invoice);
  return invoice;
}
```

### 5.2 Update Invoices Tab

**File**: `src/views/Dashboard/components/NewSparks/components/Invoices/InvoicesTab.vue`

**New Features**:
- Display VA payment invoices
- Show week range and spark count
- Download PDF functionality
- Filter by invoice type

## 6. Implementation Steps

### Phase 1: VA Status Tab (Week 1-2)
1. ✅ Create VAStatusTab.vue component
2. ✅ Implement useVAStatus composable
3. ✅ Add weekly tracking queries
4. ✅ Create data visualization components
5. ✅ Add to main navigation
6. ✅ **Add Early Report Generation Modal**
7. ✅ **Implement report preview functionality**
8. ✅ **Add conflict detection for existing reports**

### Phase 2: Automated Payment System (Week 2-3)
1. ✅ Set up database schema updates
2. ✅ Create weekly payment calculator cron job
3. ✅ Implement payment entry creation
4. ✅ Add timezone handling for EST
5. ✅ Test automation system
6. ✅ **Implement early report generation API endpoints**
7. ✅ **Add conflict detection and duplicate prevention**
8. ✅ **Create manual report generation service**

### Phase 3: Enhanced Payments Integration (Week 3-4)
1. ✅ Update payments tab for weekly payments
2. ✅ Modify payment editing for weekly entries
3. ✅ Add week range display
4. ✅ Implement payment workflow
5. ✅ **Add early payment filtering and indicators**
6. ✅ **Show generation metadata (who/when generated)**
7. ✅ **Implement custom date range display for early payments**

### Phase 4: PDF & Invoice System (Week 4-5)
1. ✅ Set up PDF generation service
2. ✅ Create invoice templates
3. ✅ Implement PDF creation on payment
4. ✅ Update invoices tab
5. ✅ Add download functionality

### Phase 5: Testing & Deployment (Week 5-6)
1. ✅ End-to-end testing
2. ✅ Performance optimization
3. ✅ Error handling
4. ✅ Documentation
5. ✅ Production deployment

## 7. Technical Requirements

### 7.1 New Dependencies
```json
{
  "puppeteer": "^21.0.0",
  "handlebars": "^4.7.8",
  "node-cron": "^3.0.2",
  "moment-timezone": "^0.5.43"
}
```

### 7.2 Environment Variables
```env
PDF_STORAGE_PATH=/app/storage/pdfs
INVOICE_TEMPLATE_PATH=/app/templates
EST_TIMEZONE=America/New_York
WEEKLY_PAYMENT_ENABLED=true
```

### 7.3 File Structure
```
src/views/Dashboard/components/NewSparks/
├── components/
│   ├── VAStatus/
│   │   ├── VAStatusTab.vue
│   │   ├── components/
│   │   │   ├── WeeklyChart.vue
│   │   │   ├── ProductivityStats.vue
│   │   │   └── VABreakdown.vue
│   │   └── composables/
│   │       └── useVAStatus.js
│   ├── Payments/ (enhanced)
│   └── Invoices/ (enhanced)

server/
├── jobs/
│   └── weekly-payment-calculator.js
├── services/
│   ├── pdf-generator.service.js
│   └── invoice.service.js
└── templates/
    └── va-payment-invoice.html
```

## 8. Success Metrics

### 8.1 Functional Requirements
- ✅ VA Status tab shows accurate weekly data
- ✅ Automated payments run every Monday 9am EST
- ✅ PDFs generate correctly for all payments
- ✅ Invoice entries are created automatically
- ✅ All payment actions (edit, pay, void) work properly

### 8.2 Performance Requirements
- ✅ VA Status loads within 2 seconds
- ✅ PDF generation completes within 10 seconds
- ✅ Weekly calculation completes within 5 minutes
- ✅ System handles 100+ VAs efficiently

### 8.3 User Experience Requirements
- ✅ Intuitive navigation between tabs
- ✅ Clear visual feedback on all actions
- ✅ Easy-to-understand payment breakdown
- ✅ Simple PDF download process

## 9. Risk Mitigation

### 9.1 Potential Issues
- **Timezone complications**: Use moment-timezone for consistent EST handling
- **PDF generation failures**: Implement retry logic and fallback templates
- **Cron job failures**: Add monitoring and manual trigger capability
- **Database performance**: Index weekly stats table properly

### 9.2 Backup Plans
- **Manual calculation**: Provide UI to manually trigger weekly calculations
- **PDF alternatives**: Allow manual PDF upload if generation fails
- **Data recovery**: Keep detailed logs of all automated processes

## 10. Early Payment User Workflow

### 10.1 VA Status Tab Workflow
1. **View Current Week**: VA Status tab shows current week's progress
2. **Generate Early Report**: Click "Generate Early Report" button
3. **Select Parameters**:
   - Choose date range (default: Monday to current day)
   - Select specific VAs or leave empty for all
   - Preview calculations before generation
4. **Review Preview**: See calculated amounts and potential conflicts
5. **Generate Report**: Create payment entries in Payments tab
6. **Navigate to Payments**: Automatic redirect or notification

### 10.2 Payment Processing Workflow
1. **View Early Payments**: Filter payments by "Early" type
2. **Review Calculations**: See spark count and earnings breakdown
3. **Edit Amount** (if needed): Modify payout amount
4. **Mark as Paid**: Process payment
5. **PDF Generation**: Automatic PDF creation
6. **Invoice Creation**: Entry added to Invoices tab

### 10.3 Benefits of Early Payment System
- **VA Flexibility**: VAs can request early payment for urgent needs
- **Admin Control**: Full oversight of when and how much to pay
- **Audit Trail**: Track who generated reports and when
- **Conflict Prevention**: System warns about duplicate reports
- **Customizable Periods**: Not limited to Monday-Sunday weeks

### 10.4 Example Use Cases

#### Use Case 1: Mid-Week Payment Request
- **Scenario**: VA needs payment on Wednesday for urgent expense
- **Action**: Admin generates early report for Monday-Wednesday
- **Result**: VA gets paid for 3 days of work, automatic report prevents paying twice on Monday

#### Use Case 2: Custom Date Range Payment
- **Scenario**: VA worked irregular schedule, need payment for specific dates
- **Action**: Admin selects custom date range (e.g., Dec 20-Dec 28)
- **Result**: Payment calculated for exact period, properly documented

#### Use Case 3: Partial Week Payment
- **Scenario**: New VA started mid-week, needs immediate payment
- **Action**: Generate early report from start date to current date
- **Result**: Fair payment for actual work period, integrated with regular payroll

## 11. Future Enhancements

### 10.1 Potential Improvements
- **Dashboard widgets**: Add VA status summary to main dashboard
- **Email notifications**: Send payment notifications to VAs
- **Mobile optimization**: Ensure mobile-friendly interfaces
- **Advanced reporting**: Add monthly/quarterly reports
- **Integration APIs**: Allow external systems to access payment data

This implementation plan provides a comprehensive roadmap for building the VA Status system with automated weekly payments, PDF generation, and invoice management.