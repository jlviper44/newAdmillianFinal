-- Additional Advanced Analytics Schema for LinkSplitter
-- Based on LinkSplit.ts special features

-- ============================================
-- Activity Logging Tables
-- ============================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(255) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- project, group, user, team, link, auth, webhook, api_key, activity_log
  resource_id VARCHAR(255),
  resource_name VARCHAR(255),
  details TEXT, -- JSON
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_activity_timestamp (timestamp),
  INDEX idx_activity_user (user_id),
  INDEX idx_activity_resource (resource_type, resource_id),
  INDEX idx_activity_action (action)
);

-- ============================================
-- IP Reputation Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ip_reputation (
  ip_address VARCHAR(45) PRIMARY KEY,
  first_seen BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  clicks INTEGER DEFAULT 0,
  fraud_score INTEGER DEFAULT 0, -- 0-100
  is_blacklisted BOOLEAN DEFAULT 0,
  projects TEXT, -- JSON array of project IDs
  suspicious_activities INTEGER DEFAULT 0,
  blocked_attempts INTEGER DEFAULT 0,
  country_code VARCHAR(2),
  isp VARCHAR(255),
  is_vpn BOOLEAN DEFAULT 0,
  is_proxy BOOLEAN DEFAULT 0,
  is_hosting BOOLEAN DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_ip_fraud_score (fraud_score),
  INDEX idx_ip_blacklisted (is_blacklisted),
  INDEX idx_ip_last_seen (last_seen)
);

-- ============================================
-- Active Sessions Tables
-- ============================================

CREATE TABLE IF NOT EXISTS active_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255),
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  page_views INTEGER DEFAULT 1,
  duration INTEGER DEFAULT 0, -- seconds
  is_active BOOLEAN DEFAULT 1,
  
  INDEX idx_active_project (project_id),
  INDEX idx_active_last (last_activity),
  INDEX idx_active_user (user_id)
);

-- ============================================
-- Webhook Tables
-- ============================================

CREATE TABLE IF NOT EXISTS webhooks (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array of event types
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at BIGINT NOT NULL,
  last_triggered BIGINT,
  failure_count INTEGER DEFAULT 0,
  headers TEXT, -- JSON object of custom headers
  retry_policy TEXT, -- JSON object with retry configuration
  
  INDEX idx_webhook_active (is_active),
  INDEX idx_webhook_created (created_at)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  webhook_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload TEXT NOT NULL, -- JSON
  created_at BIGINT NOT NULL,
  attempts INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, delivered, retrying, failed
  last_attempt BIGINT,
  next_retry BIGINT,
  error_message TEXT,
  
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  INDEX idx_webhook_event_status (status),
  INDEX idx_webhook_event_created (created_at)
);

-- ============================================
-- Enhanced A/B Testing Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ab_test_sessions (
  id VARCHAR(255) PRIMARY KEY,
  test_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  visitor_id VARCHAR(255),
  
  -- Engagement metrics
  time_on_site INTEGER DEFAULT 0,
  pages_viewed INTEGER DEFAULT 0,
  bounce BOOLEAN DEFAULT 0,
  
  -- Conversion metrics
  converted BOOLEAN DEFAULT 0,
  conversion_value DECIMAL(10,2),
  conversion_time INTEGER, -- seconds from first exposure
  
  -- Revenue metrics
  revenue DECIMAL(10,2) DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE,
  INDEX idx_ab_session_test (test_id),
  INDEX idx_ab_session_variant (variant_id),
  INDEX idx_ab_session_created (created_at)
);

CREATE TABLE IF NOT EXISTS ab_test_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  calculation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Sample data
  visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  
  -- Conversion metrics
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Statistical metrics
  confidence_level DECIMAL(5,2) DEFAULT 0,
  p_value DECIMAL(10,8),
  z_score DECIMAL(10,4),
  standard_error DECIMAL(10,6),
  
  -- Lift metrics
  lift_percentage DECIMAL(10,2),
  lift_lower_bound DECIMAL(10,2),
  lift_upper_bound DECIMAL(10,2),
  
  -- Revenue metrics
  revenue_per_visitor DECIMAL(10,2),
  average_order_value DECIMAL(10,2),
  
  is_significant BOOLEAN DEFAULT 0,
  is_winner BOOLEAN DEFAULT 0,
  
  FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE,
  INDEX idx_ab_stats_test (test_id),
  INDEX idx_ab_stats_variant (variant_id),
  INDEX idx_ab_stats_time (calculation_time)
);

-- ============================================
-- Performance Monitoring Tables
-- ============================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Response time percentiles (milliseconds)
  p50_response_time INTEGER,
  p75_response_time INTEGER,
  p90_response_time INTEGER,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  
  -- Load time metrics
  avg_dns_lookup INTEGER,
  avg_tcp_connect INTEGER,
  avg_ssl_handshake INTEGER,
  avg_server_response INTEGER,
  avg_content_download INTEGER,
  avg_dom_processing INTEGER,
  avg_page_render INTEGER,
  
  -- Throughput metrics
  requests_per_second DECIMAL(10,2),
  bytes_per_second BIGINT,
  
  -- Error metrics
  error_rate DECIMAL(5,2),
  timeout_rate DECIMAL(5,2),
  
  -- Availability
  uptime_percentage DECIMAL(5,2),
  successful_requests INTEGER,
  failed_requests INTEGER,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE,
  INDEX idx_perf_project_time (project_id, timestamp)
);

-- ============================================
-- User Engagement Tracking Tables
-- ============================================

CREATE TABLE IF NOT EXISTS user_engagement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255),
  project_id VARCHAR(255),
  date DATE NOT NULL,
  
  -- Engagement metrics
  sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  unique_pages INTEGER DEFAULT 0,
  total_time_on_site INTEGER DEFAULT 0, -- seconds
  average_session_duration INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,2),
  
  -- Interaction metrics
  clicks INTEGER DEFAULT 0,
  scrolls INTEGER DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  video_plays INTEGER DEFAULT 0,
  file_downloads INTEGER DEFAULT 0,
  
  -- Conversion metrics
  goals_completed INTEGER DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_engagement_user (user_id),
  INDEX idx_engagement_project (project_id),
  INDEX idx_engagement_date (date)
);

-- ============================================
-- Quick Stats Cache Table
-- ============================================

CREATE TABLE IF NOT EXISTS quick_stats_cache (
  id VARCHAR(50) PRIMARY KEY, -- e.g., 'global', 'project:123'
  total_projects INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  today_clicks INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  top_countries TEXT, -- JSON
  top_referrers TEXT, -- JSON
  top_devices TEXT, -- JSON
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_stats_expires (expires_at)
);

-- ============================================
-- API Key Management Tables
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(255) PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed API key
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),
  
  -- Permissions
  scopes TEXT, -- JSON array of allowed scopes
  rate_limit INTEGER DEFAULT 1000, -- requests per hour
  
  -- Usage tracking
  last_used TIMESTAMP,
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_api_key_user (user_id),
  INDEX idx_api_key_project (project_id),
  INDEX idx_api_key_active (is_active)
);

CREATE TABLE IF NOT EXISTS api_key_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time INTEGER, -- milliseconds
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  INDEX idx_api_usage_key (api_key_id),
  INDEX idx_api_usage_time (timestamp)
);

-- ============================================
-- Advanced Targeting Rules Table
-- ============================================

CREATE TABLE IF NOT EXISTS targeting_rules (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- geo, device, time, referrer, utm, custom
  priority INTEGER DEFAULT 0,
  
  -- Rule configuration
  conditions TEXT NOT NULL, -- JSON object with rule conditions
  action VARCHAR(50) NOT NULL, -- redirect, block, flag
  action_value TEXT, -- URL for redirect, message for block, etc.
  
  -- Performance tracking
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  last_matched TIMESTAMP,
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE,
  INDEX idx_targeting_project (project_id),
  INDEX idx_targeting_active (is_active),
  INDEX idx_targeting_priority (priority)
);

-- ============================================
-- Conversion Funnel Tables
-- ============================================

CREATE TABLE IF NOT EXISTS conversion_funnels (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  steps TEXT NOT NULL, -- JSON array of funnel steps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE,
  INDEX idx_funnel_project (project_id)
);

CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funnel_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  step_index INTEGER NOT NULL,
  step_name VARCHAR(255),
  completed BOOLEAN DEFAULT 0,
  dropped BOOLEAN DEFAULT 0,
  time_to_complete INTEGER, -- seconds from previous step
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (funnel_id) REFERENCES conversion_funnels(id) ON DELETE CASCADE,
  INDEX idx_funnel_event_funnel (funnel_id),
  INDEX idx_funnel_event_session (session_id),
  INDEX idx_funnel_event_created (created_at)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_fraud_detection 
  ON analytics_events(project_id, fraud_score, is_bot, created_at);

CREATE INDEX IF NOT EXISTS idx_events_geo_analysis 
  ON analytics_events(project_id, country_code, city, created_at);

CREATE INDEX IF NOT EXISTS idx_events_utm_tracking 
  ON analytics_events(project_id, utm_source, utm_medium, utm_campaign, created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_active_tracking 
  ON analytics_sessions(project_id, has_converted, updated_at);

-- ============================================
-- Triggers for Auto-updates
-- ============================================

-- Auto-update timestamp triggers would be added here for SQLite
-- Since D1 is based on SQLite, we'll handle these in application code