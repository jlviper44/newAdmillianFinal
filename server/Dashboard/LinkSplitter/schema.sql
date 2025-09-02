-- Link Splitter Database Schema
-- This schema is designed for SQLite integration with the Dashboard

-- Groups table for organizing projects
CREATE TABLE IF NOT EXISTS link_groups (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table for individual link splitter configurations
CREATE TABLE IF NOT EXISTS link_projects (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255),
  team_id VARCHAR(255),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  main_url TEXT NOT NULL,
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
  status VARCHAR(50) DEFAULT 'active', -- active, paused, expired
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES link_groups(id) ON DELETE CASCADE
);

-- Real-time analytics table for tracking clicks
CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  ip_address VARCHAR(255),
  user_agent TEXT,
  referrer TEXT,
  country VARCHAR(10),
  city VARCHAR(255),
  region VARCHAR(255),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  clicked_url TEXT,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  fraud_score INTEGER DEFAULT 0,
  is_bot BOOLEAN DEFAULT 0,
  is_unique BOOLEAN DEFAULT 1,
  response_time INTEGER, -- milliseconds
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Aggregated analytics for performance (hourly)
CREATE TABLE IF NOT EXISTS link_analytics_hourly (
  project_id VARCHAR(255) NOT NULL,
  hour_timestamp TIMESTAMP NOT NULL,
  total_clicks INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  bot_clicks INTEGER DEFAULT 0,
  mobile_clicks INTEGER DEFAULT 0,
  desktop_clicks INTEGER DEFAULT 0,
  tablet_clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  PRIMARY KEY (project_id, hour_timestamp),
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Daily aggregated analytics
CREATE TABLE IF NOT EXISTS link_analytics_daily (
  project_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  total_clicks INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  bot_clicks INTEGER DEFAULT 0,
  mobile_clicks INTEGER DEFAULT 0,
  desktop_clicks INTEGER DEFAULT 0,
  tablet_clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  top_countries JSON, -- JSON array of top countries
  top_referrers JSON, -- JSON array of top referrers
  top_devices JSON, -- JSON array of top devices
  PRIMARY KEY (project_id, date),
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- A/B Test Results table
CREATE TABLE IF NOT EXISTS link_ab_test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255),
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  confidence_level DECIMAL(5,2) DEFAULT 0,
  is_winner BOOLEAN DEFAULT 0,
  test_started_at TIMESTAMP,
  test_ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE
);

-- Conversion tracking table
CREATE TABLE IF NOT EXISTS link_conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(255) NOT NULL,
  click_id INTEGER,
  session_id VARCHAR(255),
  conversion_value DECIMAL(10,2),
  conversion_type VARCHAR(100), -- purchase, signup, lead, custom
  metadata JSON,
  converted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES link_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (click_id) REFERENCES link_clicks(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_alias ON link_projects(custom_alias);
CREATE INDEX IF NOT EXISTS idx_projects_user ON link_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_team ON link_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON link_projects(status);

CREATE INDEX IF NOT EXISTS idx_clicks_project ON link_clicks(project_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_session ON link_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_clicks_ip ON link_clicks(ip_address);
CREATE INDEX IF NOT EXISTS idx_clicks_date ON link_clicks(clicked_at);

CREATE INDEX IF NOT EXISTS idx_analytics_hourly ON link_analytics_hourly(project_id, hour_timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_daily ON link_analytics_daily(project_id, date);

CREATE INDEX IF NOT EXISTS idx_conversions_project ON link_conversions(project_id);
CREATE INDEX IF NOT EXISTS idx_conversions_session ON link_conversions(session_id);