export async function handleScheduledTasks(controller, env, ctx) {
  const currentTime = new Date();
  const currentHour = currentTime.getUTCHours();
  const currentMinute = currentTime.getUTCMinutes();
  const currentDay = currentTime.getUTCDay();

  if (currentDay === 1 && currentHour === 5 && currentMinute === 15) {
    try {
      const { generateWeeklyPayroll } = await import('../features/ad-launches/ad-launches.controller.js');
      const reports = await generateWeeklyPayroll(env);

      const { generateScheduledInvoices } = await import('../features/sparks/invoice-management.service.js');
      await generateScheduledInvoices(env.DASHBOARD_DB);
    } catch (error) {
    }
  }

  try {
    const { processCronJobs } = await import('../features/comment-bot/comment-bot-worker.service.js');

    ctx.waitUntil((async () => {
      while (true) {
        const processed = await processCronJobs(env, 1, ctx);
        if (!processed) break;
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    })());
  } catch (error) {
  }
}