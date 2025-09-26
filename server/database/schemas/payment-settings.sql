-- Payment Settings table for VA payment configuration
CREATE TABLE IF NOT EXISTS payment_settings (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    setting_type TEXT NOT NULL, -- 'default' or 'creator'
    creator_email TEXT, -- NULL for default settings, email for creator-specific settings
    rate_per_video DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    commission_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    commission_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(setting_type, creator_email),
    CHECK(setting_type IN ('default', 'creator')),
    CHECK(commission_type IN ('percentage', 'fixed')),
    CHECK(rate_per_video >= 0),
    CHECK(commission_rate >= 0)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_settings_creator ON payment_settings(creator_email);
CREATE INDEX IF NOT EXISTS idx_payment_settings_type ON payment_settings(setting_type);

-- Insert default settings
INSERT OR IGNORE INTO payment_settings (setting_type, creator_email, rate_per_video, commission_rate, commission_type)
VALUES ('default', NULL, 1.00, 0.00, 'percentage');