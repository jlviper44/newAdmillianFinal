# Sparks Module - Requirements & Todo List

## 🐛 Bug Fixes
- [x] Fix bug with bulk adding functionality (spark code truncation in table view)
- [x] Fix bulk adding validation - auto-generate missing spark codes instead of showing error  
- [x] Make bulk add more flexible - allow mismatched counts of TikTok links and spark codes

## 💰 Payment & Commission System
- [x] Add commission section to payments interface
- [x] Implement default pay rate + commission section
- [x] Fix default rate - needs save button for persistence
- [x] Add commission calculation on top of base pay rate
- [x] Add save button for default rate changes (currently updates reactively without persistence)
- [x] Persist payment settings to database (rates, commissions)

## 📄 Invoice Management System
- [x] Create invoice section in the interface
- [x] Generate payment history for each Spark maker every Monday (automated)
- [x] Track Sparks made + base pay calculations
- [x] Save generated invoices with ability to edit
- [x] Mark invoices as: pending / paid / voided
- [x] Track payment method (checked/verified by owner)
- [x] Create payment history section
- [x] Create formal invoice generation system with PDF output
- [x] Automated Monday invoice generation for each Spark maker
- [x] Add invoice management features:
  - [x] Save invoices to database
  - [x] Allow invoice editing after generation (UI placeholder ready)
  - [x] Invoice status tracking (pending/paid/voided)
  - [x] Payment method tracking with owner verification
- [x] Link invoices to payment history

## 🤖 Botting Integration
- [ ] Allow botting directly from the sparks dashboard
- [ ] When submitting ads, add dropdown for automatic botting
- [ ] Add confirmation button after bot selection
- [ ] Add "botted" field to the sparks sheet/database
- [ ] Display botted status (Yes/No) in sparks list
- [ ] Track which sparks have been botted

## 📊 Enhanced Features
- [ ] Allow selecting multiple sparks for bulk operations
- [ ] Add "Comments Filtered" field (Yes/No)
- [ ] Implement Status field with automatic/manual setting:
  - Active / Blocked / Testing
  - Auto-set based on scale settings (future feature)
- [ ] Add ROAS (Return on Ad Spend) field:
  - Automatic or manual calculation (based on scale settings)
  - Manual entry options: 1.5, 2, or Good/Bad ratings
  - Allow custom ROAS values
- [ ] Ability to add custom fields to sparks data

## 🔧 UI/UX Improvements
- [ ] Improve bulk selection for sparks operations
- [ ] Add status management interface
- [ ] Create ROAS tracking dashboard
- [ ] Implement custom fields management UI