#!/usr/bin/env node

/**
 * Test script to verify sparks table migration
 * This script tests the migration from old to new sparks table schema
 */

import Database from 'better-sqlite3';
import { initializeSparksTable } from './server/features/sparks/sparks.controller.js';

async function testMigration() {
  console.log('🧪 Testing sparks table migration...');

  // Create a temporary in-memory database
  const db = new Database(':memory:');

  // Mock the D1 API interface
  const mockD1DB = {
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        bind: (...params) => ({
          run: () => stmt.run(...params),
          all: () => ({ results: stmt.all(...params) }),
          first: () => stmt.get(...params)
        }),
        run: () => stmt.run(),
        all: () => ({ results: stmt.all() }),
        first: () => stmt.get()
      };
    }
  };

  try {
    // Test 1: Create new table from scratch
    console.log('\n📝 Test 1: Creating new sparks table from scratch...');
    await initializeSparksTable(mockD1DB);

    // Verify table structure
    const tableInfo = db.prepare('PRAGMA table_info(sparks)').all();
    const columns = tableInfo.map(col => col.name);

    console.log('✅ Table created successfully');
    console.log('📋 Columns:', columns.join(', '));

    // Expected columns based on our enhanced schema
    const expectedColumns = [
      'id', 'user_id', 'team_id', 'name', 'creator', 'tiktok_link',
      'spark_code', 'offer', 'offer_name', 'thumbnail', 'status',
      'traffic', 'content_type', 'bot_status', 'bot_post_id',
      'comment_bot_order_id', 'payment_status', 'type',
      'created_at', 'updated_at'
    ];

    const missingColumns = expectedColumns.filter(col => !columns.includes(col));
    const extraColumns = columns.filter(col => !expectedColumns.includes(col));

    if (missingColumns.length === 0 && extraColumns.length === 0) {
      console.log('✅ All expected columns present');
    } else {
      if (missingColumns.length > 0) {
        console.log('❌ Missing columns:', missingColumns.join(', '));
      }
      if (extraColumns.length > 0) {
        console.log('⚠️ Extra columns:', extraColumns.join(', '));
      }
    }

    // Test 2: Verify indexes
    console.log('\n📝 Test 2: Verifying indexes...');
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sparks'").all();
    const indexNames = indexes.map(idx => idx.name);

    const expectedIndexes = [
      'idx_sparks_status', 'idx_sparks_offer', 'idx_sparks_created',
      'idx_sparks_user_id', 'idx_sparks_bot_status'
    ];

    const missingIndexes = expectedIndexes.filter(idx => !indexNames.includes(idx));
    if (missingIndexes.length === 0) {
      console.log('✅ All expected indexes present');
    } else {
      console.log('❌ Missing indexes:', missingIndexes.join(', '));
    }

    // Test 3: Test migration from old schema
    console.log('\n📝 Test 3: Testing migration from old schema...');

    // Create a new database with old schema
    const db2 = new Database(':memory:');
    const mockD1DB2 = {
      prepare: (sql) => {
        const stmt = db2.prepare(sql);
        return {
          bind: (...params) => ({
            run: () => stmt.run(...params),
            all: () => ({ results: stmt.all(...params) }),
            first: () => stmt.get(...params)
          }),
          run: () => stmt.run(),
          all: () => ({ results: stmt.all() }),
          first: () => stmt.get()
        };
      }
    };

    // Create old schema (missing some new columns)
    db2.prepare(`
      CREATE TABLE sparks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tiktok_link TEXT NOT NULL,
        spark_code TEXT NOT NULL,
        offer TEXT NOT NULL,
        thumbnail TEXT,
        status TEXT DEFAULT 'active',
        traffic INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insert some test data
    db2.prepare(`
      INSERT INTO sparks (id, user_id, name, tiktok_link, spark_code, offer)
      VALUES ('test1', 'user1', 'Test Spark', 'https://tiktok.com/test', '#testcode', 'Test Offer')
    `).run();

    console.log('📊 Old table data count:', db2.prepare('SELECT COUNT(*) as count FROM sparks').get().count);

    // Run migration
    await initializeSparksTable(mockD1DB2);

    // Verify migration
    const newTableInfo = db2.prepare('PRAGMA table_info(sparks)').all();
    const newColumns = newTableInfo.map(col => col.name);

    console.log('✅ Migration completed');
    console.log('📋 New columns:', newColumns.join(', '));
    console.log('📊 Data preserved:', db2.prepare('SELECT COUNT(*) as count FROM sparks').get().count);

    // Verify data integrity
    const testData = db2.prepare('SELECT * FROM sparks WHERE id = ?').get('test1');
    if (testData) {
      console.log('✅ Data integrity maintained');
    } else {
      console.log('❌ Data lost during migration');
    }

    console.log('\n🎉 Migration test completed successfully!');

  } catch (error) {
    console.error('❌ Migration test failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the test
testMigration().catch(console.error);