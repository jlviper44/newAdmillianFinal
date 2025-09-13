# TikTok Launch Tracker - Payroll System Import

## Overview
This document outlines the integration of the payroll and time tracking system from `launchesworker.js` into the main Admillian Dashboard's Ad Launches section.

## Current Status
The main dashboard already has the launch tracking functionality implemented. This import focuses on adding the missing payroll and time clock features.

## Features to Import

### 1. Time Clock System
**Purpose:** Allow VAs to record their daily work hours and verify against launch counts.

**Components:**
- Daily time entry form with hours worked
- Launch count verification
- Automatic cross-reference with actual launches
- Data storage for historical time entries

**Key Fields:**
- VA Name
- Date
- Hours Worked (0.5 hour increments)
- BCs Launched (for verification)

### 2. Payroll Calculator
**Purpose:** Calculate VA compensation based on hours worked and performance metrics.

**Calculation Formula:**
```
Total Pay = (Hours × Hourly Rate) + (Real Spend × Commission %) + Bonuses
```

**Default Rates:**
- Hourly Rate: $5/hour
- Commission: 3% of Real Spend

**Features:**
- Custom date range selection
- Configurable pay rates
- Bonus/adjustment capability
- Payment method tracking
- Notes and reason fields

### 3. Payroll History Management
**Purpose:** Track and manage all payroll reports with payment status.

**Capabilities:**
- View all historical payroll reports
- Filter by VA and payment status
- Mark reports as paid/unpaid
- Export individual reports to CSV
- Detailed report viewing modal

### 4. Automated Weekly Payroll
**Purpose:** Generate payroll reports automatically every Monday for the previous week.

**Schedule:** 
- Runs every Monday at 00:15 EST
- Processes all VAs with time entries
- Creates reports for Monday-Sunday period

## Database Schema Requirements

### Time Clock Entries
```javascript
{
  id: 'timeclock_[date]_[va]',
  va: string,
  date: string (YYYY-MM-DD),
  hoursWorked: number,
  bcsLaunched: number,
  timestamp: string (ISO),
  dayKey: string
}
```

### Payroll Reports
```javascript
{
  id: 'payroll_[timestamp]_[random]',
  va: string,
  period: { start: string, end: string },
  totalHours: number,
  totalRealSpend: number,
  hourlyRate: number,
  commissionRate: number,
  hourlyPay: number,
  commissionPay: number,
  bonusAmount: number,
  bonusReason: string,
  totalPay: number,
  status: 'paid' | 'unpaid',
  paymentMethod: string,
  notes: string,
  createdAt: string,
  updatedAt: string
}
```

## API Endpoints to Implement

### Time Clock
- `POST /api/timeclock` - Submit time clock entry
- `GET /api/timeclock?va={va}&date={date}` - Get time clock data with launch verification

### Payroll
- `GET /api/payroll?va={va}&startDate={date}&endDate={date}` - Calculate payroll for period
- `POST /api/payroll-report` - Create payroll report
- `GET /api/payroll-report?va={va}` - Get payroll reports (with optional filters)
- `PUT /api/payroll-report/{id}` - Update payroll report status
- `GET /api/payroll-report/export?va={va}&id={id}` - Export report to CSV
- `POST /api/generate-weekly-payroll` - Generate weekly reports for all VAs

## Implementation Steps

1. **Backend Setup**
   - Create database tables/KV namespaces for timeclock and payroll data
   - Implement API endpoints for all payroll operations
   - Set up automated weekly payroll generation task

2. **Frontend Integration**
   - Add Clock In/Out tab to Ad Launches section
   - Add Payroll Calculator tab with form inputs
   - Implement payroll history table with filtering
   - Create modal for detailed report viewing
   - Add CSV export functionality

3. **Data Integration**
   - Link time clock entries with launch data
   - Verify launch counts against time submissions
   - Calculate real spend from existing launch entries

4. **Testing Requirements**
   - Verify time clock submissions save correctly
   - Test payroll calculations with various scenarios
   - Confirm weekly automation runs properly
   - Validate CSV exports contain correct data
   - Test payment status updates

## Migration Considerations

- Preserve existing launch data structure
- Ensure backward compatibility with current features
- Consider timezone handling (EST) throughout
- Maintain data consistency between launches and payroll

## Security Notes

- Validate all VA inputs to prevent unauthorized time entries
- Implement proper access controls for payroll data
- Audit trail for payment status changes
- Secure storage of payment method information

## Success Criteria

- [ ] VAs can submit daily time clock entries
- [ ] Time entries are verified against actual launches
- [ ] Payroll calculations are accurate (hourly + commission + bonuses)
- [ ] Historical payroll reports are accessible and filterable
- [ ] Payment status can be tracked and updated
- [ ] Weekly payroll reports generate automatically
- [ ] All data exports correctly to CSV format
- [ ] System maintains data integrity across all operations

## Notes

The original implementation uses Cloudflare Workers with KV storage. The main dashboard implementation should adapt these patterns to the existing architecture while maintaining the same functionality and user experience.