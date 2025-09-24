let workerRunning = false;
let lastWorkerRun = 0;

export async function processBackgroundJobs(env, ctx) {
  const now = Date.now();

  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    const { processCronJobs } = await import('../features/comment-bot/comment-bot-worker.service.js');
    const processedCount = await processCronJobs(env, 1, ctx);

    if (processedCount > 0) {
      lastWorkerRun = now;
    }
  } catch (error) {
  } finally {
    workerRunning = false;
  }
}

export function canProcessJob() {
  const now = Date.now();
  return now - lastWorkerRun >= 30000;
}