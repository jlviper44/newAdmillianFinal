# Ad Launches Module - Requirements & Todo List

## ✅ Completed Features

### 🗑️ Remove Features
- [x] Remove Launch Management tab
- [x] Remove unused AdLaunches Vue files (Test and Backup)

### ⏰ Clock In/Out System
- [x] Add Clock In/Out functionality for VAs with punch log system
- [x] Track multiple clock in/out sessions per day
- [x] Store clock in/out timestamps in EST
- [x] Display current clock status for each VA
- [x] State persistence across page refreshes (localStorage)
- [x] Allow manual time adjustments by admin
- [x] Show daily/weekly hour summaries
- [x] Today's summary updates in real-time
- [x] Punch log display with all daily sessions

### 💰 Payroll Section
- [x] Create dedicated payroll interface with 3 tabs:
  - Time Clock Tab (clock in/out, manual entries)
  - Payroll Calculator Tab (calculate and save reports)
  - Payroll History Tab (view and manage invoices)
- [x] Calculate base pay using Clock In/Out data (hourly rates)
- [x] Calculate commission based on ad spend (% of real spend)
- [x] Display calculation breakdown:
  - Hours worked × hourly rate = base pay
  - Ad spend × commission % = commission
  - Bonus amount (if any)
  - Total = base pay + commission + bonus
- [x] Integration with punch log system for automatic hour calculation
- [x] Dynamic VA list based on actual time entries

### 📊 Rate Management
- [x] Adjustable hourly rates per VA (in payroll form)
- [x] Adjustable commission rates per VA (in payroll form)
- [x] **Server-side rate storage ONLY** (va_rates table)
- [x] **Automatic rate saving** when modified (1 second debounce)
- [x] Apply correct rates based on work period
- [x] **NO localStorage backup** - server only
- [x] GET endpoint: `/api/va-rates/:va?date=...`
- [x] POST endpoint: `/api/va-rates` for saving rates

### 📄 Invoice Management
- [x] Save all generated payroll invoices (server-side only)
- [x] **Inline editing of invoices** (double-click to edit):
  - Edit hours, rates, ad spend directly in table
  - Status changes (unpaid/paid/voided) inline
  - Automatic recalculation of totals
  - Visual indicators for editable cells
- [x] Invoice status tracking:
  - Unpaid (orange) - default for new invoices
  - Paid (green) - with auto payment date
  - Voided (red) - cancels invoice
- [x] Track payment method and date
- [x] **Professional PDF invoice export** (like Sparks module)
- [x] Invoice history view with filtering options

### 📅 Date Range Features
- [x] Custom date range selector for payroll
- [x] Default to current 7-day period (Mon-Sun)
- [x] Quick date range buttons (This Week, Last Week, etc.)
- [x] Ensure all calculations use EST timezone
- [x] Generate reports for custom periods
- [x] Historical payroll data access

### 🔄 Data Management
- [x] **Clock in/out states ONLY use localStorage**
- [x] **Data pushes to server ONLY on clock out**
- [x] **Server-only storage** for payroll history
- [x] **No localStorage backups** for any other data (VA rates, etc.)
- [x] Error handling without breaking functionality
- [x] No 500 errors when backend unavailable

### 🔐 Access Control
- [x] **Role-based tab visibility**:
  - VAs can only see: Ad Launches, Time Clock
  - Admin/Original user can see all: Ad Launches, Time Clock, Payroll Calculator, Payroll History
- [x] Automatic detection of user role via `isVirtualAssistant` property

### 📊 Data Structure Updates
- [x] Fixed payroll report data structure for backend compatibility:
  - period: { start, end } format
  - totalRealSpend instead of totalAdSpend
  - Commission rate as decimal (0.03 for 3%)
- [x] Field name mapping (snake_case backend to camelCase frontend)

## 🚀 Recent Improvements
- [x] **Inline editing** - Double-click any cell to edit (no dialog needed)
- [x] **Status management** - Change invoice status inline with smart updates
- [x] **PDF generation** - Professional invoice PDFs with jsPDF
- [x] **Error prevention** - Smart server availability checking
- [x] **Visual feedback** - Hover effects and indicators for editable content

## 📝 Pending Features

### 🔗 Spark Integration
- [ ] Add Spark selector to Launch creation
- [ ] Choose Sparks from Sparks dashboard
- [ ] Link selected Sparks to each Launch
- [ ] Display linked Sparks in Launch details
- [ ] Track Spark performance per Launch

### 🔧 Custom Fields
- [ ] Ability to add custom fields to Launches
- [ ] Field types:
  - Text
  - Number
  - Date
  - Dropdown
  - Checkbox
- [ ] Save custom field data per Launch
- [ ] Display custom fields in Launch list/details
- [ ] Export custom field data

### 🎯 Additional Requirements
- [x] All time tracking in EST timezone ✅
- [ ] Automated Monday payroll processing (cron job exists but needs testing)
- [ ] Payroll approval workflow
- [x] Export payroll data to PDF ✅
- [ ] Email notifications for payroll generation
- [ ] Audit trail for all payroll changes

## 🐛 Known Issues (Fixed)
- [x] Clock state persistence after refresh ✅
- [x] Today's summary not updating ✅
- [x] VA rates API 404 error ✅
- [x] Payroll save 500 error handling ✅
- [x] Invoice data not displaying correctly ✅
- [x] Period showing as "-" in invoices ✅
- [x] Update invoice failures ✅

## 💡 Technical Notes
- **ONLY clock in/out states use localStorage** (no other data)
- **Data pushes to server ONLY on clock out** (not on clock in)
- Time tracking uses localStorage with email-based keys (@ and . replaced with _)
- Punch logs stored as arrays per day (local only until clock out)
- VA metadata stored separately for email reconstruction
- Payroll data must go to server (no local storage)
- VA rates must go to server (no local storage backup)
- Backend uses snake_case, frontend uses camelCase (automatic transformation)
- Commission rates stored as decimals (0.03 = 3%)