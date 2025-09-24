-- Advanced Analytics Schema for LinkSplitter
-- Designed for Cloudflare D1 (SQLite)

-- ============================================
-- Core Tables from existing schema (enhanced)
-- ============================================

-- Link Splitter Groups
CREATE TABLE IF NOT EXISTS link_groups (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link Splitter Projects (enhanced with analytics settings)
CREATE TABLE IF NOT EXISTS link_projects (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255),
  team_id VARCHAR(255),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  main_url TEXT NOT NULL,
  custom_alias VARCHAR(255) UNIQUE,
  safe_link TEXT,
  items JSON,
  targeting JSON,
  fraud_protection JSON,
  ab_testing JSON,
  pixel_settings JSON,
  analytics_settings JSON, -- New: custom analytics configuration
  expires_at TIMESTAMP,
  clicks_limit INTEGER,
  click_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES link_groups(id) ON DELETE CASCADE
);

-- ============================================
-- Enhanced Analytics Tables
-- ============================================

-- Detailed Event Tracking Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL, -- UUID for event deduplication
  session_id VARCHAR(255) NOT NULL,
  
  -- User Information
  ip_address VARCHAR(45) NOT NULL,
  ip_hash VARCHAR(64), -- Hashed IP for privacy
  user_agent TEXT,
  user_id VARCHAR(255), -- If user is logged in
  
  -- Geographic Information
  country_code VARCHAR(2),
  country_name VARCHAR(100),
  region_code VARCHAR(10),
  region_name VARCHAR(100),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone VARCHAR(50),
  isp VARCHAR(255),
  
  -- Device & Browser Information
  device_type VARCHAR(20), -- mobile, desktop, tablet, tv, bot
  device_brand VARCHAR(50),
  device_model VARCHAR(100),
  browser_name VARCHAR(50),
  browser_version VARCHAR(20),
  browser_engine VARCHAR(50),
  os_name VARCHAR(50),
  os_version VARCHAR(20),
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  
  -- Traffic Source
  referrer_url TEXT,
  referrer_domain VARCHAR(255),
  referrer_type VARCHAR(50), -- search, social, direct, email, etc.
  search_engine VARCHAR(50),
  search_keyword TEXT,
  
  -- UTM Parameters
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  
  -- Custom Parameters
  custom_params JSON,
  
  -- Event Details
  event_type VARCHAR(50), -- click, view, conversion, etc.
  clicked_url TEXT,
  variant_id VARCHAR(255), -- For A/B testing
  variant_name VARCHAR(255),
  
  -- Performance Metrics
  page_load_time INTEGER, -- milliseconds
  dns_time INTEGER,
  connect_time INTEGER,
  response_time INTEGER,
  dom_interactive_time INTEGER,
  
  -- Engagement Metrics
  time_on_page INTEGER, -- seconds
  scroll_depth INTEGER, -- percentage
  clicks_count INTEGER,
  
  -- Fraud & Security
  fraud_score INTEGER DEFAULT 0, -- 0-100
  is_bot BOOLEAN DEFAULT 0,
  is_crawler BOOLEAN DEFAULT 0,
  is_vpn BOOLEAN DEFAULT 0,
  is_proxy BOOLEAN DEFAULT 0,
  is_tor BOOLEAN DEFAULT 0,
  threat_level VARCHAR(20), -- low, medium, high, critical
  fingerprint_id VARCHAR(255), -- Browser fingerprint
  
  -- Session Information
  is_new_session BOOLEAN DEFAULT 1,
  is_bounce BOOLEAN DEFAULT 0,
  session_duration INTEGER, -- seconds
  pages_in_session INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  client_timestamp TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Session Tracking Table
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  
  -- Session Info
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INTEGER, -- seconds
  page_views INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  
  -- First Touch Attribution
  first_referrer TEXT,
  first_utm_source VARCHAR(255),
  first_utm_medium VARCHAR(255),
  first_utm_campaign VARCHAR(255),
  
  -- Last Touch Attribution
  last_referrer TEXT,
  last_utm_source VARCHAR(255),
  last_utm_medium VARCHAR(255),
  last_utm_campaign VARCHAR(255),
  
  -- Device/Browser (from first event)
  device_type VARCHAR(20),
  browser_name VARCHAR(50),
  os_name VARCHAR(50),
  
  -- Geographic (from first event)
  country_code VARCHAR(2),
  region_code VARCHAR(10),
  city VARCHAR(100),
  
  -- Conversion & Revenue
  has_converted BOOLEAN DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS analytics_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  
  -- Response Times (milliseconds)
  avg_response_time INTEGER,
  min_response_time INTEGER,
  max_response_time INTEGER,
  p50_response_time INTEGER,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  
  -- Load Times
  avg_page_load_time INTEGER,
  avg_dns_time INTEGER,
  avg_connect_time INTEGER,
  avg_dom_time INTEGER,
  
  -- Availability
  uptime_percentage DECIMAL(5,2),
  total_requests INTEGER,
  successful_requests INTEGER,
  failed_requests INTEGER,
  
  -- Error Rates
  error_4xx_count INTEGER DEFAULT 0,
  error_5xx_count INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- ============================================
-- Aggregated Analytics Tables
-- ============================================

-- Hourly Aggregation
CREATE TABLE IF NOT EXISTS analytics_hourly (
  project_id VARCHAR(255) NOT NULL,
  hour_timestamp TIMESTAMP NOT NULL,
  
  -- Traffic Metrics
  total_events INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  -- Device Breakdown
  mobile_events INTEGER DEFAULT 0,
  desktop_events INTEGER DEFAULT 0,
  tablet_events INTEGER DEFAULT 0,
  other_device_events INTEGER DEFAULT 0,
  
  -- Geographic Summary
  unique_countries INTEGER DEFAULT 0,
  unique_cities INTEGER DEFAULT 0,
  top_countries JSON, -- Array of {country, count}
  top_cities JSON,
  
  -- Traffic Sources
  direct_traffic INTEGER DEFAULT 0,
  search_traffic INTEGER DEFAULT 0,
  social_traffic INTEGER DEFAULT 0,
  referral_traffic INTEGER DEFAULT 0,
  email_traffic INTEGER DEFAULT 0,
  top_referrers JSON,
  top_utm_sources JSON,
  
  -- Engagement
  avg_session_duration INTEGER,
  avg_pages_per_session DECIMAL(5,2),
  bounce_rate DECIMAL(5,2),
  
  -- Fraud & Bots
  bot_events INTEGER DEFAULT 0,
  suspicious_events INTEGER DEFAULT 0,
  blocked_events INTEGER DEFAULT 0,
  avg_fraud_score DECIMAL(5,2),
  
  -- Performance
  avg_response_time INTEGER,
  avg_page_load_time INTEGER,
  
  -- Conversions
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2),
  revenue DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (project_id, hour_timestamp),
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Daily Aggregation
CREATE TABLE IF NOT EXISTS analytics_daily (
  project_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  
  -- All fields from hourly, aggregated for the day
  total_events INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  mobile_events INTEGER DEFAULT 0,
  desktop_events INTEGER DEFAULT 0,
  tablet_events INTEGER DEFAULT 0,
  other_device_events INTEGER DEFAULT 0,
  
  unique_countries INTEGER DEFAULT 0,
  unique_cities INTEGER DEFAULT 0,
  top_countries JSON,
  top_cities JSON,
  
  direct_traffic INTEGER DEFAULT 0,
  search_traffic INTEGER DEFAULT 0,
  social_traffic INTEGER DEFAULT 0,
  referral_traffic INTEGER DEFAULT 0,
  email_traffic INTEGER DEFAULT 0,
  top_referrers JSON,
  top_utm_sources JSON,
  top_utm_campaigns JSON,
  top_search_keywords JSON,
  
  avg_session_duration INTEGER,
  avg_pages_per_session DECIMAL(5,2),
  bounce_rate DECIMAL(5,2),
  
  bot_events INTEGER DEFAULT 0,
  suspicious_events INTEGER DEFAULT 0,
  blocked_events INTEGER DEFAULT 0,
  avg_fraud_score DECIMAL(5,2),
  
  avg_response_time INTEGER,
  avg_page_load_time INTEGER,
  
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2),
  revenue DECIMAL(10,2) DEFAULT 0,
  
  -- Additional daily metrics
  new_vs_returning JSON, -- {new: count, returning: count}
  hourly_distribution JSON, -- Array of hourly traffic
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (project_id, date),
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Weekly Aggregation
CREATE TABLE IF NOT EXISTS analytics_weekly (
  project_id VARCHAR(255) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Summary metrics
  total_events INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  
  -- Trends
  daily_average_events INTEGER,
  daily_average_visitors INTEGER,
  week_over_week_growth DECIMAL(5,2),
  
  -- Top performers
  top_days JSON,
  top_countries JSON,
  top_referrers JSON,
  top_content JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (project_id, week_start),
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Monthly Aggregation
CREATE TABLE IF NOT EXISTS analytics_monthly (
  project_id VARCHAR(255) NOT NULL,
  month DATE NOT NULL, -- First day of month
  
  -- Summary metrics
  total_events INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  
  -- Trends
  daily_average_events INTEGER,
  daily_average_visitors INTEGER,
  month_over_month_growth DECIMAL(5,2),
  
  -- Top performers
  top_days JSON,
  top_countries JSON,
  top_referrers JSON,
  top_content JSON,
  top_campaigns JSON,
  
  -- Monthly insights
  busiest_hour INTEGER,
  busiest_day_of_week INTEGER,
  device_breakdown JSON,
  browser_breakdown JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (project_id, month),
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- ============================================
-- Fraud Detection Tables
-- ============================================

CREATE TABLE IF NOT EXISTS fraud_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  
  -- Reputation Scores
  base_score INTEGER DEFAULT 50, -- 0-100
  vpn_detected BOOLEAN DEFAULT 0,
  proxy_detected BOOLEAN DEFAULT 0,
  tor_detected BOOLEAN DEFAULT 0,
  hosting_provider BOOLEAN DEFAULT 0,
  
  -- Behavioral Scores
  click_velocity_score INTEGER, -- Rate of clicks
  session_anomaly_score INTEGER, -- Unusual session patterns
  device_switching_score INTEGER, -- Frequent device changes
  
  -- Historical Data
  total_events INTEGER DEFAULT 0,
  suspicious_events INTEGER DEFAULT 0,
  blocked_events INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255),
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50), -- ip_block, rate_limit, pattern, etc.
  conditions JSON, -- Rule conditions
  action VARCHAR(50), -- block, flag, monitor
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- ============================================
-- A/B Testing Tables (Enhanced)
-- ============================================

CREATE TABLE IF NOT EXISTS ab_tests (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  test_type VARCHAR(50), -- split, multivariate, sequential
  hypothesis TEXT,
  
  -- Test Configuration
  status VARCHAR(50) DEFAULT 'draft', -- draft, running, paused, completed
  traffic_allocation INTEGER DEFAULT 100, -- Percentage of traffic in test
  confidence_level DECIMAL(5,2) DEFAULT 95.00,
  minimum_sample_size INTEGER,
  
  -- Timing
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  completed_date TIMESTAMP,
  
  -- Results
  winning_variant_id VARCHAR(255),
  statistical_significance DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ab_test_variants (
  id VARCHAR(255) PRIMARY KEY,
  test_id VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  variant_type VARCHAR(50), -- control, treatment
  
  -- Configuration
  traffic_percentage DECIMAL(5,2),
  url TEXT,
  modifications JSON, -- DOM modifications, redirects, etc.
  
  -- Results
  visitors INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  avg_revenue_per_visitor DECIMAL(10,2) DEFAULT 0,
  
  -- Statistical Results
  confidence_interval_lower DECIMAL(5,2),
  confidence_interval_upper DECIMAL(5,2),
  p_value DECIMAL(10,8),
  is_significant BOOLEAN DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ab_test_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50), -- exposure, conversion, revenue
  event_value DECIMAL(10,2),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES ab_test_variants(id) ON DELETE CASCADE
);

-- ============================================
-- Conversion Tracking (Enhanced)
-- ============================================

CREATE TABLE IF NOT EXISTS conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  event_id VARCHAR(255),
  
  -- Conversion Details
  conversion_type VARCHAR(50), -- purchase, signup, lead, download, custom
  conversion_name VARCHAR(255),
  conversion_value DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Attribution
  attribution_model VARCHAR(50), -- last_click, first_click, linear, time_decay
  touchpoints JSON, -- Array of touchpoint events
  
  -- Product/Item Details (for e-commerce)
  items JSON, -- Array of {id, name, category, price, quantity}
  
  -- Custom Properties
  custom_properties JSON,
  
  -- Timing
  time_to_conversion INTEGER, -- seconds from first touch
  converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversion_goals (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  goal_name VARCHAR(255) NOT NULL,
  goal_type VARCHAR(50), -- url, event, duration, pages_per_session
  
  -- Goal Configuration
  conditions JSON, -- Goal completion conditions
  value DECIMAL(10,2), -- Monetary value of goal
  
  -- Tracking
  is_active BOOLEAN DEFAULT 1,
  completions INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_project_time ON analytics_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ip ON analytics_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_events_country ON analytics_events(country_code);
CREATE INDEX IF NOT EXISTS idx_events_device ON analytics_events(device_type);
CREATE INDEX IF NOT EXISTS idx_events_utm ON analytics_events(utm_source, utm_medium, utm_campaign);
CREATE INDEX IF NOT EXISTS idx_events_fraud ON analytics_events(fraud_score, is_bot);
CREATE INDEX IF NOT EXISTS idx_events_variant ON analytics_events(variant_id);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_project ON analytics_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON analytics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_time ON analytics_sessions(start_time);

-- Aggregation table indexes
CREATE INDEX IF NOT EXISTS idx_hourly_project_time ON analytics_hourly(project_id, hour_timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_project_date ON analytics_daily(project_id, date);
CREATE INDEX IF NOT EXISTS idx_weekly_project ON analytics_weekly(project_id, week_start);
CREATE INDEX IF NOT EXISTS idx_monthly_project ON analytics_monthly(project_id, month);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_performance_project_time ON analytics_performance(project_id, timestamp);

-- Fraud indexes
CREATE INDEX IF NOT EXISTS idx_fraud_ip ON fraud_scores(ip_address);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_project ON fraud_rules(project_id);

-- A/B Test indexes
CREATE INDEX IF NOT EXISTS idx_ab_tests_project ON ab_tests(project_id);
CREATE INDEX IF NOT EXISTS idx_ab_variants_test ON ab_test_variants(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_events_test ON ab_test_events(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_events_variant ON ab_test_events(variant_id);

-- Conversion indexes
CREATE INDEX IF NOT EXISTS idx_conversions_project ON conversions(project_id);
CREATE INDEX IF NOT EXISTS idx_conversions_session ON conversions(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_goals_project ON conversion_goals(project_id);