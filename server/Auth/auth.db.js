async function initializeAuthTables(env) {
  try {
    await env.USERS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_data TEXT NOT NULL,
        state VARCHAR(255),
        access_token TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
      ON sessions(expires_at)
    `).run();

    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id
      ON sessions(user_id)
    `).run();

    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at
      ON sessions(created_at)
    `).run();

    await env.USERS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS virtual_assistants (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        has_comment_bot_access BOOLEAN DEFAULT 0,
        has_dashboard_access BOOLEAN DEFAULT 0,
        has_bc_gen_access BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `).run();

    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_virtual_assistants_user_id
      ON virtual_assistants(user_id)
    `).run();

    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_virtual_assistants_expires_at
      ON virtual_assistants(expires_at)
    `).run();

    await migrateVirtualAssistantsRoles(env);
    await migrateDashboardPermissions(env);

    return true;
  } catch (error) {
    console.error('Error initializing auth tables:', error);
    return false;
  }
}

async function migrateVirtualAssistantsRoles(env) {
  try {
    const testQuery = `
      SELECT has_comment_bot_access, has_dashboard_access, has_bc_gen_access
      FROM virtual_assistants
      LIMIT 1
    `;

    try {
      await env.USERS_DB.prepare(testQuery).first();
      return;
    } catch (error) {
      console.log('Migrating virtual_assistants table to add role columns...');

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN has_comment_bot_access BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN has_dashboard_access BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN has_bc_gen_access BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      await env.USERS_DB.prepare(`
        UPDATE virtual_assistants
        SET has_comment_bot_access = 1,
            has_dashboard_access = 1,
            has_bc_gen_access = 1
        WHERE has_comment_bot_access IS NULL
           OR has_dashboard_access IS NULL
           OR has_bc_gen_access IS NULL
      `).run();

      console.log('Virtual assistants migration completed successfully');
    }
  } catch (error) {
    console.error('Error during virtual assistants migration:', error);
  }
}

async function migrateDashboardPermissions(env) {
  try {
    const testQuery = `
      SELECT dashboard_metrics, dashboard_campaigns, dashboard_launches, dashboard_sparks,
             dashboard_templates, dashboard_shopify, dashboard_logs
      FROM virtual_assistants
      LIMIT 1
    `;

    try {
      await env.USERS_DB.prepare(testQuery).first();
      return;
    } catch (error) {
      console.log('Migrating virtual_assistants table to add granular Dashboard permissions...');

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_metrics BOOLEAN DEFAULT 0
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_campaigns BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_launches BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_sparks BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_templates BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_shopify BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_logs BOOLEAN DEFAULT 0
        `).run();
      } catch (e) {
      }

      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants
          ADD COLUMN dashboard_link_splitter BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
      }

      await env.USERS_DB.prepare(`
        UPDATE virtual_assistants
        SET dashboard_metrics = 0,
            dashboard_campaigns = CASE WHEN has_dashboard_access = 1 THEN 1 ELSE 0 END,
            dashboard_launches = CASE WHEN has_dashboard_access = 1 THEN 1 ELSE 0 END,
            dashboard_sparks = CASE WHEN has_dashboard_access = 1 THEN 1 ELSE 0 END,
            dashboard_templates = CASE WHEN has_dashboard_access = 1 THEN 1 ELSE 0 END,
            dashboard_shopify = CASE WHEN has_dashboard_access = 1 THEN 1 ELSE 0 END,
            dashboard_logs = 0,
            dashboard_link_splitter = CASE WHEN has_dashboard_access = 1 THEN 1 ELSE 0 END
        WHERE dashboard_campaigns IS NULL
           OR dashboard_launches IS NULL
           OR dashboard_sparks IS NULL
           OR dashboard_templates IS NULL
           OR dashboard_shopify IS NULL
           OR dashboard_metrics IS NULL
           OR dashboard_logs IS NULL
           OR dashboard_link_splitter IS NULL
      `).run();

      console.log('Dashboard permissions migration completed successfully');
    }
  } catch (error) {
    console.error('Error during Dashboard permissions migration:', error);
  }
}

export { initializeAuthTables, migrateVirtualAssistantsRoles, migrateDashboardPermissions };