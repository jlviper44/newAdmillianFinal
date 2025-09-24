/**
 * CommentBotQueue.js - Queue management system for comment bot jobs
 * 
 * This module handles:
 * - Job creation and persistence
 * - Queue management with rate limiting
 * - Background job processing
 * - Status tracking and updates
 */

import { executeQuery } from '../sql/sql.controller.js';

/**
 * Job states
 */
export const JOB_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Queue configuration
 */
const QUEUE_CONFIG = {
  maxConcurrentJobs: 1, // Process one job at a time
  jobTimeout: 60000, // 1 minute
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  cleanupAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  pollInterval: 5000 // 5 seconds for status checks
};

/**
 * Initialize queue tables if they don't exist
 * @param {Object} env - Environment bindings
 */
export async function initializeQueueTables(env) {
  try {
    // Create job_queue table
    await env.COMMENT_BOT_DB.prepare(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        team_id VARCHAR(255),
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        queue_position INTEGER,
        priority INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        result TEXT,
        error TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indices for efficient queries
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_queue_job_id ON job_queue(job_id)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_queue_user_id ON job_queue(user_id)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_queue_team_id ON job_queue(team_id)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_queue_created_at ON job_queue(created_at)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_queue_priority_status ON job_queue(priority DESC, status, created_at)
    `).run();
    
    // Create job_logs table for detailed tracking
    await env.COMMENT_BOT_DB.prepare(`
      CREATE TABLE IF NOT EXISTS job_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES job_queue(job_id)
      )
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id)
    `).run();
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a unique job ID
 * @returns {string} - Unique job ID
 */
function generateJobId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `job_${timestamp}_${random}`;
}

/**
 * Add a job to the queue
 * @param {Object} env - Environment bindings
 * @param {Object} jobData - Job data
 * @returns {Promise<Object>} - Created job
 */
export async function createJob(env, jobData) {
  try {
    const jobId = generateJobId();
    
    // Get current queue position
    const positionQuery = `
      SELECT COUNT(*) as position 
      FROM job_queue 
      WHERE status IN ('pending', 'processing')
    `;
    const positionResult = await executeQuery(env.COMMENT_BOT_DB, positionQuery, []);
    const queuePosition = positionResult.success ? positionResult.data[0].position + 1 : 1;
    
    // Insert job into queue
    const insertQuery = `
      INSERT INTO job_queue (
        job_id, user_id, team_id, type, payload, status, 
        queue_position, priority, max_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const payload = JSON.stringify(jobData.payload);
    const priority = jobData.priority || 0;
    const maxAttempts = jobData.maxAttempts || QUEUE_CONFIG.retryAttempts;
    
    await env.COMMENT_BOT_DB.prepare(insertQuery)
      .bind(
        jobId,
        jobData.userId,
        jobData.teamId || null,
        jobData.type,
        payload,
        JOB_STATES.PENDING,
        queuePosition,
        priority,
        maxAttempts
      )
      .run();
    
    // Log job creation
    await addJobLog(env, jobId, 'info', 'Job created and added to queue', {
      position: queuePosition,
      type: jobData.type
    });
    
    // Return the created job
    const job = await getJob(env, jobId);
    return job;
  } catch (error) {
    throw error;
  }
}

/**
 * Get a specific job by ID
 * @param {Object} env - Environment bindings
 * @param {string} jobId - Job ID
 * @param {string} userId - User ID (optional, for access control)
 * @param {string} teamId - Team ID (optional, for access control)
 * @returns {Promise<Object|null>} - Job data or null
 */
export async function getJob(env, jobId, userId = null, teamId = null) {
  try {
    let query = `
      SELECT * FROM job_queue 
      WHERE job_id = ?
    `;
    let params = [jobId];
    
    // Add access control if userId is provided
    if (userId) {
      if (teamId) {
        query += ` AND (user_id = ? OR team_id = ?)`;
        params.push(userId, teamId);
      } else {
        query += ` AND user_id = ?`;
        params.push(userId);
      }
    }
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, params);
    
    if (!result.success || result.data.length === 0) {
      return null;
    }
    
    const job = result.data[0];
    
    // Parse JSON fields
    try {
      job.payload = JSON.parse(job.payload);
    } catch (e) {
    }
    
    if (job.result) {
      try {
        job.result = JSON.parse(job.result);
      } catch (e) {
      }
    }
    
    // Calculate estimated completion time if job is pending
    if (job.status === JOB_STATES.PENDING) {
      const avgTimeQuery = `
        SELECT AVG(
          CAST((julianday(completed_at) - julianday(started_at)) * 86400 AS INTEGER)
        ) as avg_time
        FROM job_queue
        WHERE status = 'completed' 
        AND completed_at IS NOT NULL 
        AND started_at IS NOT NULL
        AND type = ?
      `;
      const avgResult = await executeQuery(env.COMMENT_BOT_DB, avgTimeQuery, [job.type]);
      
      if (avgResult.success && avgResult.data[0].avg_time) {
        const avgSeconds = avgResult.data[0].avg_time;
        const estimatedSeconds = avgSeconds * (job.queue_position || 1);
        job.estimatedCompletionTime = new Date(Date.now() + estimatedSeconds * 1000).toISOString();
      }
    }
    
    return job;
  } catch (error) {
    return null;
  }
}

/**
 * Get jobs for a user or team
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID (optional)
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - List of jobs
 */
export async function getUserJobs(env, userId, teamId = null, filters = {}) {
  
  try {
    let query = `
      SELECT * FROM job_queue 
      WHERE 1=1
    `;
    let params = [];
    
    // Add user/team filter
    if (teamId) {
      query += ` AND (user_id = ? OR team_id = ?)`;
      params.push(userId, teamId);
    } else {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    
    // Add status filter
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    
    // Add type filter
    if (filters.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }
    
    // Add date range filter
    if (filters.startDate) {
      query += ` AND created_at >= ?`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ` AND created_at <= ?`;
      params.push(filters.endDate);
    }
    
    // Add ordering and pagination
    query += ` ORDER BY created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, params);
    
    if (!result.success) {
      return [];
    }
    
    // Parse JSON fields for each job
    const jobs = result.data.map(job => {
      try {
        job.payload = JSON.parse(job.payload);
      } catch (e) {
      }
      
      if (job.result) {
        try {
          job.result = JSON.parse(job.result);
        } catch (e) {
        }
      }
      
      return job;
    });
    
    return jobs;
  } catch (error) {
    return [];
  }
}

/**
 * Update job status
 * @param {Object} env - Environment bindings
 * @param {string} jobId - Job ID
 * @param {string} status - New status
 * @param {Object} updates - Additional updates
 * @returns {Promise<boolean>} - Success status
 */
export async function updateJobStatus(env, jobId, status, updates = {}) {
  try {
    let updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    let params = [status];
    
    // Add started_at for processing jobs
    if (status === JOB_STATES.PROCESSING && !updates.started_at) {
      updateFields.push('started_at = CURRENT_TIMESTAMP');
    }
    
    // Add completed_at for completed/failed jobs
    if ((status === JOB_STATES.COMPLETED || status === JOB_STATES.FAILED) && !updates.completed_at) {
      updateFields.push('completed_at = CURRENT_TIMESTAMP');
    }
    
    // Add result if provided
    if (updates.result !== undefined) {
      updateFields.push('result = ?');
      params.push(JSON.stringify(updates.result));
    }
    
    // Add error if provided
    if (updates.error !== undefined) {
      updateFields.push('error = ?');
      params.push(updates.error);
    }
    
    // Add attempts if provided
    if (updates.attempts !== undefined) {
      updateFields.push('attempts = ?');
      params.push(updates.attempts);
    }
    
    // Update queue position for pending jobs
    if (status === JOB_STATES.PENDING && updates.queuePosition !== undefined) {
      updateFields.push('queue_position = ?');
      params.push(updates.queuePosition);
    }
    
    params.push(jobId);
    
    const updateQuery = `
      UPDATE job_queue 
      SET ${updateFields.join(', ')}
      WHERE job_id = ?
    `;
    
    await env.COMMENT_BOT_DB.prepare(updateQuery).bind(...params).run();
    
    // Log status change
    await addJobLog(env, jobId, 'info', `Job status changed to ${status}`, updates);
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Add a log entry for a job
 * @param {Object} env - Environment bindings
 * @param {string} jobId - Job ID
 * @param {string} level - Log level (info, warning, error)
 * @param {string} message - Log message
 * @param {Object} details - Additional details
 * @returns {Promise<boolean>} - Success status
 */
export async function addJobLog(env, jobId, level, message, details = null) {
  try {
    const insertQuery = `
      INSERT INTO job_logs (job_id, level, message, details)
      VALUES (?, ?, ?, ?)
    `;
    
    await env.COMMENT_BOT_DB.prepare(insertQuery)
      .bind(jobId, level, message, details ? JSON.stringify(details) : null)
      .run();
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get logs for a specific job
 * @param {Object} env - Environment bindings
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} - List of log entries
 */
export async function getJobLogs(env, jobId) {
  try {
    const query = `
      SELECT * FROM job_logs 
      WHERE job_id = ?
      ORDER BY created_at ASC
    `;
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, [jobId]);
    
    if (!result.success) {
      return [];
    }
    
    // Parse details field
    return result.data.map(log => {
      if (log.details) {
        try {
          log.details = JSON.parse(log.details);
        } catch (e) {
        }
      }
      return log;
    });
  } catch (error) {
    return [];
  }
}

/**
 * Get the next job to process from the queue
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object|null>} - Next job or null
 */
export async function getNextJob(env) {
  try {
    // First, check for stuck jobs (processing for more than 5 minutes)
    // Increased from 1 minute to 5 minutes to allow jobs to complete properly
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const stuckJobsQuery = `
      UPDATE job_queue
      SET status = 'failed',
          error = 'Job timed out after 5 minutes',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'processing'
      AND started_at < ?
    `;

    const stuckResult = await env.COMMENT_BOT_DB.prepare(stuckJobsQuery)
      .bind(fiveMinutesAgo)
      .run();
    
    
    // Check if we're at max concurrent jobs
    const activeQuery = `
      SELECT COUNT(*) as count 
      FROM job_queue 
      WHERE status = 'processing'
    `;
    const activeResult = await executeQuery(env.COMMENT_BOT_DB, activeQuery, []);
    
    if (activeResult.success && activeResult.data[0].count >= QUEUE_CONFIG.maxConcurrentJobs) {
      return null; // At capacity
    }
    
    // Get next pending job by priority and creation time
    const nextJobQuery = `
      SELECT * FROM job_queue 
      WHERE status = 'pending' 
      AND attempts < max_attempts
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `;
    
    const result = await executeQuery(env.COMMENT_BOT_DB, nextJobQuery, []);
    
    if (!result.success || result.data.length === 0) {
      return null;
    }
    
    const job = result.data[0];
    
    // Parse payload
    try {
      job.payload = JSON.parse(job.payload);
    } catch (e) {
      return null;
    }
    
    return job;
  } catch (error) {
    return null;
  }
}

/**
 * Update queue positions for pending jobs
 * @param {Object} env - Environment bindings
 * @returns {Promise<boolean>} - Success status
 */
export async function updateQueuePositions(env) {
  try {
    // Get all pending jobs ordered by priority and creation time
    const query = `
      SELECT job_id 
      FROM job_queue 
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC
    `;
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, []);
    
    if (!result.success) {
      return false;
    }
    
    // Update positions
    for (let i = 0; i < result.data.length; i++) {
      const updateQuery = `
        UPDATE job_queue 
        SET queue_position = ?, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `;
      
      await env.COMMENT_BOT_DB.prepare(updateQuery)
        .bind(i + 1, result.data[i].job_id)
        .run();
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Clean up old completed jobs
 * @param {Object} env - Environment bindings
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<number>} - Number of cleaned jobs
 */
export async function cleanupOldJobs(env, maxAge = QUEUE_CONFIG.cleanupAge) {
  try {
    const cutoffDate = new Date(Date.now() - maxAge).toISOString();
    
    // Delete old job logs first
    const deleteLogsQuery = `
      DELETE FROM job_logs 
      WHERE job_id IN (
        SELECT job_id FROM job_queue 
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at < ?
      )
    `;
    
    await env.COMMENT_BOT_DB.prepare(deleteLogsQuery).bind(cutoffDate).run();
    
    // Delete old jobs
    const deleteJobsQuery = `
      DELETE FROM job_queue 
      WHERE status IN ('completed', 'failed', 'cancelled')
      AND completed_at < ?
    `;
    
    const result = await env.COMMENT_BOT_DB.prepare(deleteJobsQuery).bind(cutoffDate).run();
    
    return result.meta.changes || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Cancel a job
 * @param {Object} env - Environment bindings
 * @param {string} jobId - Job ID
 * @param {string} userId - User ID (for access control)
 * @param {string} teamId - Team ID (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function cancelJob(env, jobId, userId, teamId = null) {
  try {
    // Verify ownership and status
    const job = await getJob(env, jobId, userId, teamId);
    
    if (!job) {
      return false;
    }
    
    if (job.status !== JOB_STATES.PENDING && job.status !== JOB_STATES.PROCESSING) {
      return false; // Can't cancel completed/failed jobs
    }
    
    // Update status to cancelled
    await updateJobStatus(env, jobId, JOB_STATES.CANCELLED, {
      error: 'Job cancelled by user'
    });
    
    // Update queue positions
    await updateQueuePositions(env);
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get queue statistics
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} - Queue statistics
 */
export async function getQueueStats(env) {
  try {
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(*) as total,
        AVG(CASE 
          WHEN status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL 
          THEN CAST((julianday(completed_at) - julianday(started_at)) * 86400 AS INTEGER)
          ELSE NULL 
        END) as avg_processing_time
      FROM job_queue
      WHERE created_at >= datetime('now', '-24 hours')
    `;
    
    const result = await executeQuery(env.COMMENT_BOT_DB, statsQuery, []);
    
    if (!result.success || result.data.length === 0) {
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
        avgProcessingTime: 0
      };
    }
    
    const stats = result.data[0];
    stats.avgProcessingTime = Math.round(stats.avg_processing_time || 0);
    delete stats.avg_processing_time;
    
    return stats;
  } catch (error) {
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
      avgProcessingTime: 0
    };
  }
}