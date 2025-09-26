#!/bin/bash

# Database Restore Script for Cloudflare D1 Databases
# This script restores remote D1 databases from local SQL backup files

set -e  # Exit on any error

# Configuration
BACKUP_DIR="database-backups/20250926_072517"
WRANGLER_CMD="npx wrangler"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database mapping (backup file -> database name)
declare -A DB_MAPPING=(
    ["commentbot_backup.sql"]="commentbot"
    ["bcgen_backup.sql"]="bcgen"
    ["users_backup.sql"]="users"
    ["dashboard_backup.sql"]="dashboard"
    ["logs_backup.sql"]="logs"
    ["linksplitter_backup.sql"]="linksplitter"
)

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to confirm action
confirm_action() {
    local message=$1
    print_message $YELLOW "⚠️  WARNING: $message"
    read -p "Are you sure you want to continue? (yes/no): " confirmation

    if [[ $confirmation != "yes" ]]; then
        print_message $RED "❌ Operation cancelled by user"
        exit 1
    fi
}

# Function to check if backup file exists
check_backup_file() {
    local backup_file=$1
    if [[ ! -f "$BACKUP_DIR/$backup_file" ]]; then
        print_message $RED "❌ Backup file not found: $BACKUP_DIR/$backup_file"
        return 1
    fi
    return 0
}

# Function to get file size in human readable format
get_file_size() {
    local file=$1
    if [[ -f "$file" ]]; then
        du -h "$file" | cut -f1
    else
        echo "N/A"
    fi
}

# Function to restore a single database
restore_database() {
    local backup_file=$1
    local db_name=$2

    print_message $BLUE "🔄 Restoring database: $db_name"
    print_message $BLUE "   From backup: $backup_file"
    print_message $BLUE "   File size: $(get_file_size "$BACKUP_DIR/$backup_file")"

    # Execute the restore using wrangler d1 execute
    if $WRANGLER_CMD d1 execute "$db_name" --file="$BACKUP_DIR/$backup_file" --remote; then
        print_message $GREEN "   ✅ Successfully restored $db_name"
        return 0
    else
        print_message $RED "   ❌ Failed to restore $db_name"
        return 1
    fi
}

# Function to create a pre-restore backup
create_current_backup() {
    print_message $BLUE "📦 Creating current state backup before restore..."

    local current_backup_dir="database-backups/pre-restore-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$current_backup_dir"

    for db_name in "${DB_MAPPING[@]}"; do
        print_message $BLUE "   Backing up current $db_name..."
        if $WRANGLER_CMD d1 export "$db_name" --output "$current_backup_dir/${db_name}_current.sql" --remote; then
            print_message $GREEN "   ✅ Current $db_name backed up"
        else
            print_message $YELLOW "   ⚠️  Could not backup current $db_name (may be empty)"
        fi
    done

    print_message $GREEN "📦 Current state backed up to: $current_backup_dir"
}

# Function to restore specific database
restore_specific_database() {
    local target_db=$1

    print_message $BLUE "🎯 Restoring specific database: $target_db"

    for backup_file in "${!DB_MAPPING[@]}"; do
        if [[ "${DB_MAPPING[$backup_file]}" == "$target_db" ]]; then
            if check_backup_file "$backup_file"; then
                confirm_action "This will OVERWRITE the remote $target_db database with backup data from $(date -r $(stat -f %m "$BACKUP_DIR/$backup_file") '+%Y-%m-%d %H:%M:%S')"

                if restore_database "$backup_file" "$target_db"; then
                    print_message $GREEN "🎉 Successfully restored $target_db database"
                    return 0
                else
                    print_message $RED "💥 Failed to restore $target_db database"
                    return 1
                fi
            fi
            return 1
        fi
    done

    print_message $RED "❌ Database $target_db not found in backup mappings"
    return 1
}

# Function to restore all databases
restore_all_databases() {
    print_message $BLUE "🔄 Restoring ALL databases from backup..."

    local success_count=0
    local total_count=${#DB_MAPPING[@]}

    for backup_file in "${!DB_MAPPING[@]}"; do
        local db_name="${DB_MAPPING[$backup_file]}"

        if check_backup_file "$backup_file"; then
            if restore_database "$backup_file" "$db_name"; then
                ((success_count++))
            fi
        fi
        echo ""
    done

    print_message $BLUE "📊 Restore Summary:"
    print_message $BLUE "   Total databases: $total_count"
    print_message $BLUE "   Successful restores: $success_count"
    print_message $BLUE "   Failed restores: $((total_count - success_count))"

    if [[ $success_count -eq $total_count ]]; then
        print_message $GREEN "🎉 All databases restored successfully!"
        return 0
    else
        print_message $YELLOW "⚠️  Some databases failed to restore. Check the output above."
        return 1
    fi
}

# Main script logic
main() {
    print_message $GREEN "🔧 Cloudflare D1 Database Restore Tool"
    print_message $BLUE "📁 Using backups from: $BACKUP_DIR"
    echo ""

    # Check if backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        print_message $RED "❌ Backup directory not found: $BACKUP_DIR"
        exit 1
    fi

    # Display backup information
    print_message $BLUE "📋 Available backups:"
    for backup_file in "${!DB_MAPPING[@]}"; do
        local db_name="${DB_MAPPING[$backup_file]}"
        local file_size=$(get_file_size "$BACKUP_DIR/$backup_file")
        print_message $BLUE "   $db_name: $file_size"
    done
    echo ""

    # Parse command line arguments
    case "${1:-}" in
        "dashboard"|"users"|"commentbot"|"bcgen"|"logs"|"linksplitter")
            create_current_backup
            restore_specific_database "$1"
            ;;
        "all")
            confirm_action "This will OVERWRITE ALL remote databases with backup data from $(cat "$BACKUP_DIR/backup_manifest.txt" | grep "Backup Date:" | cut -d: -f2-)"
            create_current_backup
            restore_all_databases
            ;;
        "")
            print_message $YELLOW "Usage: $0 <database_name|all>"
            print_message $BLUE "Available databases: dashboard, users, commentbot, bcgen, logs, linksplitter"
            print_message $BLUE "Use 'all' to restore all databases"
            print_message $BLUE ""
            print_message $BLUE "Examples:"
            print_message $BLUE "  $0 dashboard     # Restore only dashboard database"
            print_message $BLUE "  $0 all           # Restore all databases"
            exit 1
            ;;
        *)
            print_message $RED "❌ Invalid database name: $1"
            print_message $BLUE "Available databases: dashboard, users, commentbot, bcgen, logs, linksplitter"
            exit 1
            ;;
    esac
}

# Run the main function
main "$@"