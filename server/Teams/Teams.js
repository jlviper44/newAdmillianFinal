// Teams.js - Team management system
import { executeQuery } from '../SQL/SQL.js';
import { isAdminUser } from '../Auth/Auth.js';

/**
 * Initialize teams tables in D1 database
 * @param {Object} env - Environment bindings with DB
 */
async function initializeTeamsTables(env) {
  try {
    // Create teams table in USERS_DB
    await env.USERS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create team_members table to track user-team relationships
    await env.USERS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_name TEXT,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `).run();
    
    // Create indices for better performance
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_team_members_team_id 
      ON team_members(team_id)
    `).run();
    
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_team_members_user_id 
      ON team_members(user_id)
    `).run();
    
    // Add team_id column to sessions table if it doesn't exist
    await env.USERS_DB.prepare(`
      ALTER TABLE sessions ADD COLUMN team_id TEXT
    `).run().catch(() => {
      // Column might already exist
    });
    
    // Add owner_id column to teams table if it doesn't exist
    await env.USERS_DB.prepare(`
      ALTER TABLE teams ADD COLUMN owner_id TEXT
    `).run().catch(() => {
      // Column might already exist
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing teams tables:', error);
    return false;
  }
}

/**
 * Get user ID from session
 */
async function getUserIdFromSession(request, env) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  
  const sessionId = cookie.split('session=')[1]?.split(';')[0];
  if (!sessionId) return null;
  
  const session = await env.USERS_DB.prepare(
    'SELECT user_id, user_data FROM sessions WHERE session_id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first();
  
  if (session) {
    const userData = JSON.parse(session.user_data);
    return {
      userId: session.user_id,
      userEmail: userData.email,
      userName: userData.name
    };
  }
  
  return null;
}

/**
 * Look up user by email from sessions
 */
async function getUserByEmail(env, email) {
  if (!email) return null;
  
  try {
    // Get the most recent session for a user with this email
    const query = `
      SELECT user_id, user_data
      FROM sessions 
      WHERE json_extract(user_data, '$.email') = ? 
      AND expires_at > datetime('now')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await env.USERS_DB.prepare(query).bind(email.toLowerCase()).first();
    
    if (result) {
      const userData = JSON.parse(result.user_data);
      return {
        userId: result.user_id,
        userEmail: userData.email,
        userName: userData.name
      };
    }
  } catch (error) {
    console.error('Error looking up user by email:', error);
  }
  
  return null;
}

/**
 * Get all teams (admin only)
 */
async function handleGetAllTeams(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get all teams with member count
    const query = `
      SELECT 
        t.*,
        COUNT(tm.id) as member_count,
        GROUP_CONCAT(
          json_object(
            'id', tm.user_id,
            'email', tm.user_email,
            'name', tm.user_name,
            'role', tm.role
          )
        ) as members_json
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;
    
    const result = await executeQuery(env.USERS_DB, query);
    
    if (result.success) {
      // Parse members JSON for each team
      const teams = result.data.map(team => ({
        ...team,
        members: team.members_json ? JSON.parse(`[${team.members_json}]`) : []
      }));
      
      return new Response(JSON.stringify({ teams }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to fetch teams' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get user's team
 */
async function handleGetUserTeam(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get user's team
    const query = `
      SELECT 
        t.*,
        tm.role as user_role,
        COUNT(tm2.id) as member_count
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      LEFT JOIN team_members tm2 ON t.id = tm2.team_id
      WHERE tm.user_id = ?
      GROUP BY t.id, tm.role
    `;
    
    const result = await executeQuery(env.USERS_DB, query, [userInfo.userId]);
    
    if (result.success && result.data.length > 0) {
      const team = result.data[0];
      
      // Get all team members
      const membersQuery = `
        SELECT user_id, user_email, user_name, role, joined_at
        FROM team_members
        WHERE team_id = ?
        ORDER BY joined_at ASC
      `;
      
      const membersResult = await executeQuery(env.USERS_DB, membersQuery, [team.id]);
      
      return new Response(JSON.stringify({ 
        team: {
          ...team,
          members: membersResult.success ? membersResult.data : []
        },
        isAdmin: isAdminUser(userInfo.userEmail)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ team: null, isAdmin: isAdminUser(userInfo.userEmail) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching user team:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create a new team (admin only)
 */
async function handleCreateTeam(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { name, description, ownerEmail, memberEmails } = await request.json();
  
  if (!name) {
    return new Response(JSON.stringify({ error: 'Team name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine the owner - use provided email or default to creator
    let ownerId = userInfo.userId;
    let ownerEmail_ = userInfo.userEmail;
    let ownerName = userInfo.userName;
    
    // If owner email is provided and different from creator, look up that user
    if (ownerEmail && ownerEmail.trim()) {
      const ownerUser = await getUserByEmail(env, ownerEmail.trim());
      if (ownerUser) {
        ownerId = ownerUser.userId;
        ownerEmail_ = ownerUser.userEmail;
        ownerName = ownerUser.userName;
      } else {
        // User not found, return error
        return new Response(JSON.stringify({ 
          error: `User with email ${ownerEmail} not found or has not logged in yet` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Create team with the determined owner
    const createQuery = `
      INSERT INTO teams (id, name, description, owner_id, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(env.USERS_DB, createQuery, [
      teamId,
      name,
      description || null,
      ownerId,
      userInfo.userId
    ]);
    
    if (result.success) {
      // Add the owner as the first team member
      const addOwnerQuery = `
        INSERT INTO team_members (id, team_id, user_id, user_email, user_name, role)
        VALUES (?, ?, ?, ?, ?, 'owner')
      `;
      
      await executeQuery(env.USERS_DB, addOwnerQuery, [
        `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        teamId,
        ownerId,
        ownerEmail_,
        ownerName || null
      ]);
      
      // Process member emails if provided
      const addedMembers = [];
      const failedMembers = [];
      
      if (memberEmails) {
        // Parse emails from the textarea
        const emails = memberEmails
          .split(/[\n,]/)
          .map(email => email.trim().toLowerCase())
          .filter(email => email.length > 0 && email.includes('@'));
        
        // Remove duplicates and exclude owner email
        const uniqueEmails = [...new Set(emails)].filter(
          email => email !== ownerEmail_.toLowerCase()
        );
        
        for (const email of uniqueEmails) {
          // Look up user by email
          const userToAdd = await getUserByEmail(env, email);
          if (!userToAdd) {
            failedMembers.push({
              email,
              reason: 'User not found or has not logged in yet'
            });
            continue;
          }
          
          // Check if user is already in a team
          const checkQuery = 'SELECT team_id FROM team_members WHERE user_id = ?';
          const checkResult = await executeQuery(env.USERS_DB, checkQuery, [userToAdd.userId]);
          
          if (checkResult.success && checkResult.data.length > 0) {
            failedMembers.push({
              email,
              reason: 'User is already in another team'
            });
            continue;
          }
          
          // Add user to team
          const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const addMemberQuery = `
            INSERT INTO team_members (id, team_id, user_id, user_email, user_name, role)
            VALUES (?, ?, ?, ?, ?, 'member')
          `;
          
          const addResult = await executeQuery(env.USERS_DB, addMemberQuery, [
            memberId,
            teamId,
            userToAdd.userId,
            userToAdd.userEmail,
            userToAdd.userName || null
          ]);
          
          if (addResult.success) {
            addedMembers.push({
              email,
              name: userToAdd.userName || email
            });
          } else {
            failedMembers.push({
              email,
              reason: 'Failed to add to team'
            });
          }
        }
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        team: { id: teamId, name, description },
        memberResults: {
          added: addedMembers,
          failed: failedMembers
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to create team' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating team:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update team (admin only)
 */
async function handleUpdateTeam(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const teamId = url.pathname.split('/').pop();
  const { name, description } = await request.json();
  
  if (!name) {
    return new Response(JSON.stringify({ error: 'Team name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const updateQuery = `
      UPDATE teams 
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const result = await executeQuery(env.USERS_DB, updateQuery, [name, description || null, teamId]);
    
    if (result.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to update team' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating team:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Add user to team (admin only)
 */
async function handleAddTeamMember(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const teamId = url.pathname.split('/')[4]; // /api/teams/{teamId}/members
  const { userId, userEmail, userName } = await request.json();
  
  if (!userId || !userEmail) {
    return new Response(JSON.stringify({ error: 'User ID and email are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Check if user is already in a team
    const checkQuery = 'SELECT team_id FROM team_members WHERE user_id = ?';
    const checkResult = await executeQuery(env.USERS_DB, checkQuery, [userId]);
    
    if (checkResult.success && checkResult.data.length > 0) {
      return new Response(JSON.stringify({ error: 'User is already in a team' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Add user to team
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const addQuery = `
      INSERT INTO team_members (id, team_id, user_id, user_email, user_name, role)
      VALUES (?, ?, ?, ?, ?, 'member')
    `;
    
    const result = await executeQuery(env.USERS_DB, addQuery, [
      memberId,
      teamId,
      userId,
      userEmail,
      userName || null
    ]);
    
    if (result.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to add team member' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Remove user from team (admin only)
 */
async function handleRemoveTeamMember(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const userId = pathParts[pathParts.length - 1]; // /api/teams/{teamId}/members/{userId}
  
  try {
    const deleteQuery = 'DELETE FROM team_members WHERE user_id = ?';
    const result = await executeQuery(env.USERS_DB, deleteQuery, [userId]);
    
    if (result.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to remove team member' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Add multiple team members at once (admin only)
 */
async function handleBulkAddTeamMembers(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const teamId = url.pathname.split('/')[4]; // /api/teams/{teamId}/bulk-members
  const { emails } = await request.json();
  
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return new Response(JSON.stringify({ error: 'Email list is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const results = {
    added: [],
    failed: [],
    alreadyInTeam: []
  };
  
  try {
    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        results.failed.push({ email: trimmedEmail, reason: 'Invalid email format' });
        continue;
      }
      
      // Look up user by email
      const userToAdd = await getUserByEmail(env, trimmedEmail);
      if (!userToAdd) {
        results.failed.push({ 
          email: trimmedEmail, 
          reason: 'User not found or has not logged in yet' 
        });
        continue;
      }
      
      // Check if user is already in a team
      const checkQuery = 'SELECT team_id FROM team_members WHERE user_id = ?';
      const checkResult = await executeQuery(env.USERS_DB, checkQuery, [userToAdd.userId]);
      
      if (checkResult.success && checkResult.data.length > 0) {
        const existingTeamId = checkResult.data[0].team_id;
        if (existingTeamId === teamId) {
          results.alreadyInTeam.push({ email: trimmedEmail });
        } else {
          results.failed.push({ 
            email: trimmedEmail, 
            reason: 'User is already in another team' 
          });
        }
        continue;
      }
      
      // Add user to team
      const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const addQuery = `
        INSERT INTO team_members (id, team_id, user_id, user_email, user_name, role)
        VALUES (?, ?, ?, ?, ?, 'member')
      `;
      
      const addResult = await executeQuery(env.USERS_DB, addQuery, [
        memberId,
        teamId,
        userToAdd.userId,
        userToAdd.userEmail,
        userToAdd.userName || null
      ]);
      
      if (addResult.success) {
        results.added.push({ 
          email: trimmedEmail,
          name: userToAdd.userName || trimmedEmail
        });
      } else {
        results.failed.push({ 
          email: trimmedEmail, 
          reason: 'Failed to add to team' 
        });
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      results 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error bulk adding team members:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update team owner (admin only)
 */
async function handleUpdateTeamOwner(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const teamId = url.pathname.split('/')[4]; // /api/teams/{teamId}/owner
  const { ownerId } = await request.json();
  
  if (!ownerId) {
    return new Response(JSON.stringify({ error: 'Owner ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Verify the new owner is a member of the team
    const checkMemberQuery = 'SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ?';
    const checkResult = await executeQuery(env.USERS_DB, checkMemberQuery, [teamId, ownerId]);
    
    if (!checkResult.success || checkResult.data.length === 0) {
      return new Response(JSON.stringify({ error: 'New owner must be a team member' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update team owner
    const updateQuery = `
      UPDATE teams 
      SET owner_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const result = await executeQuery(env.USERS_DB, updateQuery, [ownerId, teamId]);
    
    if (result.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to update team owner' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating team owner:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Delete team (admin only)
 */
async function handleDeleteTeam(request, env) {
  const userInfo = await getUserIdFromSession(request, env);
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is admin
  if (!isAdminUser(userInfo.userEmail)) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const teamId = url.pathname.split('/').pop();
  
  try {
    // With the new model, we only need to clear team_id from items explicitly created for the team
    // Personal items remain with their creators automatically
    
    // Update comment groups that have team_id set - clear it
    const updateCommentGroupsQuery = `
      UPDATE comment_groups 
      SET team_id = NULL 
      WHERE team_id = ?
    `;
    await env.COMMENT_BOT_DB.prepare(updateCommentGroupsQuery)
      .bind(teamId)
      .run();
    
    // Update orders that have team_id set - clear it
    const updateOrdersQuery = `
      UPDATE orders 
      SET team_id = NULL 
      WHERE team_id = ?
    `;
    await env.COMMENT_BOT_DB.prepare(updateOrdersQuery)
      .bind(teamId)
      .run();
    
    // Delete team (cascade will delete team_members)
    const deleteQuery = 'DELETE FROM teams WHERE id = ?';
    const result = await executeQuery(env.USERS_DB, deleteQuery, [teamId]);
    
    if (result.success) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Team deleted. All team members retain their personal comment groups and orders.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Failed to delete team' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Main teams handler
 */
async function handleTeams(request, env) {
  // Initialize tables if needed
  await initializeTeamsTables(env);
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;
  
  // Handle OPTIONS requests
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }
  
  // Route to appropriate handler
  if (pathname === '/api/teams' && method === 'GET') {
    return handleGetAllTeams(request, env);
  } else if (pathname === '/api/teams/my-team' && method === 'GET') {
    return handleGetUserTeam(request, env);
  } else if (pathname === '/api/teams' && method === 'POST') {
    return handleCreateTeam(request, env);
  } else if (pathname.match(/^\/api\/teams\/[^\/]+$/) && method === 'PUT') {
    return handleUpdateTeam(request, env);
  } else if (pathname.match(/^\/api\/teams\/[^\/]+\/members$/) && method === 'POST') {
    return handleAddTeamMember(request, env);
  } else if (pathname.match(/^\/api\/teams\/[^\/]+\/bulk-members$/) && method === 'POST') {
    return handleBulkAddTeamMembers(request, env);
  } else if (pathname.match(/^\/api\/teams\/[^\/]+\/owner$/) && method === 'PUT') {
    return handleUpdateTeamOwner(request, env);
  } else if (pathname.match(/^\/api\/teams\/[^\/]+\/members\/[^\/]+$/) && method === 'DELETE') {
    return handleRemoveTeamMember(request, env);
  } else if (pathname.match(/^\/api\/teams\/[^\/]+$/) && method === 'DELETE') {
    return handleDeleteTeam(request, env);
  }
  
  return new Response('Not found', { status: 404 });
}

export { handleTeams };