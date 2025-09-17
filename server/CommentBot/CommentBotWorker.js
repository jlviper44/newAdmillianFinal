/**
 * CommentBotWorker.js - Worker for processing comment bot jobs from the queue
 * 
 * This module handles the actual execution of comment bot jobs
 * including API calls, retries, and status updates
 */

import { 
  getNextJob, 
  updateJobStatus, 
  addJobLog, 
  updateQueuePositions,
  JOB_STATES 
} from './CommentBotQueue.js';

// API Configuration (matching existing CommentBot.js)
const API_CONFIG = {
  baseUrl: 'https://tikhub.info',
  apiKey: 'mem'
};

// Worker configuration
const WORKER_CONFIG = {
  pollInterval: 5000, // 5 seconds between job checks
  maxProcessingTime: 60000, // 1 minute max per job
  retryDelay: 5000 // 5 seconds between retries
};

/**
 * Check if an order is truly complete by examining the progress details
 * @param {Object} statusResponse - The status response from the API
 * @returns {Object} - Object with isComplete boolean and details
 */
function checkOrderCompletion(statusResponse) {
  // If status indicates failure or cancellation, consider it complete
  if (statusResponse.status === 'failed' || statusResponse.status === 'canceled') {
    return {
      isComplete: true,
      actualStatus: statusResponse.status,
      details: {
        reason: `Order ${statusResponse.status}`
      }
    };
  }
  
  // If status is not 'completed', it's not done yet
  if (statusResponse.status !== 'completed') {
    return {
      isComplete: false,
      actualStatus: 'processing',
      details: {}
    };
  }
  
  // Status is 'completed', but we need to check the actual progress
  const progress = statusResponse.progress;
  
  if (!progress) {
    // No progress data, assume it's actually complete
    return {
      isComplete: true,
      actualStatus: 'completed',
      details: {
        warning: 'No progress data available'
      }
    };
  }
  
  // Check each interaction type
  const interactionTypes = ['like', 'save', 'comment'];
  let allComplete = true;
  let hasPartialFailure = false;
  let hasAnySuccess = false;
  let totalRequested = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let completionDetails = {};
  
  for (const type of interactionTypes) {
    const typeProgress = progress[type];
    
    if (typeProgress && typeProgress.total > 0) {
      // This interaction type was requested
      const completed = typeProgress.completed || 0;
      const failed = typeProgress.failed || 0;
      const remaining = typeProgress.remaining || 0;
      const total = typeProgress.total || 0;
      
      completionDetails[type] = {
        total: total,
        completed: completed,
        failed: failed,
        remaining: remaining,
        percent: typeProgress.percent || 0
      };
      
      // Track totals
      totalRequested += total;
      totalCompleted += completed;
      totalFailed += failed;
      
      // Check if there are any remaining items
      if (remaining > 0) {
        allComplete = false;
      }
      
      // Check if there were any successes
      if (completed > 0) {
        hasAnySuccess = true;
      }
      
      // Check if there were failures
      if (failed > 0) {
        hasPartialFailure = true;
      }
    }
  }
  
  // Determine the actual status based on results
  let actualStatus = 'completed';
  let isComplete = false;
  
  if (!allComplete) {
    // Still have remaining items to process
    actualStatus = 'processing';
    isComplete = false;
  } else if (totalCompleted === 0 && totalFailed > 0) {
    // Everything failed - this is a failed order
    actualStatus = 'failed';
    isComplete = true; // It's done, but failed
  } else if (hasPartialFailure && hasAnySuccess) {
    // Some succeeded, some failed
    actualStatus = 'completed_with_errors';
    isComplete = true;
  } else if (totalCompleted === totalRequested) {
    // Everything succeeded
    actualStatus = 'completed';
    isComplete = true;
  } else {
    // Edge case - no remaining but also no clear success/failure
    actualStatus = statusResponse.status;
    isComplete = statusResponse.status === 'completed';
  }
  
  return {
    isComplete: isComplete,
    actualStatus: actualStatus,
    details: completionDetails
  };
}

/**
 * Worker state management
 */
let isWorkerRunning = false;
let currentJob = null;
let workerTimeout = null;

/**
 * Start the queue worker
 * @param {Object} env - Environment bindings
 * @returns {Promise<void>}
 */
export async function startWorker(env) {
  if (isWorkerRunning) {
    console.log('Worker is already running');
    return;
  }
  
  isWorkerRunning = true;
  console.log('Starting comment bot worker...');
  
  // Process jobs continuously
  while (isWorkerRunning) {
    try {
      await processNextJob(env);
      
      // Update queue positions after each job
      await updateQueuePositions(env);
      
      // Wait before checking for next job
      await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.pollInterval));
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.pollInterval));
    }
  }
}

/**
 * Stop the queue worker
 */
export function stopWorker() {
  console.log('Stopping comment bot worker...');
  isWorkerRunning = false;
  
  if (workerTimeout) {
    clearTimeout(workerTimeout);
    workerTimeout = null;
  }
}

/**
 * Process the next job in the queue
 * @param {Object} env - Environment bindings
 * @returns {Promise<boolean>} - True if a job was processed
 */
async function processNextJob(env) {
  try {
    // Get next job from queue
    const job = await getNextJob(env);
    
    if (!job) {
      return false; // No jobs to process
    }
    
    currentJob = job;
    console.log(`Processing job ${job.job_id} of type ${job.type}`);
    
    // Update job status to processing
    await updateJobStatus(env, job.job_id, JOB_STATES.PROCESSING, {
      attempts: job.attempts + 1
    });
    
    await addJobLog(env, job.job_id, 'info', 'Job processing started', {
      attempt: job.attempts + 1,
      maxAttempts: job.max_attempts
    });
    
    // Set a timeout for the job
    const timeoutPromise = new Promise((_, reject) => {
      workerTimeout = setTimeout(() => {
        reject(new Error('Job processing timeout'));
      }, WORKER_CONFIG.maxProcessingTime);
    });
    
    // Process based on job type
    let result;
    try {
      const processingPromise = processJobByType(env, job);
      result = await Promise.race([processingPromise, timeoutPromise]);
      
      // Clear timeout if job completed
      if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
      }
      
      // Update job as completed
      await updateJobStatus(env, job.job_id, JOB_STATES.COMPLETED, {
        result: result
      });
      
      await addJobLog(env, job.job_id, 'info', 'Job completed successfully', {
        result: result
      });
      
      console.log(`Job ${job.job_id} completed successfully`);
      
    } catch (error) {
      // Clear timeout
      if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
      }
      
      console.error(`Job ${job.job_id} failed:`, error);
      
      // Check if we should retry
      if (job.attempts + 1 < job.max_attempts) {
        // Retry the job
        await updateJobStatus(env, job.job_id, JOB_STATES.PENDING, {
          error: error.message
        });
        
        await addJobLog(env, job.job_id, 'warning', 'Job failed, will retry', {
          error: error.message,
          attempt: job.attempts + 1,
          maxAttempts: job.max_attempts
        });
        
        // Add delay before retry
        await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.retryDelay));
      } else {
        // Mark as failed - no more retries
        await updateJobStatus(env, job.job_id, JOB_STATES.FAILED, {
          error: error.message
        });
        
        await addJobLog(env, job.job_id, 'error', 'Job failed after all retries', {
          error: error.message,
          attempts: job.attempts + 1
        });
      }
    }
    
    currentJob = null;
    return true;
    
  } catch (error) {
    console.error('Error processing next job:', error);
    currentJob = null;
    return false;
  }
}

/**
 * Process a job based on its type
 * @param {Object} env - Environment bindings
 * @param {Object} job - Job to process
 * @returns {Promise<Object>} - Processing result
 */
async function processJobByType(env, job) {
  switch (job.type) {
    case 'create_order':
      return await processCreateOrderJob(env, job);
    
    case 'check_order_status':
      return await processCheckOrderStatusJob(env, job);
    
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

/**
 * Process a create order job
 * @param {Object} env - Environment bindings
 * @param {Object} job - Job data
 * @returns {Promise<Object>} - Order creation result
 */
async function processCreateOrderJob(env, job) {
  const payload = job.payload;
  const startTime = Date.now();
  let maxPollingTime = 2 * 60 * 1000; // Start with 2 minutes, will extend if needed
  const pollInterval = 10000; // Poll every 10 seconds
  let hasExtendedTimeout = false; // Track if we've extended the timeout
  
  await addJobLog(env, job.job_id, 'info', 'Creating order with external API', {
    postId: payload.post_id,
    likeCount: payload.like_count,
    saveCount: payload.save_count,
    hasComments: !!payload.comment_data
  });
  
  // Prepare API data
  const apiData = {
    post_id: payload.post_id,
    like_count: payload.like_count || 0,
    save_count: payload.save_count || 0
  };
  
  // Add comment data if provided
  if (payload.comment_data) {
    apiData.comment_data = payload.comment_data;
  }
  
  // Make API call to create order
  const response = await fetchAPI('/api/orders/create', {
    method: 'POST',
    body: JSON.stringify(apiData)
  });
  
  if (!response || !response.order_id) {
    throw new Error('Invalid API response: missing order_id');
  }
  
  const orderId = response.order_id;
  
  await addJobLog(env, job.job_id, 'info', 'Order created, starting status polling', {
    orderId: orderId,
    initialStatus: response.status
  });
  
  // Save initial order to database
  if (payload.save_to_db) {
    await saveOrderToDatabase(env, job, response);
  }
  
  // Now continuously poll the order status until it's complete or times out
  let orderComplete = false;
  let lastStatus = response.status;
  let pollCount = 0;
  
  while (!orderComplete && (Date.now() - startTime) < maxPollingTime) {
    // Wait before polling
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    pollCount++;
    
    try {
      // Check order status
      const statusResponse = await fetchAPI(`/api/orders/${orderId}/status`);
      
      if (!statusResponse) {
        await addJobLog(env, job.job_id, 'warning', 'Failed to get order status, will retry', {
          orderId: orderId,
          pollCount: pollCount
        });
        continue;
      }
      
      // Log status update if changed
      if (statusResponse.status !== lastStatus) {
        await addJobLog(env, job.job_id, 'info', 'Order status updated', {
          orderId: orderId,
          oldStatus: lastStatus,
          newStatus: statusResponse.status,
          progress: statusResponse.progress
        });
        lastStatus = statusResponse.status;
        
        // Update order in database
        if (payload.save_to_db && env.COMMENT_BOT_DB) {
          const updateQuery = `
            UPDATE orders 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = ?
          `;
          
          await env.COMMENT_BOT_DB.prepare(updateQuery)
            .bind(statusResponse.status, orderId)
            .run();
        }
      }
      
      // Check if order is truly complete
      const isOrderComplete = checkOrderCompletion(statusResponse);
      
      // Update order in database with the actual status
      // Map 'completed_with_errors' to 'completed' for database compatibility
      const dbStatus = isOrderComplete.actualStatus === 'completed_with_errors' 
        ? 'completed' 
        : isOrderComplete.actualStatus;
        
      if (payload.save_to_db && env.COMMENT_BOT_DB && dbStatus !== lastStatus) {
        const updateQuery = `
          UPDATE orders 
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE order_id = ?
        `;
        
        await env.COMMENT_BOT_DB.prepare(updateQuery)
          .bind(dbStatus, orderId)
          .run();
          
        lastStatus = dbStatus;
      }
      
      // If we detect the order is still processing but has made progress, extend timeout once
      if (!isOrderComplete.isComplete && !hasExtendedTimeout && statusResponse.progress) {
        const progressMade = Object.values(statusResponse.progress).some(p => 
          p.completed > 0 || p.failed > 0
        );
        
        if (progressMade) {
          // Extend timeout by 3 more minutes if we see progress
          maxPollingTime += 3 * 60 * 1000;
          hasExtendedTimeout = true;
          
          await addJobLog(env, job.job_id, 'info', 'Extending timeout due to ongoing progress', {
            orderId: orderId,
            newMaxPollingTime: maxPollingTime / 1000 + ' seconds',
            currentProgress: statusResponse.progress
          });
        }
      }
      
      if (isOrderComplete.isComplete) {
        orderComplete = true;
        
        await addJobLog(env, job.job_id, 'info', 'Order processing finished', {
          orderId: orderId,
          finalStatus: statusResponse.status,
          actualStatus: isOrderComplete.actualStatus,
          pollCount: pollCount,
          duration: Math.round((Date.now() - startTime) / 1000) + ' seconds',
          completionDetails: isOrderComplete.details
        });
        
        // Update the status response with actual completion status
        statusResponse.actualCompletionStatus = isOrderComplete.actualStatus;
        statusResponse.completionDetails = isOrderComplete.details;
        
        return statusResponse;
      }
      
    } catch (error) {
      await addJobLog(env, job.job_id, 'warning', 'Error polling order status', {
        orderId: orderId,
        error: error.message,
        pollCount: pollCount
      });
    }
  }
  
  // If we got here, the order timed out
  throw new Error(`Order ${orderId} timed out after ${pollCount} polls`);
}

/**
 * Process a check order status job
 * @param {Object} env - Environment bindings
 * @param {Object} job - Job data
 * @returns {Promise<Object>} - Order status result
 */
async function processCheckOrderStatusJob(env, job) {
  const payload = job.payload;
  const orderId = payload.order_id;
  
  await addJobLog(env, job.job_id, 'info', 'Checking order status', {
    orderId: orderId
  });
  
  // Make API call to check status
  const response = await fetchAPI(`/api/orders/${orderId}/status`);
  
  if (!response) {
    throw new Error('Failed to get order status');
  }
  
  await addJobLog(env, job.job_id, 'info', 'Order status retrieved', {
    orderId: orderId,
    status: response.status,
    progress: response.progress
  });
  
  // Check the actual completion status
  const isOrderComplete = checkOrderCompletion(response);
  
  // Update order in database if needed
  if (payload.update_db && env.COMMENT_BOT_DB) {
    // Map 'completed_with_errors' to 'completed' for database compatibility
    const dbStatus = isOrderComplete.actualStatus === 'completed_with_errors' 
      ? 'completed' 
      : isOrderComplete.actualStatus;
      
    const updateQuery = `
      UPDATE orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `;
    
    await env.COMMENT_BOT_DB.prepare(updateQuery)
      .bind(dbStatus, orderId)
      .run();
  }
  
  return response;
}

/**
 * Save order to database
 * @param {Object} env - Environment bindings
 * @param {Object} job - Job data
 * @param {Object} orderResponse - API response
 */
async function saveOrderToDatabase(env, job, orderResponse) {
  try {
    const insertQuery = `
      INSERT INTO orders (
        user_id, team_id, order_id, post_id, status,
        like_count, save_count, comment_group_id,
        message, api_created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await env.COMMENT_BOT_DB.prepare(insertQuery)
      .bind(
        job.user_id,
        job.team_id,
        orderResponse.order_id,
        job.payload.post_id,
        orderResponse.status || 'pending',
        job.payload.like_count || 0,
        job.payload.save_count || 0,
        job.payload.comment_group_id || null,
        orderResponse.message || null,
        orderResponse.created_at || new Date().toISOString()
      )
      .run();
    
    await addJobLog(env, job.job_id, 'info', 'Order saved to database', {
      orderId: orderResponse.order_id
    });
  } catch (error) {
    console.error('Failed to save order to database:', error);
    await addJobLog(env, job.job_id, 'warning', 'Failed to save order to database', {
      error: error.message
    });
  }
}

/**
 * Make API request with error handling
 * @param {string} path - API path
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - API response
 */
async function fetchAPI(path, options = {}) {
  try {
    const apiUrl = `${API_CONFIG.baseUrl}${path}`;
    
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_CONFIG.apiKey,
        ...(options.headers || {})
      }
    };
    
    const response = await fetch(apiUrl, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const responseText = await response.text();
    
    try {
      return responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      if (response.ok) {
        return responseText;
      }
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
  } catch (error) {
    console.error(`API fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Get current worker status
 * @returns {Object} - Worker status
 */
export function getWorkerStatus() {
  return {
    isRunning: isWorkerRunning,
    currentJob: currentJob ? {
      jobId: currentJob.job_id,
      type: currentJob.type,
      userId: currentJob.user_id
    } : null
  };
}

/**
 * Process jobs triggered by cron
 * @param {Object} env - Environment bindings
 * @param {number} maxJobs - Maximum number of jobs to process
 * @returns {Promise<number>} - Number of jobs processed
 */
export async function processCronJobs(env, maxJobs = 10) {
  let processedCount = 0;
  
  console.log(`Starting cron job processing (max: ${maxJobs} jobs)`);
  
  for (let i = 0; i < maxJobs; i++) {
    const processed = await processNextJob(env);
    
    if (!processed) {
      break; // No more jobs to process
    }
    
    processedCount++;
    
    // Update queue positions after each job
    await updateQueuePositions(env);
  }
  
  console.log(`Cron job processing completed. Processed ${processedCount} jobs`);
  return processedCount;
}