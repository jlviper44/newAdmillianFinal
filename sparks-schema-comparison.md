# Sparks Table Schema Comparison

## Schema Differences Between Local and Remote

### Column Comparison

| Column | Local (Dev) | Remote (Prod) | Status |
|--------|-------------|---------------|---------|
| `id` | ✅ TEXT PRIMARY KEY | ✅ TEXT PRIMARY KEY | ✅ MATCH |
| `user_id` | ✅ TEXT NOT NULL | ✅ TEXT NOT NULL | ✅ MATCH |
| `team_id` | ✅ TEXT | ✅ TEXT | ✅ MATCH |
| `name` | ✅ TEXT NOT NULL | ✅ TEXT NOT NULL | ✅ MATCH |
| `creator` | ✅ TEXT DEFAULT '' | ✅ TEXT DEFAULT '' | ✅ MATCH |
| `tiktok_link` | ✅ TEXT NOT NULL | ✅ TEXT NOT NULL | ✅ MATCH |
| `spark_code` | ✅ TEXT NOT NULL | ✅ TEXT NOT NULL | ✅ MATCH |
| `offer` | ✅ TEXT NOT NULL | ✅ TEXT NOT NULL | ✅ MATCH |
| `offer_name` | ❌ MISSING | ✅ TEXT | ⚠️ DIFF |
| `thumbnail` | ✅ TEXT | ✅ TEXT | ✅ MATCH |
| `status` | ✅ TEXT DEFAULT 'active' | ✅ TEXT DEFAULT 'active' | ✅ MATCH |
| `traffic` | ✅ INTEGER DEFAULT 0 | ✅ INTEGER DEFAULT 0 | ✅ MATCH |
| `content_type` | ✅ TEXT DEFAULT 'video' | ❌ MISSING | ⚠️ DIFF |
| `bot_status` | ✅ TEXT DEFAULT NULL | ❌ MISSING | ⚠️ DIFF |
| `bot_post_id` | ✅ TEXT DEFAULT NULL | ❌ MISSING | ⚠️ DIFF |
| `created_at` | ✅ DATETIME DEFAULT CURRENT_TIMESTAMP | ✅ DATETIME DEFAULT CURRENT_TIMESTAMP | ✅ MATCH |
| `updated_at` | ✅ DATETIME DEFAULT CURRENT_TIMESTAMP | ✅ DATETIME DEFAULT CURRENT_TIMESTAMP | ✅ MATCH |
| `comment_bot_order_id` | ✅ TEXT DEFAULT NULL | ❌ MISSING | ⚠️ DIFF |
| `payment_status` | ✅ TEXT DEFAULT NULL | ❌ MISSING | ⚠️ DIFF |
| `type` | ❌ MISSING | ✅ TEXT DEFAULT 'auto' | ⚠️ DIFF |

### Summary of Differences

#### 🔴 Remote Has, Local Missing:
1. **`offer_name`** - TEXT field for offer names
2. **`type`** - TEXT DEFAULT 'auto' for spark type classification

#### 🔴 Local Has, Remote Missing:
1. **`content_type`** - TEXT DEFAULT 'video' for content classification
2. **`bot_status`** - TEXT DEFAULT NULL for comment bot status tracking
3. **`bot_post_id`** - TEXT DEFAULT NULL for comment bot post reference
4. **`comment_bot_order_id`** - TEXT DEFAULT NULL for linking to comment bot orders
5. **`payment_status`** - TEXT DEFAULT NULL for payment tracking

### Index Comparison

| Index | Local (Dev) | Remote (Prod) | Status |
|-------|-------------|---------------|---------|
| `idx_sparks_status` | ✅ | ✅ | ✅ MATCH |
| `idx_sparks_offer` | ✅ | ✅ | ✅ MATCH |
| `idx_sparks_created` | ✅ | ✅ | ✅ MATCH |
| `idx_sparks_user_id` | ✅ | ✅ | ✅ MATCH |
| `idx_sparks_bot_status` | ✅ | ❌ MISSING | ⚠️ DIFF |

### Trigger Comparison

| Trigger | Local (Dev) | Remote (Prod) | Status |
|---------|-------------|---------------|---------|
| `update_sparks_timestamp` | ✅ | ✅ | ✅ MATCH |

## Analysis

### 🚨 Schema Drift Detected

The local development database has **schema drift** compared to the remote production database:

#### **Local is Ahead (Newer Features):**
- **Comment Bot Integration:** Local has comment bot fields (`bot_status`, `bot_post_id`, `comment_bot_order_id`)
- **Payment Tracking:** Local has `payment_status` for payment workflow
- **Content Classification:** Local has `content_type` for media type tracking
- **Bot Status Index:** Local has optimized indexing for bot operations

#### **Remote is Behind (Missing Features):**
- Missing comment bot integration fields
- Missing payment tracking capabilities
- Missing content type classification
- Missing `offer_name` field (though local is missing this too)

#### **Remote Has Different Features:**
- **Spark Type Classification:** Remote has `type` field for categorizing sparks
- **Offer Names:** Remote has `offer_name` for structured offer management

## Recommendations

### 1. **Immediate Action Required**
- ⚠️ **Database Migration Needed:** The remote production database is missing several newer features that exist in local development

### 2. **Migration Strategy**
```sql
-- Add missing columns to remote database
ALTER TABLE sparks ADD COLUMN content_type TEXT DEFAULT 'video';
ALTER TABLE sparks ADD COLUMN bot_status TEXT DEFAULT NULL;
ALTER TABLE sparks ADD COLUMN bot_post_id TEXT DEFAULT NULL;
ALTER TABLE sparks ADD COLUMN comment_bot_order_id TEXT DEFAULT NULL;
ALTER TABLE sparks ADD COLUMN payment_status TEXT DEFAULT NULL;

-- Add missing index
CREATE INDEX idx_sparks_bot_status ON sparks(bot_status);

-- Optionally add offer_name to local if needed
ALTER TABLE sparks ADD COLUMN offer_name TEXT;
```

### 3. **Sync Considerations**
- The local database schema represents the latest development version
- Production deployment should include schema migrations
- Consider adding `type` field to local if spark classification is needed

This schema drift indicates active development on comment bot and payment features that haven't been deployed to production yet.