import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ErrorLogger {
    constructor() {
        this.logDir = __dirname;
        this.ensureLogDirectory();
    }

    async ensureLogDirectory() {
        try {
            await fs.access(this.logDir);
        } catch {
            await fs.mkdir(this.logDir, { recursive: true });
        }
    }

    async logError(error, source = 'cloudflare', metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            source,
            error: {
                message: error.message || error.toString(),
                stack: error.stack,
                name: error.name,
                code: error.code
            },
            metadata,
            environment: process.env.NODE_ENV || 'production'
        };

        const fileName = `${source}-${new Date().toISOString().split('T')[0]}.log`;
        const filePath = path.join(this.logDir, fileName);

        try {
            let existingLogs = [];
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                existingLogs = JSON.parse(content);
            } catch {
                // File doesn't exist or is empty
            }

            existingLogs.push(logEntry);
            await fs.writeFile(filePath, JSON.stringify(existingLogs, null, 2));

            // Also maintain a recent errors file for quick access
            await this.updateRecentErrors(logEntry);

            return logEntry;
        } catch (writeError) {
            console.error('Failed to write error log:', writeError);
            throw writeError;
        }
    }

    async updateRecentErrors(logEntry) {
        const recentFilePath = path.join(this.logDir, 'recent-errors.json');
        let recentErrors = [];

        try {
            const content = await fs.readFile(recentFilePath, 'utf-8');
            recentErrors = JSON.parse(content);
        } catch {
            // File doesn't exist
        }

        recentErrors.unshift(logEntry);
        // Keep only last 100 errors
        recentErrors = recentErrors.slice(0, 100);

        await fs.writeFile(recentFilePath, JSON.stringify(recentErrors, null, 2));
    }

    async getErrors(filters = {}) {
        const { source, startDate, endDate, limit = 100 } = filters;
        const files = await fs.readdir(this.logDir);
        let allErrors = [];

        for (const file of files) {
            if (file.endsWith('.log')) {
                if (source && !file.startsWith(source)) continue;

                const filePath = path.join(this.logDir, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const logs = JSON.parse(content);
                    allErrors = allErrors.concat(logs);
                } catch {
                    // Skip invalid files
                }
            }
        }

        // Apply filters
        if (startDate) {
            allErrors = allErrors.filter(e => new Date(e.timestamp) >= new Date(startDate));
        }
        if (endDate) {
            allErrors = allErrors.filter(e => new Date(e.timestamp) <= new Date(endDate));
        }

        // Sort by timestamp descending
        allErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return allErrors.slice(0, limit);
    }

    async getRecentErrors() {
        try {
            const content = await fs.readFile(path.join(this.logDir, 'recent-errors.json'), 'utf-8');
            return JSON.parse(content);
        } catch {
            return [];
        }
    }

    async clearOldLogs(daysToKeep = 30) {
        const files = await fs.readdir(this.logDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        for (const file of files) {
            if (file.endsWith('.log')) {
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                }
            }
        }
    }
}

const errorLogger = new ErrorLogger();

// Cloudflare Error Handler
class CloudflareErrorHandler {
    async handleWorkerError(error, context = {}) {
        const errorData = {
            type: 'worker_error',
            url: context.url,
            method: context.method,
            headers: context.headers,
            cf: context.cf,
            workerId: context.workerId
        };

        return await errorLogger.logError(error, 'cloudflare-worker', errorData);
    }

    async handleD1Error(error, context = {}) {
        const errorData = {
            type: 'd1_error',
            database: context.database,
            query: context.query,
            params: context.params,
            operation: context.operation
        };

        return await errorLogger.logError(error, 'cloudflare-d1', errorData);
    }

    async handleKVError(error, context = {}) {
        const errorData = {
            type: 'kv_error',
            namespace: context.namespace,
            key: context.key,
            operation: context.operation
        };

        return await errorLogger.logError(error, 'cloudflare-kv', errorData);
    }

    async handleR2Error(error, context = {}) {
        const errorData = {
            type: 'r2_error',
            bucket: context.bucket,
            key: context.key,
            operation: context.operation
        };

        return await errorLogger.logError(error, 'cloudflare-r2', errorData);
    }

    async handleDurableObjectError(error, context = {}) {
        const errorData = {
            type: 'durable_object_error',
            objectName: context.objectName,
            id: context.id,
            operation: context.operation
        };

        return await errorLogger.logError(error, 'cloudflare-do', errorData);
    }

    async handleAPIError(error, context = {}) {
        const errorData = {
            type: 'api_error',
            endpoint: context.endpoint,
            statusCode: context.statusCode,
            response: context.response,
            requestId: context.requestId
        };

        return await errorLogger.logError(error, 'cloudflare-api', errorData);
    }
}

const cloudflareErrorHandler = new CloudflareErrorHandler();

// Main handler function for API requests
export async function handleErrorLogs(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const session = request.ctx?.session;

    // Check admin permission
    if (!session || session.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // GET /api/error-logs - Get error logs with filters
        if (path === '/api/error-logs' && request.method === 'GET') {
            const filters = {
                source: url.searchParams.get('source'),
                startDate: url.searchParams.get('startDate'),
                endDate: url.searchParams.get('endDate'),
                limit: parseInt(url.searchParams.get('limit')) || 100
            };

            const errors = await errorLogger.getErrors(filters);
            return new Response(JSON.stringify(errors), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // GET /api/error-logs/recent - Get recent errors
        if (path === '/api/error-logs/recent' && request.method === 'GET') {
            const errors = await errorLogger.getRecentErrors();
            return new Response(JSON.stringify(errors), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /api/error-logs - Log a new error
        if (path === '/api/error-logs' && request.method === 'POST') {
            const body = await request.json();
            const { error, source, metadata } = body;

            const logEntry = await errorLogger.logError(
                error,
                source || 'api',
                metadata
            );

            return new Response(JSON.stringify(logEntry), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /api/error-logs/cloudflare/worker - Log worker error
        if (path === '/api/error-logs/cloudflare/worker' && request.method === 'POST') {
            const body = await request.json();
            const { error, context } = body;

            const logEntry = await cloudflareErrorHandler.handleWorkerError(error, context);

            return new Response(JSON.stringify(logEntry), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /api/error-logs/cloudflare/d1 - Log D1 error
        if (path === '/api/error-logs/cloudflare/d1' && request.method === 'POST') {
            const body = await request.json();
            const { error, context } = body;

            const logEntry = await cloudflareErrorHandler.handleD1Error(error, context);

            return new Response(JSON.stringify(logEntry), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // POST /api/error-logs/cloudflare/kv - Log KV error
        if (path === '/api/error-logs/cloudflare/kv' && request.method === 'POST') {
            const body = await request.json();
            const { error, context } = body;

            const logEntry = await cloudflareErrorHandler.handleKVError(error, context);

            return new Response(JSON.stringify(logEntry), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // DELETE /api/error-logs/cleanup - Clear old logs
        if (path === '/api/error-logs/cleanup' && request.method === 'DELETE') {
            const daysToKeep = parseInt(url.searchParams.get('days')) || 30;
            await errorLogger.clearOldLogs(daysToKeep);

            return new Response(JSON.stringify({ message: `Cleared logs older than ${daysToKeep} days` }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error handling error logs request:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Export for use in error handling middleware
export { errorLogger, cloudflareErrorHandler };