# Database Migration Script (Wrangler Version)

This script migrates spark data from your local backup to the remote Cloudflare D1 database using Wrangler CLI.

## What the script does:

1. **Parses** the SQL backup file and extracts 471 spark records
2. **Cleans** the data by converting 'active' status to 'untested'
3. **Clears** the remote sparks table completely using Wrangler
4. **Pushes** all cleaned spark data directly to DASHBOARD_DB using Wrangler

## Usage:

### Dry Run (Preview only - recommended first):
```bash
./migrate_sparks.sh --dry-run
```

### Actual Migration (BE CAREFUL - this will clear and replace all remote sparks):
```bash
./migrate_sparks.sh
```

## Commands the script will run:

1. **Clear remote table:**
   ```bash
   npx wrangler d1 execute DASHBOARD_DB --remote --command "DELETE FROM sparks;"
   ```

2. **Import cleaned data:**
   ```bash
   npx wrangler d1 execute DASHBOARD_DB --remote --file /tmp/cleaned_sparks.sql
   ```

3. **Verify migration:**
   ```bash
   npx wrangler d1 execute DASHBOARD_DB --remote --command "SELECT COUNT(*) as total_sparks FROM sparks;"
   ```

## Data Summary:

- **Total sparks found**: 471
- **Valid sparks to migrate**: 471 (100%)
- **Key change**: All 'active' status entries → 'untested'

## Sample Migration Output:
```
🚀 Starting database migration with Wrangler...
📋 Step 1: Processing backup file...
Found 471 spark records
🧹 Step 2: Cleaning data format...
✅ Processed 471 records
🗑️ Step 3: Clearing remote sparks table...
✅ Remote table cleared
📤 Step 4: Importing cleaned data...
✅ Data import completed
🔍 Verifying migration...
🎉 Migration completed successfully!
```

## Prerequisites:

1. Wrangler CLI must be installed and authenticated
2. Access to DASHBOARD_DB database
3. The backup file must exist at `./database-backups/20250926_072517/dashboard_backup.sql`

## Warning:

⚠️ **This script will completely clear the remote sparks table before importing the new data. Make sure you have a backup of any important remote data that's not in your local backup.**

## What gets changed:

- **Status field**: 'active' → 'untested' (as requested)
- **Data integrity**: All fields remain intact
- **Structure**: No schema changes, just data replacement

## Verification:

After running the migration, the script will show:
- Total number of records imported
- You can verify in your dashboard that all sparks now have 'untested' status by default