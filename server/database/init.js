import sessionsSchema from './schemas/sessions.sql?raw';
import bcgenSchema from './schemas/bcgen.sql?raw';
import linkSplitterSchema from './schemas/link-splitter.sql?raw';
import linkSplitterAnalyticsSchema from './schemas/link-splitter-analytics.sql?raw';
import linkSplitterAdvancedAnalyticsSchema from './schemas/link-splitter-advanced-analytics-fixed.sql?raw';
import paymentSettingsSchema from './schemas/payment-settings.sql?raw';

const SCHEMAS = {
  USERS_DB: [
    { name: 'sessions', sql: sessionsSchema }
  ],
  DASHBOARD_DB: [
    { name: 'bcgen', sql: bcgenSchema },
    { name: 'link-splitter', sql: linkSplitterSchema },
    { name: 'link-splitter-analytics', sql: linkSplitterAnalyticsSchema },
    { name: 'link-splitter-advanced-analytics', sql: linkSplitterAdvancedAnalyticsSchema },
    { name: 'payment-settings', sql: paymentSettingsSchema }
  ]
};

async function executeSchema(db, schemaSql) {
  try {
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await db.prepare(statement).run();
    }
  } catch (error) {
  }
}

export async function initializeDatabaseSchemas(env) {
  if (env.USERS_DB) {
    for (const schema of SCHEMAS.USERS_DB) {
      await executeSchema(env.USERS_DB, schema.sql);
    }
  }

  if (env.DASHBOARD_DB) {
    for (const schema of SCHEMAS.DASHBOARD_DB) {
      await executeSchema(env.DASHBOARD_DB, schema.sql);
    }
  }

  if (env.COMMENT_BOT_DB) {
    const { initializeQueueTables } = await import('../features/comment-bot/comment-bot-queue.service.js');
    await initializeQueueTables(env);
  }
}

export async function ensureTablesExist(env) {
  const { initializeAuthTables } = await import('../Auth/Auth.js');
  await initializeAuthTables(env);

  await initializeDatabaseSchemas(env);

  // Initialize sparks table with migrations
  if (env.DASHBOARD_DB) {
    try {
      const { initializeSparksTable } = await import('../features/sparks/sparks.controller.js');
      await initializeSparksTable(env.DASHBOARD_DB);
      console.log('Sparks table initialization completed in database init');
    } catch (error) {
      console.error('Failed to initialize sparks table in database init:', error);
    }
  }
}