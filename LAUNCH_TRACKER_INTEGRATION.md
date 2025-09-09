# Launch Tracker Integration Guide

## Overview
This document outlines the integration of launch tracking functionality from `launchesworker.js` into the existing `LaunchesView.vue` component. The integration adds comprehensive launch tracking, reporting, and analytics features while preserving all existing campaign launch management capabilities.

## Current Features (Preserved)
The existing LaunchesView.vue functionality that will be maintained:
- Campaign selection and management
- Launch link generation for Shopify stores
- Launch enable/disable toggles
- Campaign and Launch ID editing
- Test link generation
- Traffic tracking per launch
- Visual status indicators

## New Features to Add

### 1. Launch Entry Tracking
Track detailed information for each campaign launch:
- **VA Information**: Track which Virtual Assistant managed the launch
- **Campaign Details**: Campaign ID, BC GEO, BC Type
- **Targeting**: WH Objective (Sales, Video Views, etc.), Launch Target (US, UK, CAN, AUS)
- **Status Tracking**: Active, Banned, WH Ban, BH Ban, PF
- **Financial Metrics**: 
  - Ad Spend
  - BC Spend
  - Amount Lost (auto-calculated)
  - Real Spend (auto-calculated)
- **Offer Types**: Cash, Shein, Auto, CPI
- **Notes**: Additional context for each launch

### 2. Weekly Summary Dashboard
- Aggregated metrics by week (Monday-Sunday)
- Total entries, spend, and loss calculations
- Breakdown by status, geography, and offer type
- Week-over-week comparisons
- Historical data access

### 3. Data Management
- **Inline Editing**: Click any cell to edit
- **Real-time Calculations**: Automatic spend and loss calculations
- **Bulk Operations**: Filter and export multiple entries
- **Data Validation**: Input validation for all fields

### 4. Export Capabilities
- Export to CSV format
- Include all tracked fields
- Filter before export
- Weekly or custom date range exports

## Implementation Plan

### Phase 1: API Service Setup
Create `/src/services/launchTrackerAPI.js`:
```javascript
// Core endpoints
GET    /api/entries          // Fetch launch entries
POST   /api/entries          // Create new entry
PUT    /api/entries/:id      // Update entry
DELETE /api/entries/:id      // Delete entry
GET    /api/weekly-summary   // Get weekly summaries
GET    /api/export           // Export to CSV
```

### Phase 2: Component Structure
```
LaunchesView.vue
├── Existing Features Section
│   ├── Campaign Selector
│   ├── Launch Management
│   └── Link Generation
│
└── New Tracking Section
    ├── Entry Form
    ├── Entries Table
    ├── Summary Cards
    └── Export Controls
```

### Phase 3: Data Model
```javascript
// Launch Entry Model
{
  id: String,
  va: String,
  campaignId: String,
  bcGeo: String,
  bcType: String,
  whObj: String,
  launchTarget: String,
  status: String,
  ban: String,
  adSpend: Number,
  bcSpend: Number,
  amountLost: Number, // Calculated: bcSpend - adSpend
  realSpend: Number,  // Calculated: adSpend - amountLost
  offer: String,
  notes: String,
  timestamp: Date
}
```

## UI Components

### Entry Form
A card component with inputs for adding new launch entries:
- Compact form layout
- Dropdown selects for predefined values
- Auto-calculation of derived fields
- Clear validation feedback

### Entries Table
Comprehensive data table with:
- Sortable columns
- Inline editing
- Status badges with color coding
- Action buttons (edit, delete)
- Footer totals row

### Summary Cards
Visual metrics display:
- Total Entries
- Total Ad Spend
- Total BC Spend
- Total Amount Lost
- Total Real Spend

### Filters Section
- VA name search
- Status filter dropdown
- Offer type filter
- Date/week selector

## Styling Guidelines

### Color Scheme
- **Primary**: Purple (#A855F7) - matching existing theme
- **Success**: Green for active/positive states
- **Warning**: Orange for attention states
- **Error**: Red for banned/negative states
- **Info**: Blue for informational states

### Component Styling
```scss
// Status badge colors
.status-active { background: #d4edda; color: #155724; }
.status-banned { background: #f8d7da; color: #721c24; }
.status-wh-ban { background: #fff3cd; color: #856404; }
.status-bh-ban { background: #cce5ff; color: #004085; }
.status-pf { background: #e2e3e5; color: #383d41; }
```

## Integration Steps

### Step 1: Backend Setup
1. Set up API endpoints for launch tracking
2. Configure database/storage for entries
3. Implement week-based data organization

### Step 2: Frontend Integration
1. Add tracking section to LaunchesView.vue
2. Import and configure API service
3. Add state management for tracked entries
4. Implement UI components

### Step 3: Testing
1. Test existing functionality remains intact
2. Verify new tracking features
3. Test data calculations
4. Validate export functionality

### Step 4: Deployment
1. Deploy backend changes
2. Deploy frontend updates
3. Migrate any existing data
4. Monitor for issues

## Technical Considerations

### Performance
- Implement pagination for large datasets
- Use virtual scrolling for tables with many rows
- Cache weekly summaries
- Debounce inline editing saves

### Data Persistence
- Store data by week for efficient retrieval
- Implement data archiving for old entries
- Regular backups of tracking data

### Validation Rules
- Campaign ID: Required, must match existing campaign
- VA Name: Required, non-empty string
- Spend fields: Non-negative numbers
- Status: Must be from predefined list
- Dates: Valid date format

## Migration Notes

### From Cloudflare Worker to Vue App
The original implementation uses Cloudflare Workers with KV storage. Migration involves:
1. Converting KV storage operations to API calls
2. Adapting HTML interface to Vue components
3. Maintaining data structure compatibility
4. Preserving calculation logic

### Data Compatibility
- Maintain same field names for easy migration
- Support import of existing CSV exports
- Preserve timestamp formats
- Keep calculation formulas consistent

## Testing Checklist

- [ ] Campaign selection works
- [ ] Launch link generation functions
- [ ] New entry form validates correctly
- [ ] Inline editing saves properly
- [ ] Calculations update in real-time
- [ ] Filters apply correctly
- [ ] Week navigation works
- [ ] Export generates valid CSV
- [ ] Status badges display correctly
- [ ] Dark mode styling works
- [ ] Mobile responsive layout
- [ ] Error states handled gracefully

## Future Enhancements

### Phase 2 Features (Not in current scope)
- Time clock functionality for VAs
- Payroll calculation system
- Automated weekly reports
- Advanced analytics dashboard
- Bulk import from CSV
- Data visualization charts
- VA performance metrics
- Campaign ROI analysis

## Support & Documentation

### Component Props
```javascript
// No props - component is self-contained
// Uses internal state and API calls
```

### Events Emitted
```javascript
// Potential events for parent components
this.$emit('entry-added', entry)
this.$emit('entry-updated', entry)
this.$emit('entry-deleted', id)
this.$emit('week-changed', weekKey)
```

### Dependencies
- Vue 3
- Vuetify 3
- Campaign API service
- Launch Tracker API service (new)

## Conclusion
This integration enhances the LaunchesView component with comprehensive tracking capabilities while maintaining full backward compatibility with existing features. The modular approach allows for future expansion without disrupting current functionality.