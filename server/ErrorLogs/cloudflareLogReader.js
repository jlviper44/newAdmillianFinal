// Cloudflare Log Reader - Fetches logs from Cloudflare API
import { ErrorStorage } from './errorStorage.js';

export class CloudflareLogReader {
  constructor(env) {
    this.env = env;
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN;
    this.zoneId = env.CLOUDFLARE_ZONE_ID;
    this.errorStorage = new ErrorStorage(env.DASHBOARD_DB);
  }

  // Fetch logs from Cloudflare Analytics API
  async fetchCloudflareAnalytics(startTime, endTime) {
    if (!this.apiToken || !this.zoneId) {
      console.error('Cloudflare API credentials not configured');
      throw new Error('Cloudflare API credentials not configured. Please add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID to your environment.');
    }

    try {
      // Cloudflare GraphQL Analytics API endpoint
      const url = `https://api.cloudflare.com/client/v4/graphql`;

      const query = `
        query {
          viewer {
            zones(filter: { zoneTag: "${this.zoneId}" }) {
              httpRequests1mGroups(
                limit: 100
                filter: {
                  datetime_geq: "${startTime}"
                  datetime_lt: "${endTime}"
                  status_geq: 400
                }
                orderBy: [datetime_DESC]
              ) {
                dimensions {
                  datetime
                  clientIP
                  clientRequestPath
                  clientRequestMethod
                  status
                  clientRequestUserAgent
                }
                sum {
                  requests
                  responseBytes
                }
              }
            }
          }
        }
      `;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.error('API Token permission error - needs "Workers Scripts: Read" permission');
          throw new Error(`Cloudflare API error: Forbidden - Your API token needs "Workers Scripts: Read" permission`);
        }
        throw new Error(`Cloudflare API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseAnalyticsData(data);
    } catch (error) {
      console.error('Failed to fetch Cloudflare analytics:', error);
      return [];
    }
  }

  // Fetch Worker logs using Tail Workers (if configured)
  async fetchWorkerLogs() {
    if (!this.apiToken || !this.accountId) {
      console.error('Cloudflare API credentials not configured');
      return [];
    }

    try {
      // List recent Worker invocation logs
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.error('API Token permission error - needs "Workers Scripts: Read" permission');
          throw new Error(`Cloudflare API error: Forbidden - Your API token needs "Workers Scripts: Read" permission`);
        }
        throw new Error(`Cloudflare API error: ${response.statusText}`);
      }

      const data = await response.json();

      // For each worker script, fetch recent logs
      const allLogs = [];
      for (const script of data.result || []) {
        const logs = await this.fetchScriptLogs(script.id);
        allLogs.push(...logs);
      }

      return allLogs;
    } catch (error) {
      console.error('Failed to fetch Worker logs:', error);
      return [];
    }
  }

  // Fetch logs for a specific Worker script
  async fetchScriptLogs(scriptName) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${scriptName}/tails`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: {
            outcome: ['exception', 'exceededCpu', 'exceededMemory', 'unknown']
          }
        })
      });

      if (!response.ok) {
        console.error(`Failed to fetch logs for ${scriptName}`);
        return [];
      }

      const data = await response.json();
      return this.parseWorkerLogs(data, scriptName);
    } catch (error) {
      console.error(`Failed to fetch logs for script ${scriptName}:`, error);
      return [];
    }
  }

  // Parse analytics data into error log format
  parseAnalyticsData(data) {
    const errors = [];

    try {
      const zones = data?.data?.viewer?.zones || [];
      for (const zone of zones) {
        const requests = zone.httpRequests1mGroups || [];

        for (const request of requests) {
          const dim = request.dimensions;

          // Only include 4xx and 5xx errors
          if (dim.status >= 400) {
            errors.push({
              timestamp: dim.datetime,
              source: 'cloudflare-zone',
              error: {
                message: `HTTP ${dim.status} Error`,
                name: this.getStatusName(dim.status),
                code: dim.status.toString()
              },
              metadata: {
                path: dim.clientRequestPath,
                method: dim.clientRequestMethod,
                clientIP: dim.clientIP,
                userAgent: dim.clientRequestUserAgent,
                requests: request.sum.requests,
                responseBytes: request.sum.responseBytes
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse analytics data:', error);
    }

    return errors;
  }

  // Parse Worker logs into error log format
  parseWorkerLogs(data, scriptName) {
    const errors = [];

    try {
      const logs = data?.result || [];

      for (const log of logs) {
        if (log.outcome === 'ok') continue;

        errors.push({
          timestamp: new Date(log.eventTimestamp).toISOString(),
          source: 'cloudflare-worker',
          error: {
            message: log.logs?.[0]?.message || log.exceptions?.[0]?.message || 'Worker error',
            name: log.exceptions?.[0]?.name || log.outcome,
            stack: log.exceptions?.[0]?.stack
          },
          metadata: {
            scriptName,
            outcome: log.outcome,
            cpuTime: log.cpuTime,
            duration: log.duration,
            status: log.status,
            logs: log.logs
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse worker logs:', error);
    }

    return errors;
  }

  // Get HTTP status name
  getStatusName(status) {
    const statusNames = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    return statusNames[status] || `HTTP ${status} Error`;
  }

  // Sync Cloudflare logs to local database
  async syncLogs() {
    try {
      // Check if credentials are configured
      if (!this.apiToken || !this.zoneId) {
        return {
          success: false,
          error: 'Cloudflare API credentials not configured',
          message: 'Please add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID to wrangler.jsonc and deploy, or use "npm run preview" for local testing.',
          logsAdded: 0
        };
      }

      await this.errorStorage.initTable();

      // Fetch logs from the last hour
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago

      // Fetch analytics logs (HTTP errors)
      let analyticsLogs = [];
      let workerLogs = [];
      let errors = [];

      try {
        analyticsLogs = await this.fetchCloudflareAnalytics(
          startTime.toISOString(),
          endTime.toISOString()
        );
      } catch (error) {
        console.error('Failed to fetch analytics logs:', error.message);
        errors.push(`Analytics: ${error.message}`);
      }

      // Fetch Worker logs (continue even if this fails)
      try {
        workerLogs = await this.fetchWorkerLogs();
      } catch (error) {
        console.error('Failed to fetch worker logs:', error.message);
        errors.push(`Workers: ${error.message}`);
      }

      // Combine all logs
      const allLogs = [...analyticsLogs, ...workerLogs];

      // Store each log in the database
      let syncedCount = 0;
      for (const log of allLogs) {
        try {
          await this.errorStorage.logError(
            log.error,
            log.source,
            log.metadata
          );
          syncedCount++;
        } catch (error) {
          // Skip duplicates or invalid logs
          console.error('Failed to sync log:', error);
        }
      }

      return {
        success: errors.length === 0,
        synced: syncedCount,
        total: allLogs.length,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 ? 'Partial sync completed with errors' : 'Sync completed successfully'
      };
    } catch (error) {
      console.error('Failed to sync Cloudflare logs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Real-time log streaming using Cloudflare Logpush (if configured)
  async setupLogpush() {
    if (!this.apiToken || !this.zoneId) {
      return { error: 'Cloudflare API credentials not configured' };
    }

    try {
      // Check if Logpush is already configured
      const existingJobs = await this.getLogpushJobs();

      if (existingJobs.length > 0) {
        return { message: 'Logpush already configured', jobs: existingJobs };
      }

      // Create a new Logpush job
      const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/logpush/jobs`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'error-logs-push',
          logpull_options: 'fields=ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestURI,EdgeEndTimestamp,EdgeResponseBytes,EdgeResponseStatus,EdgeStartTimestamp,RayID&timestamps=rfc3339',
          destination_conf: `https://${this.env.WORKER_URL}/api/error-logs/ingest`,
          dataset: 'http_requests',
          enabled: true,
          filter: '{EdgeResponseStatus >= 400}'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to setup Logpush: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, job: data.result };
    } catch (error) {
      console.error('Failed to setup Logpush:', error);
      return { error: error.message };
    }
  }

  // Get existing Logpush jobs
  async getLogpushJobs() {
    try {
      const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/logpush/jobs`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('Failed to get Logpush jobs:', error);
      return [];
    }
  }
}

// Handler for ingesting Logpush data
export async function handleLogpushIngest(request, env) {
  try {
    const logs = await request.json();
    const errorStorage = new ErrorStorage(env.DASHBOARD_DB);
    await errorStorage.initTable();

    let processedCount = 0;
    for (const log of logs) {
      // Only process error responses (4xx, 5xx)
      if (log.EdgeResponseStatus >= 400) {
        const error = {
          message: `HTTP ${log.EdgeResponseStatus} on ${log.ClientRequestURI}`,
          name: `HTTP_${log.EdgeResponseStatus}`,
          code: log.EdgeResponseStatus.toString()
        };

        const metadata = {
          rayId: log.RayID,
          clientIP: log.ClientIP,
          requestHost: log.ClientRequestHost,
          requestMethod: log.ClientRequestMethod,
          requestURI: log.ClientRequestURI,
          responseBytes: log.EdgeResponseBytes,
          startTime: log.EdgeStartTimestamp,
          endTime: log.EdgeEndTimestamp,
          duration: log.EdgeEndTimestamp - log.EdgeStartTimestamp
        };

        await errorStorage.logError(error, 'cloudflare-http', metadata);
        processedCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to ingest Logpush data:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process logs'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}