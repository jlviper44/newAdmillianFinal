#!/bin/bash

# Database Backup Script for Cloudflare D1 Databases
# This script backs up all remote D1 databases to local SQL files

# Create backup directory with timestamp
BACKUP_DIR="database-backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Starting database backup to $BACKUP_DIR..."
echo "⏰ Backup started at: $(date)"

# Database list from wrangler.jsonc
DB_NAMES=("commentbot" "bcgen" "users" "dashboard" "logs" "linksplitter")
DB_IDS=("153cc865-af0a-42f6-a318-a5cb683c06d4" "bdb66b09-5517-44f0-8472-8f32cea293b8" "8dd18cd6-0ef3-4942-b535-65aea588d486" "b8e0ef90-599c-4451-bcaf-8865533ac147" "f8dab513-9543-469e-aac7-3f9bf0b6be84" "9d305f17-aa7b-4a53-a755-aa9099542a07")

# Function to backup a single database
backup_database() {
    local db_name=$1
    local db_id=$2

    echo "🔄 Backing up database: $db_name (ID: $db_id)"

    # Export the database using wrangler
    if npx wrangler d1 export "$db_name" --output "$BACKUP_DIR/${db_name}_backup.sql" --remote; then
        echo "✅ Successfully backed up $db_name"
        return 0
    else
        echo "❌ Failed to backup $db_name"
        return 1
    fi
}

# Backup all databases
success_count=0
total_count=${#DB_NAMES[@]}

for i in "${!DB_NAMES[@]}"; do
    db_name="${DB_NAMES[$i]}"
    db_id="${DB_IDS[$i]}"
    if backup_database "$db_name" "$db_id"; then
        ((success_count++))
    fi
    echo ""
done

# Create a backup manifest file
cat > "$BACKUP_DIR/backup_manifest.txt" << EOF
Database Backup Manifest
========================
Backup Date: $(date)
Total Databases: $total_count
Successful Backups: $success_count
Backup Location: $BACKUP_DIR

Database Details:
EOF

for i in "${!DB_NAMES[@]}"; do
    db_name="${DB_NAMES[$i]}"
    db_id="${DB_IDS[$i]}"
    echo "- $db_name: $db_id" >> "$BACKUP_DIR/backup_manifest.txt"
done

# Summary
echo "📊 Backup Summary:"
echo "   Total databases: $total_count"
echo "   Successful backups: $success_count"
echo "   Failed backups: $((total_count - success_count))"
echo "   Backup location: $BACKUP_DIR"
echo "⏰ Backup completed at: $(date)"

# Create a compressed archive of the backup
echo "🗜️  Creating compressed backup archive..."
tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"
echo "✅ Compressed backup created: ${BACKUP_DIR}.tar.gz"

if [ $success_count -eq $total_count ]; then
    echo "🎉 All databases backed up successfully!"
    exit 0
else
    echo "⚠️  Some databases failed to backup. Check the output above."
    exit 1
fi