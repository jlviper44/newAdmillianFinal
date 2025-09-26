#!/usr/bin/env node

/**
 * Database Migration Script
 *
 * This script performs the following actions:
 * 1. Cleans and validates data from the local backup
 * 2. Clears the remote sparks table completely
 * 3. Pushes cleaned data to the remote database via API
 *
 * Usage: node migration_script.js
 */

import fs from 'fs';
import path from 'path';

const API_BASE_URL = 'http://localhost:5173/api/sparks'; // Adjust for your local dev server
const BACKUP_FILE = './database-backups/20250926_072517/dashboard_backup.sql';

// Data cleaning functions
function cleanCreatorField(creator) {
  // Fix TikTok URLs in creator field - replace with proper email or remove
  if (creator && creator.startsWith('http')) {
    console.log(`Fixing invalid creator field: ${creator}`);
    return ''; // Set to empty string for invalid entries
  }
  return creator || '';
}

function validateSparkData(spark) {
  // Ensure all required fields are present and valid
  const errors = [];

  if (!spark.name || spark.name.trim() === '') {
    errors.push('Missing or empty name');
  }

  if (!spark.tiktokLink || !spark.tiktokLink.startsWith('http')) {
    errors.push('Invalid or missing tiktok_link');
  }

  if (!spark.sparkCode || spark.sparkCode.trim() === '') {
    errors.push('Missing or empty spark_code');
  }

  if (!spark.id || spark.id.trim() === '') {
    errors.push('Missing or empty id');
  }

  return errors;
}

function cleanSparkData(rawData) {
  const cleaned = {
    id: rawData.id,
    name: rawData.name,
    creator: cleanCreatorField(rawData.creator),
    tiktokLink: rawData.tiktok_link,
    sparkCode: rawData.spark_code,
    offer: rawData.offer || '',
    thumbnail: rawData.thumbnail,
    status: rawData.status === 'active' ? 'untested' : rawData.status, // Convert 'active' to 'untested'
    traffic: parseInt(rawData.traffic) || 0,
    type: rawData.type || 'auto'
  };

  return cleaned;
}

// Parse SQL file and extract spark data
function parseSqlBackup(filePath) {
  try {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const insertLines = sqlContent.split('\n').filter(line =>
      line.trim().startsWith('INSERT INTO sparks VALUES')
    );

    console.log(`Found ${insertLines.length} spark records in backup`);

    const sparks = [];
    const errors = [];

    insertLines.forEach((line, index) => {
      try {
        // Extract values from SQL INSERT statement using a more robust parser
        const valuesStart = line.indexOf('VALUES(') + 7;
        const valuesEnd = line.lastIndexOf(');');

        if (valuesStart === 6 || valuesEnd === -1) { // VALUES( wasn't found or ); wasn't found
          errors.push({
            line: index + 1,
            error: 'Could not find VALUES clause in SQL line'
          });
          return;
        }

        const valuesContent = line.substring(valuesStart, valuesEnd);

        // Split by ',' but respect quotes
        const values = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < valuesContent.length) {
          const char = valuesContent[i];

          if (char === "'" && (i === 0 || valuesContent[i-1] !== '\\')) {
            inQuotes = !inQuotes;
            current += char;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^'|'$/g, '')); // Remove surrounding quotes
            current = '';
          } else {
            current += char;
          }
          i++;
        }

        // Don't forget the last value
        if (current.trim()) {
          values.push(current.trim().replace(/^'|'$/g, ''));
        }

        // We expect 15 values: id, user_id, name, tiktok_link, spark_code, offer, offer_name, thumbnail, status, traffic, created_at, updated_at, team_id, creator, type
        if (values.length !== 15) {
          errors.push({
            line: index + 1,
            error: `Expected 15 values, got ${values.length}`
          });
          return;
        }

        const rawSpark = {
          id: values[0],
          user_id: values[1],
          name: values[2],
          tiktok_link: values[3],
          spark_code: values[4],
          offer: values[5],
          offer_name: values[6],
          thumbnail: values[7],
          status: values[8],
          traffic: values[9],
          created_at: values[10],
          updated_at: values[11],
          team_id: values[12],
          creator: values[13],
          type: values[14]
        };

        const cleanedSpark = cleanSparkData(rawSpark);
        const validationErrors = validateSparkData(cleanedSpark);

        // Debug first few items (commented out for production)
        // if (index < 2) {
        //   console.log(`Debug line ${index + 1}:`);
        //   console.log('  Raw spark data:', {
        //     id: rawSpark.id,
        //     name: rawSpark.name,
        //     tiktok_link: rawSpark.tiktok_link,
        //     spark_code: rawSpark.spark_code
        //   });
        //   console.log('  Cleaned spark:', {
        //     id: cleanedSpark.id,
        //     name: cleanedSpark.name,
        //     tiktokLink: cleanedSpark.tiktokLink,
        //     sparkCode: cleanedSpark.sparkCode
        //   });
        //   console.log('  Validation errors:', validationErrors);
        // }

        if (validationErrors.length === 0) {
          sparks.push(cleanedSpark);
        } else {
          errors.push({
            line: index + 1,
            id: rawSpark.id,
            errors: validationErrors
          });
        }
      } catch (parseError) {
        errors.push({
          line: index + 1,
          error: parseError.message
        });
      }
    });

    console.log(`Successfully parsed ${sparks.length} valid sparks`);
    if (errors.length > 0) {
      console.log(`Found ${errors.length} parsing errors:`);
      errors.slice(0, 5).forEach(err => console.log('  -', err));
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    }

    return { sparks, errors };
  } catch (error) {
    console.error('Error reading backup file:', error);
    return { sparks: [], errors: [{ error: error.message }] };
  }
}

// API functions
async function clearRemoteSparks() {
  console.log('🗑️  Clearing remote sparks table...');

  try {
    // First, get all sparks to know what we're clearing
    const listResponse = await fetch(`${API_BASE_URL}?limit=1000`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list sparks: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const sparks = listData.sparks || [];

    console.log(`Found ${sparks.length} sparks to delete`);

    // Delete each spark individually
    let deletedCount = 0;
    for (const spark of sparks) {
      try {
        const deleteResponse = await fetch(`${API_BASE_URL}/${spark.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (deleteResponse.ok) {
          deletedCount++;
          if (deletedCount % 10 === 0) {
            console.log(`Deleted ${deletedCount}/${sparks.length} sparks...`);
          }
        } else {
          console.error(`Failed to delete spark ${spark.id}: ${deleteResponse.status}`);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (deleteError) {
        console.error(`Error deleting spark ${spark.id}:`, deleteError.message);
      }
    }

    console.log(`✅ Successfully deleted ${deletedCount} sparks`);
    return deletedCount;
  } catch (error) {
    console.error('Error clearing remote sparks:', error);
    throw error;
  }
}

async function pushSparkToRemote(sparkData) {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(sparkData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to push spark ${sparkData.id}: ${error.message}`);
  }
}

async function pushAllSparks(sparks) {
  console.log(`📤 Pushing ${sparks.length} sparks to remote...`);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < sparks.length; i++) {
    const spark = sparks[i];

    try {
      await pushSparkToRemote(spark);
      results.success++;

      if ((i + 1) % 20 === 0) {
        console.log(`Pushed ${i + 1}/${sparks.length} sparks...`);
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      results.failed++;
      results.errors.push({
        sparkId: spark.id,
        sparkName: spark.name,
        error: error.message
      });

      console.error(`Failed to push spark ${spark.id} (${spark.name}): ${error.message}`);
    }
  }

  return results;
}

// Main migration function
async function runMigration(dryRun = false) {
  console.log('🚀 Starting database migration...\n');

  try {
    // Step 1: Parse and clean backup data
    console.log('📋 Step 1: Parsing backup file...');
    const { sparks, errors } = parseSqlBackup(BACKUP_FILE);

    if (sparks.length === 0) {
      console.error('❌ No valid sparks found in backup file');
      return;
    }

    console.log(`✅ Found ${sparks.length} valid sparks to migrate\n`);

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No actual migration will be performed');
      console.log('\n📊 Migration Preview:');
      console.log(`✅ Would migrate: ${sparks.length} sparks`);
      console.log(`❌ Parsing errors: ${errors.length} items`);

      console.log('\n📋 Sample sparks that would be migrated:');
      sparks.slice(0, 5).forEach((spark, index) => {
        console.log(`  ${index + 1}. ${spark.name} (${spark.id}) - Status: ${spark.status}`);
      });

      if (sparks.length > 5) {
        console.log(`  ... and ${sparks.length - 5} more sparks`);
      }

      console.log('\n✨ Run without --dry-run flag to execute the migration');
      return;
    }

    // Step 2: Clear remote database
    console.log('🗑️  Step 2: Clearing remote database...');
    await clearRemoteSparks();
    console.log('✅ Remote database cleared\n');

    // Step 3: Push cleaned data
    console.log('📤 Step 3: Pushing cleaned data to remote...');
    const results = await pushAllSparks(sparks);

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${results.success} sparks`);
    console.log(`❌ Failed migrations: ${results.failed} sparks`);

    if (results.errors.length > 0) {
      console.log('\n❌ Migration Errors:');
      results.errors.slice(0, 10).forEach(err => {
        console.log(`  - ${err.sparkId} (${err.sparkName}): ${err.error}`);
      });

      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more errors`);
      }
    }

    if (results.success > 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with errors');
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  runMigration(dryRun);
}

export { runMigration, parseSqlBackup, cleanSparkData };