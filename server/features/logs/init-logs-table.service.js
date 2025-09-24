export async function initializeLogsTable(env) {
  const LOGS_DB = env.LOGS_DB;
  
  if (!LOGS_DB) {
    console.error('LOGS_DB not found in environment');
    return false;
  }

  try {
    // Create the logs table if it doesn't exist
    await LOGS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaignId TEXT NOT NULL,
        campaignName TEXT,
        launchNumber INTEGER NOT NULL,
        type TEXT NOT NULL,
        decision TEXT NOT NULL,
        ip TEXT,
        country TEXT,
        region TEXT,
        city TEXT,
        timezone TEXT,
        continent TEXT,
        timestamp TEXT NOT NULL,
        userAgent TEXT,
        referer TEXT,
        url TEXT,
        redirectUrl TEXT,
        os TEXT,
        params TEXT,
        tags TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create indexes for better query performance
    await LOGS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_campaign 
      ON logs(campaignId, launchNumber)
    `).run();

    await LOGS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_timestamp 
      ON logs(timestamp)
    `).run();

    await LOGS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_type_decision 
      ON logs(type, decision)
    `).run();

    await LOGS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_created_at 
      ON logs(created_at)
    `).run();

    console.log('Logs table initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing logs table:', error);
    return false;
  }
}