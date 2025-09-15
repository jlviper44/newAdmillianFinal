# Scale Settings Module - Requirements & Todo List

## 📊 ROAS Dashboard
- [ ] Add dashboard for ROAS (Return on Ad Spend) tracking
- [ ] Display campaigns with their ROAS metrics
- [ ] Show real-time revenue vs ad spend calculations

## ⚙️ Configuration System
- [ ] Users set ROAS rate tied to sub ID
- [ ] Configurable ROAS thresholds per campaign
- [ ] Testing budget settings (no ROAS checks until budget hit)

## 🔄 Automatic Monitoring
- [ ] When VA inputs ad spend, system checks ROAS for sub ID
- [ ] If below threshold (e.g., <1.5), system flags as "Stop"
- [ ] Re-check revenue on that sub ID after 24 hours
- [ ] Automated notifications for ROAS threshold breaches

## 👥 Role-Based Views

### VA View
- [ ] Simple Yes/No on scale status
- [ ] Clear indicators:
  - **Testing**: spend < testing budget
  - **Yes**: ROAS ≥ Kill Rate
  - **No**: ROAS < Kill Rate

### Admin View
- [ ] Adjustable ROAS thresholds
- [ ] Global dashboard with:
  - All campaigns
  - Associated Sparks
  - VA activity tracking
  - SCALE status overview
- [ ] Budget management controls

## 💡 Example Settings
- **Kill Rate**: 1.5, 2, etc.
- **Testing Budget**: $10 (no ROAS checks until spend ≥ $10)