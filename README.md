# Sparks Module - Todo List

## 🐛 Bug Fixes
- [x] Fix bulk adding validation - auto-generate missing spark codes instead of showing error
- [x] Make bulk add more flexible - allow mismatched counts of TikTok links and spark codes

## 💰 Payment & Commission System  
- [x] Add commission calculation on top of base pay rate
- [x] Add save button for default rate changes (currently updates reactively without persistence)
- [x] Persist payment settings to database (rates, commissions)

## 📄 Invoice Management
- [x] Create formal invoice generation system with PDF output
- [x] Automated Monday invoice generation for each Spark maker
- [x] Add invoice management features:
  - [x] Save invoices to database
  - [x] Allow invoice editing after generation (UI placeholder ready)
  - [x] Invoice status tracking (pending/paid/voided)
  - [x] Payment method tracking with owner verification
- [x] Link invoices to payment history

## 🤖 Botting Integration (New Feature)
- [ ] Add botting capability from sparks dashboard
- [ ] Implement auto-bot dropdown when submitting ads
- [ ] Add confirmation dialog for botting actions
- [ ] Add "botted" field to sparks database table
- [ ] Display botted status in sparks list (Yes/No)
- [ ] Track which sparks have been botted

## 🔧 Additional Features
- [ ] Add "Comments Filtered" field to sparks table (Yes/No)
- [ ] Display comments filtered status in UI
- [ ] Add bulk selection improvements for sparks operations