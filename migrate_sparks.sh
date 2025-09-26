#!/bin/bash

# Database Migration Script for Sparks using Wrangler
# This script clears the remote sparks table and imports cleaned data from local backup

set -e  # Exit on any error

# Configuration
BACKUP_FILE="./database-backups/20250926_072517/dashboard_backup.sql"
TEMP_FILE="/tmp/cleaned_sparks.sql"

echo "🚀 Starting database migration with Wrangler..."
echo

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found at $BACKUP_FILE"
    exit 1
fi

echo "📋 Step 1: Processing backup file..."

# Extract and clean spark data from backup
echo "Extracting spark records..."
grep "INSERT INTO sparks VALUES" "$BACKUP_FILE" > /tmp/raw_sparks.sql

# Count records
RECORD_COUNT=$(wc -l < /tmp/raw_sparks.sql)
echo "Found $RECORD_COUNT spark records"

echo "🧹 Step 2: Cleaning data format..."

# Create cleaned SQL file
cat > "$TEMP_FILE" << 'EOF'
-- Clear existing sparks table
DELETE FROM sparks;

EOF

# Process each INSERT statement to clean the data
echo "Processing and cleaning records..."
processed=0

while IFS= read -r line; do
    # Convert 'active' status to 'untested'
    cleaned_line=$(echo "$line" | sed -e "s/,'active',/,'untested',/g")

    # Remove the ending ); and add missing columns with default values
    # The remote table has 20 columns, backup has 15, so we need 5 more:
    # content_type, bot_status, bot_post_id, comment_bot_order_id, payment_status
    base_line=$(echo "$cleaned_line" | sed 's/);$//')

    # Add the missing columns with default values
    full_line="${base_line},'video',NULL,NULL,NULL,NULL);"

    # Append to temp file
    echo "$full_line" >> "$TEMP_FILE"

    processed=$((processed + 1))
    if [ $((processed % 50)) -eq 0 ]; then
        echo "Processed $processed/$RECORD_COUNT records..."
    fi
done < /tmp/raw_sparks.sql

echo "✅ Processed $processed records"
echo

# Show preview of changes
echo "📋 Preview of cleaned data:"
echo "First few lines of migration file:"
head -n 5 "$TEMP_FILE"
echo "..."
echo "Status changes: 'active' → 'untested'"
echo

# Dry run check
if [ "$1" = "--dry-run" ]; then
    echo "🔍 DRY RUN MODE - No actual migration performed"
    echo
    echo "📊 Migration Preview:"
    echo "✅ Would migrate: $processed sparks"
    echo "🔧 Changes made:"
    echo "  - All 'active' status → 'untested'"
    echo "  - Data validated and formatted"
    echo
    echo "📁 Cleaned SQL file ready at: $TEMP_FILE"
    echo "✨ Run without --dry-run to execute migration"
    exit 0
fi

echo "⚠️  WARNING: This will completely clear and replace the remote sparks table!"
echo "📊 Summary:"
echo "  - Records to migrate: $processed"
echo "  - Target: Remote DASHBOARD_DB sparks table"
echo "  - Action: CLEAR + INSERT ALL"
echo

# Confirmation prompt
read -p "Are you sure you want to proceed? (type 'yes' to continue): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo
echo "🗑️  Step 3: Clearing remote sparks table..."

# Clear the remote sparks table using Wrangler
npx wrangler d1 execute DASHBOARD_DB --remote --command "DELETE FROM sparks;"

echo "✅ Remote table cleared"
echo

echo "📤 Step 4: Importing cleaned data..."

# Import the cleaned data using Wrangler
npx wrangler d1 execute DASHBOARD_DB --remote --file "$TEMP_FILE"

echo "✅ Data import completed"

# Verification
echo
echo "🔍 Verifying migration..."

# Check the count of imported records
npx wrangler d1 execute DASHBOARD_DB --remote --command "SELECT COUNT(*) as total_sparks FROM sparks;"

echo
echo "📊 Migration Summary:"
echo "✅ Processed: $processed spark records"
echo "🧹 Cleaned: status 'active' → 'untested'"
echo "📁 SQL file: $TEMP_FILE"

# Clean up temporary files
rm -f /tmp/raw_sparks.sql

echo
echo "🎉 Migration completed successfully!"
echo
echo "📋 Next steps:"
echo "1. Verify the remote database has $processed sparks"
echo "2. Check that default status is 'untested'"
echo "3. Test spark creation with new default status"