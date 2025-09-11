# Sparks Module - Todo List

## 🐛 Bug Fixes
- [x] Fix bulk adding validation - auto-generate missing spark codes instead of showing error
- [x] Make bulk add more flexible - allow mismatched counts of TikTok links and spark codes

## 💰 Payment & Commission System  
- [ ] Add commission calculation on top of base pay rate
- [ ] Add save button for default rate changes (currently updates reactively without persistence)
- [ ] Persist payment settings to database (rates, commissions)

## 📄 Invoice Management
- [ ] Create formal invoice generation system with PDF output
- [ ] Automated Monday invoice generation for each Spark maker
- [ ] Add invoice management features:
  - [ ] Save invoices to database
  - [ ] Allow invoice editing after generation
  - [ ] Invoice status tracking (pending/paid/voided)
  - [ ] Payment method tracking with owner verification
- [ ] Link invoices to payment history

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