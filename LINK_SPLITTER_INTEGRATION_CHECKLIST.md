# Link Splitter Integration Checklist

## Overview
Direct code merge of the link-splitter functionality into the Dashboard monolithic application (no separate Worker deployment).

## Quick Summary
The link-splitter from `/Users/jlee/Downloads/Transfer` will be integrated directly into the Dashboard by:
1. **Converting Worker code to Express.js** - Port all functions to Node.js/Express
2. **Using SQLite instead of KV/Durable Objects** - Store all data in campaigns.db
3. **Integrating with existing auth** - Use Dashboard's current authentication
4. **Building Vue components** - Create UI within existing Dashboard structure
5. **No separate deployment** - Everything runs within the monolithic app

## Key Changes from Original Implementation
- **No Cloudflare Workers** - Runs on Express server
- **No KV Storage** - Uses SQLite database
- **No Durable Objects** - Analytics stored in database
- **IP Geolocation** - Use geoip-lite instead of Cloudflare
- **Session Management** - Use existing Dashboard sessions

---

## Phase 1: Backend Code Integration

### Code Migration from Worker to Express
- [ ] Create new module in server/Dashboard/LinkSplitter/
- [ ] Port core logic from Transfer/src/index.ts
  - [ ] Extract targeting functions (checkTargetingMatch, evaluateTargeting)
  - [ ] Extract weight distribution logic (getBestMatch, normalizeWeights)
  - [ ] Extract fraud detection (detectBot, calculateFraudScore)
  - [ ] Extract analytics functions
- [ ] Convert Worker-specific code to Express/Node.js
  - [ ] Replace Request/Response objects with Express req/res
  - [ ] Replace env.LINKS_CONFIG KV calls with SQL queries
  - [ ] Replace Durable Objects with database-based analytics
  - [ ] Replace CF location data with IP geolocation library
- [ ] Remove Worker-specific dependencies
  - [ ] Remove Cloudflare Workers types
  - [ ] Remove wrangler configuration

### Database Schema Creation
- [ ] Create link_splitter tables in campaigns.db
  ```sql
  -- Groups table
  CREATE TABLE link_groups (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Projects table  
  CREATE TABLE link_projects (
    id VARCHAR(255) PRIMARY KEY,
    group_id VARCHAR(255),
    team_id VARCHAR(255),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    main_url TEXT,
    custom_alias VARCHAR(255) UNIQUE,
    safe_link TEXT,
    items JSON, -- Array of split URLs with weights/targeting
    targeting JSON, -- Global targeting rules
    fraud_protection JSON, -- Fraud settings
    ab_testing JSON, -- A/B test configuration
    pixel_settings JSON, -- Tracking pixels
    expires_at TIMESTAMP,
    clicks_limit INTEGER,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES link_groups(id) ON DELETE CASCADE
  );
  
  -- Real-time analytics table
  CREATE TABLE link_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id VARCHAR(255),
    session_id VARCHAR(255),
    ip_address VARCHAR(255),
    user_agent TEXT,
    referrer TEXT,
    country VARCHAR(10),
    city VARCHAR(255),
    device_type VARCHAR(50),
    clicked_url TEXT,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    fraud_score INTEGER,
    is_bot BOOLEAN DEFAULT 0,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
  );
  
  -- Aggregated analytics for performance
  CREATE TABLE link_analytics_hourly (
    project_id VARCHAR(255),
    hour_timestamp TIMESTAMP,
    total_clicks INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    bot_clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    PRIMARY KEY (project_id, hour_timestamp),
    FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
  );
  
  -- Create indexes for performance
  CREATE INDEX idx_projects_alias ON link_projects(custom_alias);
  CREATE INDEX idx_clicks_project ON link_clicks(project_id, clicked_at);
  CREATE INDEX idx_clicks_session ON link_clicks(session_id);
  CREATE INDEX idx_analytics_hourly ON link_analytics_hourly(project_id, hour_timestamp);
  ```

---

## Phase 2: Backend API Implementation

### Create LinkSplitter Module
- [ ] Create server/Dashboard/LinkSplitter/LinkSplitter.js
- [ ] Port core functions from Transfer/src/index.ts:
  ```javascript
  // Core utility functions to port
  - detectDevice(userAgent)
  - calculateFraudScore(req, ip, userAgent)
  - detectBot(userAgent)
  - checkTargetingMatch(rule, req, geoData)
  - evaluateTargeting(rules, req, geoData)
  - getBestMatch(items, req, geoData, safeLink, globalTargeting)
  - normalizeWeights(items)
  - generateSessionId(req)
  - generateShortId()
  ```

### API Endpoints Implementation
- [ ] Implement Express routes in LinkSplitter.js:
  ```javascript
  // Redirect handler (highest priority)
  router.get('/:shortLink', handleRedirect);
  
  // Groups Management
  router.get('/api/link-splitter/groups', getGroups);
  router.post('/api/link-splitter/groups', createGroup);
  router.put('/api/link-splitter/groups/:id', updateGroup);
  router.delete('/api/link-splitter/groups/:id', deleteGroup);
  
  // Projects Management  
  router.get('/api/link-splitter/projects', getProjects);
  router.post('/api/link-splitter/projects', createProject);
  router.get('/api/link-splitter/projects/:id', getProject);
  router.put('/api/link-splitter/projects/:id', updateProject);
  router.delete('/api/link-splitter/projects/:id', deleteProject);
  router.post('/api/link-splitter/projects/:id/duplicate', duplicateProject);
  
  // Analytics
  router.get('/api/link-splitter/analytics/:projectId', getAnalytics);
  router.get('/api/link-splitter/analytics/:projectId/realtime', getRealtimeAnalytics);
  router.get('/api/link-splitter/analytics/:projectId/export', exportAnalytics);
  
  // Testing & Validation
  router.post('/api/link-splitter/test-link', testLink);
  router.post('/api/link-splitter/validate-url', validateUrl);
  router.post('/api/link-splitter/check-alias', checkAliasAvailability);
  ```

### Dependencies Installation
- [ ] Install required npm packages:
  ```bash
  npm install geoip-lite  # For IP geolocation
  npm install ua-parser-js  # For user agent parsing
  npm install crypto  # For hash generation
  npm install node-cache  # For in-memory caching
  ```

### Authentication & Authorization
- [ ] Use existing auth middleware from server/Auth/Auth.js
- [ ] Add permission checks for link-splitter features
- [ ] Implement user_id association for all projects/groups
- [ ] Add team-based access control using existing teams structure

---

## Phase 3: Frontend Integration

### Vue Components Creation
- [ ] Create new views in src/views/Dashboard/
  ```
  LinkSplitter/
  ├── LinkSplitter.vue (main component)
  └── components/
      ├── GroupsManager.vue
      ├── ProjectsList.vue
      ├── ProjectEditor.vue
      ├── LinkBuilder.vue
      ├── TargetingRules.vue
      ├── ABTestingPanel.vue
      ├── Analytics.vue
      ├── FraudProtection.vue
      └── PixelSettings.vue
  ```

### Router Configuration
- [ ] Add routes to src/router/router.js:
  ```javascript
  {
    path: '/dashboard/link-splitter',
    name: 'LinkSplitter',
    component: () => import('@/views/Dashboard/LinkSplitter/LinkSplitter.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard/link-splitter/project/:id',
    name: 'LinkSplitterProject',
    component: () => import('@/views/Dashboard/LinkSplitter/components/ProjectEditor.vue'),
    meta: { requiresAuth: true }
  }
  ```

### API Service Integration
- [ ] Create src/services/linkSplitterAPI.js
- [ ] Implement API client methods for all endpoints
- [ ] Add error handling and retry logic

### State Management
- [ ] Create Pinia store for link-splitter state
- [ ] Implement caching for projects and groups
- [ ] Add real-time updates for analytics

---

## Phase 4: Feature Implementation

### Core Features
- [ ] **Link Management**
  - [ ] Create/Edit/Delete split links
  - [ ] Weight distribution UI
  - [ ] Auto-weight calculation
  - [ ] Bulk link import/export

- [ ] **Targeting System**
  - [ ] Geo-targeting interface
  - [ ] Device detection settings
  - [ ] Time-based rules builder
  - [ ] UTM parameter handling
  - [ ] Custom targeting rules

- [ ] **Analytics Dashboard**
  - [ ] Real-time visitor tracking
  - [ ] Click statistics charts
  - [ ] Geographic heat maps
  - [ ] Device breakdown charts
  - [ ] Conversion tracking

- [ ] **A/B Testing**
  - [ ] Test creation wizard
  - [ ] Statistical significance calculator
  - [ ] Results visualization
  - [ ] Winner declaration system

### Advanced Features
- [ ] **Fraud Protection**
  - [ ] Bot detection settings
  - [ ] Rate limiting configuration
  - [ ] Suspicious activity alerts
  - [ ] IP blocking rules

- [ ] **Pixel Integration**
  - [ ] TikTok Pixel setup
  - [ ] Facebook Pixel configuration
  - [ ] Google Analytics integration
  - [ ] Custom pixel support

- [ ] **Team Collaboration**
  - [ ] Share projects with team members
  - [ ] Permission levels per project
  - [ ] Activity logs
  - [ ] Comments system

---

## Phase 5: UI/UX Integration

### Design Consistency
- [ ] Apply existing Dashboard theme to new components
- [ ] Use current color scheme and typography
- [ ] Maintain consistent spacing and layout
- [ ] Integrate with existing navigation

### Component Updates
- [ ] Add Link Splitter to main navigation menu
- [ ] Create dashboard widget for quick stats
- [ ] Add to user profile settings
- [ ] Include in team workspace views

### Mobile Responsiveness
- [ ] Test all views on mobile devices
- [ ] Optimize touch interactions
- [ ] Ensure readable analytics on small screens
- [ ] Mobile-friendly link editor

---

## Phase 6: Testing & Quality Assurance

### Unit Testing
- [ ] Write tests for all API endpoints
- [ ] Test link splitting algorithm
- [ ] Validate targeting rules logic
- [ ] Test weight distribution calculations

### Integration Testing
- [ ] Test Worker-to-Database sync
- [ ] Validate authentication flow
- [ ] Test team permissions
- [ ] Verify analytics accuracy

### Performance Testing
- [ ] Load test link redirection
- [ ] Benchmark analytics processing
- [ ] Test KV storage limits
- [ ] Optimize database queries

### Security Testing
- [ ] Penetration testing on endpoints
- [ ] Validate input sanitization
- [ ] Test for XSS vulnerabilities
- [ ] Verify CORS configuration

---

## Phase 7: Deployment

### Pre-Deployment Checklist
- [ ] Run database migrations on production
- [ ] Test all API endpoints locally
- [ ] Verify authentication flow
- [ ] Check redirect performance

### Deployment Steps
1. [ ] Backup production database
2. [ ] Deploy backend changes
3. [ ] Run database migrations
4. [ ] Deploy frontend updates
5. [ ] Test core functionality

### Post-Deployment Verification
- [ ] Test link creation and editing
- [ ] Verify redirect functionality
- [ ] Check analytics tracking
- [ ] Monitor error logs

---

## Phase 8: Documentation & Training

### Technical Documentation
- [ ] API documentation
- [ ] Database schema docs
- [ ] Worker configuration guide
- [ ] Troubleshooting guide

### User Documentation
- [ ] Create user manual
- [ ] Record video tutorials
- [ ] Write FAQ section
- [ ] Create quick-start guide

### Team Training
- [ ] Train support team
- [ ] Create internal wiki
- [ ] Set up monitoring alerts
- [ ] Establish support procedures

---

## Phase 9: Monitoring & Optimization

### Monitoring Setup
- [ ] Configure Cloudflare Analytics
- [ ] Set up error tracking (Sentry)
- [ ] Create performance dashboards
- [ ] Implement uptime monitoring

### Performance Optimization
- [ ] Optimize Worker cold starts
- [ ] Implement caching strategies
- [ ] Database query optimization
- [ ] Frontend bundle optimization

### Cost Optimization
- [ ] Monitor Cloudflare Workers usage
- [ ] Optimize KV operations
- [ ] Review Durable Objects usage
- [ ] Implement usage quotas

---

## Phase 10: Post-Launch

### Feedback Collection
- [ ] User feedback surveys
- [ ] Analytics review
- [ ] Performance metrics analysis
- [ ] Bug tracking setup

### Iteration Planning
- [ ] Prioritize feature requests
- [ ] Plan performance improvements
- [ ] Schedule regular updates
- [ ] Create roadmap for v2

### Success Metrics
- [ ] Define KPIs
- [ ] Set up tracking
- [ ] Create reporting dashboards
- [ ] Schedule review meetings

---

## Notes

### Priority Considerations
1. **High Priority**: Core link splitting, basic analytics, authentication
2. **Medium Priority**: A/B testing, fraud protection, team features
3. **Low Priority**: Advanced pixel tracking, webhook support, API keys

### Risk Mitigation
- Keep original link-splitter running during migration
- Implement feature flags for gradual rollout
- Maintain backward compatibility
- Create comprehensive backup strategy

### Timeline Estimate
- Phase 1 (Backend Code Integration): 2-3 days
- Phase 2 (Backend API): 2-3 days
- Phase 3 (Frontend Components): 3-4 days
- Phase 4 (Feature Implementation): 1 week
- Phase 5 (UI/UX Polish): 2-3 days
- Phase 6 (Testing): 2-3 days
- Phase 7 (Deployment): 1 day
- Phase 8-10 (Documentation, Monitoring, Post-Launch): Ongoing

**Total estimated time: 3-4 weeks for MVP integration**

### Simplified MVP Approach (1-2 weeks)
Focus on core functionality first:
1. Basic link creation and management
2. Simple weight-based splitting
3. Click tracking and basic analytics
4. Redirect functionality

Add advanced features later:
- Targeting rules
- A/B testing
- Fraud protection
- Pixel tracking

---

## Checklist Sign-off

- [ ] Technical Lead Approval
- [ ] Security Review Complete
- [ ] QA Sign-off
- [ ] Documentation Complete
- [ ] Production Ready