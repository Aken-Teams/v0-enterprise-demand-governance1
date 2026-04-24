/**
 * Next.js instrumentation hook.
 * Runs once when the server starts.
 * Used to start the monthly SP report cron job.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMailCron } = await import("@/lib/cron/monthly-report")
    startMailCron()
  }
}
