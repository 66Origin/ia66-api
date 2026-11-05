BEGIN;

-- Requires the pg_cron extension (Supabase: Database > Extensions > pg_cron).
-- Kept apart from 006 so the retention functions can be installed and tested
-- on a database without pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Every day at 03:17 UTC. Scheduling an existing job name updates it.
SELECT cron.schedule(
  'o-analytics-retention',
  '17 3 * * *',
  'SELECT analytics.run_retention()'
);

COMMIT;
