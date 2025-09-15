# Example Workflow Documentation

## 🚀 Complete Campaign Workflow

### 1. Spark Selection
**VA Process:**
- VA chooses one or more Sparks from the Sparks dashboard
- Each Spark contains:
  - **Spark ID**: Unique identifier (not the name, used in tracking)
  - **Name**: Display name
  - **Description**: Spark details
  - **Pay tracking**: Associated payment information

### 2. Campaign Creation
**Campaign Setup:**
- VA creates a new Campaign
- System auto-creates a new **Launcher** section
  - Tied to the VA who launched the campaign
  - Tracks VA-specific metrics

**SubID Assignment (Automatic):**
- **subid1 = Campaign ID**
  - Can append custom info: `campaignid-custominfo`
- **subid2 = VA ID**
  - Each VA has unique ID (automatically logged)
- **subid3 = Spark ID**
  - Pulled from Sparks dashboard

**Example Generated Link:**
```
https://affiliatelink.com/asdlgkajs&s1=campid_custom&s2=VA123&s3=SPK45
```

### 3. Launch Setup
**Launch Configuration:**
- Launch references the Campaign and assigned Sparks
- VA enters ad spend amount
- System checks fluent data using s3 (Spark ID) to pull revenue

**ROAS Calculation Example:**
- Ad spend = $100
- Revenue = $200
- ROAS = 200 ÷ 100 = 2.0

### 4. ROAS Checking (Scale System)

**Manager Dashboard Controls:**
- **ROAS Kill Rate**: Set threshold (e.g., 1.5, 2.0)
- **Testing Budget**: Amount before ROAS checks begin (e.g., $10)

**VA Display (per Launch):**
SCALE field shows:
- **Testing** → spend < testing budget
- **Yes** → ROAS ≥ Kill Rate
- **No** → ROAS < Kill Rate

**Example Scenario:**
Manager Settings:
- Kill Rate = 2.0
- Testing Budget = $10

VA Actions & Results:
1. VA inputs spend = $5 → SCALE = **Testing**
2. VA inputs spend = $20, revenue = $30 → ROAS = 1.5 → SCALE = **No**
3. VA inputs spend = $50, revenue = $150 → ROAS = 3.0 → SCALE = **Yes**

### 5. Notifications & Monitoring

**Automated Alerts:**
- If ROAS falls below Kill Rate after testing budget → VA notified to turn ad off
- 24-hour re-check cycle for flagged campaigns

**Manager Global Dashboard:**
- All campaigns overview
- Associated Sparks per campaign
- VA activity tracking
- SCALE status for all launches
- Revenue/spend metrics
- Performance trends

## 📋 Quick Reference

### Status Indicators
| Status | Condition | Action Required |
|--------|-----------|-----------------|
| Testing | Spend < Testing Budget | Continue monitoring |
| Yes | ROAS ≥ Kill Rate | Scale/Continue |
| No | ROAS < Kill Rate | Stop/Optimize |

### SubID Mapping
| SubID | Purpose | Example |
|-------|---------|---------|
| s1 | Campaign ID | campid_custom |
| s2 | VA ID | VA123 |
| s3 | Spark ID | SPK45 |