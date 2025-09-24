-- Additional Advanced Analytics Schema for LinkSplitter
-- Based on LinkSplit.ts special features
-- Fixed for SQLite/D1 compatibility

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
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  resource_name VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);

-- ============================================
-- IP Reputation Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ip_reputation (
  ip_address VARCHAR(45) PRIMARY KEY,
  first_seen BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  clicks INTEGER DEFAULT 0,
  fraud_score INTEGER DEFAULT 0,
  is_blacklisted BOOLEAN DEFAULT 0,
  projects TEXT,
  suspicious_activities INTEGER DEFAULT 0,
  blocked_attempts INTEGER DEFAULT 0,
  country_code VARCHAR(2),
  isp VARCHAR(255),
  is_vpn BOOLEAN DEFAULT 0,
  is_proxy BOOLEAN DEFAULT 0,
  is_hosting BOOLEAN DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_fraud_score ON ip_reputation(fraud_score);
CREATE INDEX IF NOT EXISTS idx_ip_blacklisted ON ip_reputation(is_blacklisted);
CREATE INDEX IF NOT EXISTS idx_ip_last_seen ON ip_reputation(last_seen);

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
  duration INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_active_project ON active_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_active_last ON active_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_active_user ON active_sessions(user_id);

-- ============================================
-- Webhook Tables
-- ============================================

CREATE TABLE IF NOT EXISTS webhooks (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at BIGINT NOT NULL,
  last_triggered BIGINT,
  failure_count INTEGER DEFAULT 0,
  headers TEXT,
  retry_policy TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_active ON webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_created ON webhooks(created_at);

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  webhook_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  attempts INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  last_attempt BIGINT,
  next_retry BIGINT,
  error_message TEXT,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_event_created ON webhook_events(created_at);

-- ============================================
-- Enhanced A/B Testing Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ab_test_sessions (
  id VARCHAR(255) PRIMARY KEY,
  test_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  visitor_id VARCHAR(255),
  time_on_site INTEGER DEFAULT 0,
  pages_viewed INTEGER DEFAULT 0,
  bounce BOOLEAN DEFAULT 0,
  converted BOOLEAN DEFAULT 0,
  conversion_value DECIMAL(10,2),
  conversion_time INTEGER,
  revenue DECIMAL(10,2) DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ab_session_test ON ab_test_sessions(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_session_variant ON ab_test_sessions(variant_id);
CREATE INDEX IF NOT EXISTS idx_ab_session_created ON ab_test_sessions(created_at);

CREATE TABLE IF NOT EXISTS ab_test_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  calculation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  confidence_level DECIMAL(5,2) DEFAULT 0,
  p_value DECIMAL(10,8),
  z_score DECIMAL(10,4),
  standard_error DECIMAL(10,6),
  lift_percentage DECIMAL(10,2),
  lift_lower_bound DECIMAL(10,2),
  lift_upper_bound DECIMAL(10,2),
  revenue_per_visitor DECIMAL(10,2),
  average_order_value DECIMAL(10,2),
  is_significant BOOLEAN DEFAULT 0,
  is_winner BOOLEAN DEFAULT 0,
  FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ab_stats_test ON ab_test_statistics(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_stats_variant ON ab_test_statistics(variant_id);
CREATE INDEX IF NOT EXISTS idx_ab_stats_time ON ab_test_statistics(calculation_time);

-- ============================================
-- Performance Monitoring Tables
-- ============================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  p50_response_time INTEGER,
  p75_response_time INTEGER,
  p90_response_time INTEGER,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  avg_dns_lookup INTEGER,
  avg_tcp_connect INTEGER,
  avg_ssl_handshake INTEGER,
  avg_server_response INTEGER,
  avg_content_download INTEGER,
  avg_dom_processing INTEGER,
  avg_page_render INTEGER,
  requests_per_second DECIMAL(10,2),
  bytes_per_second BIGINT,
  error_rate DECIMAL(5,2),
  timeout_rate DECIMAL(5,2),
  uptime_percentage DECIMAL(5,2),
  successful_requests INTEGER,
  failed_requests INTEGER,
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_perf_project_time ON performance_metrics(project_id, timestamp);

-- ============================================
-- User Engagement Tracking Tables
-- ============================================

CREATE TABLE IF NOT EXISTS user_engagement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255),
  project_id VARCHAR(255),
  date DATE NOT NULL,
  sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  unique_pages INTEGER DEFAULT 0,
  total_time_on_site INTEGER DEFAULT 0,
  average_session_duration INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,2),
  clicks INTEGER DEFAULT 0,
  scrolls INTEGER DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  video_plays INTEGER DEFAULT 0,
  file_downloads INTEGER DEFAULT 0,
  goals_completed INTEGER DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_engagement_user ON user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_project ON user_engagement(project_id);
CREATE INDEX IF NOT EXISTS idx_engagement_date ON user_engagement(date);

-- ============================================
-- Quick Stats Cache Table
-- ============================================

CREATE TABLE IF NOT EXISTS quick_stats_cache (
  id VARCHAR(50) PRIMARY KEY,
  total_projects INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  today_clicks INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  top_countries TEXT,
  top_referrers TEXT,
  top_devices TEXT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stats_expires ON quick_stats_cache(expires_at);

-- ============================================
-- API Key Management Tables
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(255) PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),
  scopes TEXT,
  rate_limit INTEGER DEFAULT 1000,
  last_used TIMESTAMP,
  total_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_key_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_key_active ON api_keys(is_active);

CREATE TABLE IF NOT EXISTS api_key_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_key_usage(timestamp);

-- ============================================
-- Advanced Targeting Rules Table
-- ============================================

CREATE TABLE IF NOT EXISTS targeting_rules (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority INTEGER DEFAULT 0,
  conditions TEXT NOT NULL,
  action VARCHAR(50) NOT NULL,
  action_value TEXT,
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  last_matched TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_targeting_project ON targeting_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_targeting_active ON targeting_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_targeting_priority ON targeting_rules(priority);

-- ============================================
-- Conversion Funnel Tables
-- ============================================

CREATE TABLE IF NOT EXISTS conversion_funnels (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  steps TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_funnel_project ON conversion_funnels(project_id);

CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funnel_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  step_index INTEGER NOT NULL,
  step_name VARCHAR(255),
  completed BOOLEAN DEFAULT 0,
  dropped BOOLEAN DEFAULT 0,
  time_to_complete INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (funnel_id) REFERENCES conversion_funnels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_funnel_event_funnel ON funnel_events(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_event_session ON funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_event_created ON funnel_events(created_at);

-- ============================================
-- Compound Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_events_fraud_detection 
  ON analytics_events(project_id, fraud_score, is_bot, created_at);

CREATE INDEX IF NOT EXISTS idx_events_geo_analysis 
  ON analytics_events(project_id, country_code, city, created_at);

CREATE INDEX IF NOT EXISTS idx_events_utm_tracking 
  ON analytics_events(project_id, utm_source, utm_medium, utm_campaign, created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_active_tracking 
  ON analytics_sessions(project_id, has_converted, updated_at);