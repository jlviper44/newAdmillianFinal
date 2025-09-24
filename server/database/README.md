# Database Schema Management

This directory contains all database schemas and initialization logic for the application.

## Structure

```
database/
├── init.js                    # Database initialization orchestrator
├── schemas/                   # SQL schema definitions
│   ├── sessions.sql          # User sessions (USERS_DB)
│   ├── bcgen.sql             # BC generation (DASHBOARD_DB)
│   ├── link-splitter.sql     # Link tracking (DASHBOARD_DB)
│   ├── link-splitter-analytics.sql
│   └── link-splitter-advanced-analytics-fixed.sql
└── README.md                 # This file
```

## How It Works

### Automatic Initialization

On the first request to the server, `ensureTablesExist()` is called which:

1. **Reads SQL files** from `schemas/` directory
2. **Executes them** against the appropriate database (USERS_DB, DASHBOARD_DB, COMMENT_BOT_DB)
3. **Sets DB_INITIALIZED flag** to prevent re-initialization

### Database Mapping

- **USERS_DB** → Authentication & user management
  - `sessions.sql` - User sessions and tokens

- **DASHBOARD_DB** → Application data
  - `bcgen.sql` - BC generation tracking
  - `link-splitter*.sql` - Link tracking & analytics

- **COMMENT_BOT_DB** → Comment bot queuing system
  - Initialized via code (comment-bot-queue.service.js)

## Adding New Schemas

1. **Create SQL file** in `schemas/` directory:
   ```sql
   -- my-feature.sql
   CREATE TABLE IF NOT EXISTS my_table (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Import in init.js**:
   ```javascript
   import myFeatureSchema from './schemas/my-feature.sql?raw';
   ```

3. **Add to SCHEMAS object**:
   ```javascript
   const SCHEMAS = {
     DASHBOARD_DB: [
       // ... existing schemas
       { name: 'my-feature', sql: myFeatureSchema }
     ]
   };
   ```

## Migration Strategy

Currently, we use `CREATE TABLE IF NOT EXISTS` for all tables. This means:

✅ **Safe to run multiple times** - won't error if table exists
✅ **Auto-creates tables** on first run
❌ **No version tracking** - manual schema changes needed

### Future: Proper Migrations

To implement proper migrations:

1. Create `migrations/` directory
2. Version migration files: `001_initial.sql`, `002_add_column.sql`
3. Track applied migrations in database
4. Run pending migrations on startup

Example migration system:
```javascript
// migrations/001_initial.sql
CREATE TABLE users (id INTEGER PRIMARY KEY);

// migrations/002_add_email.sql
ALTER TABLE users ADD COLUMN email TEXT;
```

## Best Practices

1. **Always use `CREATE TABLE IF NOT EXISTS`** for safety
2. **One feature = One schema file** for organization
3. **Document complex schemas** with SQL comments
4. **Test schema changes** in development first
5. **Keep schemas in sync** with code expectations

## Troubleshooting

### Schema not loading?
- Check `?raw` import is correct
- Verify file is in SCHEMAS object
- Check database binding exists in wrangler.toml

### Table already exists error?
- Use `CREATE TABLE IF NOT EXISTS`
- Or use `DROP TABLE IF EXISTS` (dangerous!)

### SQL syntax error?
- Test SQL separately in D1 console
- Check for missing semicolons between statements
- Verify D1-compatible SQL syntax