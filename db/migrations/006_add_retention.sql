BEGIN;

-- Retention: detailed rows are kept for 12 months. Before a month starts to
-- be purged, it is summarized into anonymous monthly statistics that carry
-- no identifier. Months are counted in Europe/Paris time.

CREATE TABLE analytics.monthly_conversation_stats (
  month date NOT NULL,
  placement text NOT NULL
    CHECK (placement IN ('home', 'global')),

  conversations integer NOT NULL CHECK (conversations >= 0),
  conversations_1_request integer NOT NULL
    CHECK (conversations_1_request >= 0),
  conversations_2_3_requests integer NOT NULL
    CHECK (conversations_2_3_requests >= 0),
  conversations_4_plus_requests integer NOT NULL
    CHECK (conversations_4_plus_requests >= 0),

  requests integer NOT NULL CHECK (requests >= 0),
  failed_requests integer NOT NULL CHECK (failed_requests >= 0),
  median_generation_ms integer
    CHECK (median_generation_ms >= 0),

  refreshed_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (month, placement),
  CONSTRAINT monthly_conversation_month_start
    CHECK (month = date_trunc('month', month)::date)
);

CREATE TABLE analytics.monthly_request_stats (
  month date NOT NULL,
  placement text NOT NULL
    CHECK (placement IN ('home', 'global')),

  -- 'missing' covers requests whose classification was never recorded.
  classification_status text NOT NULL
    CHECK (
      classification_status IN (
        'classified',
        'unclassifiable',
        'failed',
        'missing'
      )
    ),
  subject text,
  intent text,

  requests integer NOT NULL CHECK (requests >= 0),

  refreshed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT monthly_request_stats_key
    UNIQUE NULLS NOT DISTINCT (
      month,
      placement,
      classification_status,
      subject,
      intent
    ),
  CONSTRAINT monthly_request_month_start
    CHECK (month = date_trunc('month', month)::date)
);

ALTER TABLE analytics.monthly_conversation_stats
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE analytics.monthly_request_stats
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics.monthly_conversation_stats,
              analytics.monthly_request_stats
FROM PUBLIC, anon, authenticated, service_role;

-- Recomputes every completed month that is still fully present in the
-- detailed tables. Older months keep the statistics computed before their
-- purge began, so a partially purged month never overwrites them.
CREATE FUNCTION analytics.refresh_monthly_stats(
  p_retention interval DEFAULT interval '12 months'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_current_month date :=
    date_trunc('month', v_now AT TIME ZONE 'Europe/Paris')::date;
  v_first_month date;
  v_months integer;
BEGIN
  -- First month whose start is still inside the retention window.
  v_first_month := (
    date_trunc(
      'month',
      (v_now - p_retention) AT TIME ZONE 'Europe/Paris'
    ) + interval '1 month'
  )::date;

  IF v_first_month >= v_current_month THEN
    RETURN 0;
  END IF;

  DELETE FROM analytics.monthly_conversation_stats
  WHERE month >= v_first_month
    AND month < v_current_month;

  DELETE FROM analytics.monthly_request_stats
  WHERE month >= v_first_month
    AND month < v_current_month;

  WITH conversation_requests AS (
    SELECT
      date_trunc(
        'month',
        c.started_at AT TIME ZONE 'Europe/Paris'
      )::date AS month,
      c.placement,
      c.conversation_id,
      count(r.request_id) AS requests,
      count(r.request_id) FILTER (WHERE r.status = 'failed') AS failed
    FROM analytics.conversations AS c
    LEFT JOIN analytics.chat_requests AS r
      ON r.conversation_id = c.conversation_id
    WHERE c.started_at >= (v_first_month::timestamp AT TIME ZONE 'Europe/Paris')
      AND c.started_at < (v_current_month::timestamp AT TIME ZONE 'Europe/Paris')
    GROUP BY 1, 2, 3
  ),
  durations AS (
    SELECT
      date_trunc(
        'month',
        c.started_at AT TIME ZONE 'Europe/Paris'
      )::date AS month,
      c.placement,
      percentile_disc(0.5) WITHIN GROUP (
        ORDER BY r.generation_duration_ms
      ) AS median_generation_ms
    FROM analytics.conversations AS c
    JOIN analytics.chat_requests AS r
      ON r.conversation_id = c.conversation_id
    WHERE c.started_at >= (v_first_month::timestamp AT TIME ZONE 'Europe/Paris')
      AND c.started_at < (v_current_month::timestamp AT TIME ZONE 'Europe/Paris')
      AND r.status = 'generated'
      AND r.generation_duration_ms IS NOT NULL
    GROUP BY 1, 2
  )
  INSERT INTO analytics.monthly_conversation_stats (
    month,
    placement,
    conversations,
    conversations_1_request,
    conversations_2_3_requests,
    conversations_4_plus_requests,
    requests,
    failed_requests,
    median_generation_ms
  )
  SELECT
    cr.month,
    cr.placement,
    count(*),
    count(*) FILTER (WHERE cr.requests = 1),
    count(*) FILTER (WHERE cr.requests BETWEEN 2 AND 3),
    count(*) FILTER (WHERE cr.requests >= 4),
    sum(cr.requests),
    sum(cr.failed),
    max(d.median_generation_ms)
  FROM conversation_requests AS cr
  LEFT JOIN durations AS d
    ON d.month = cr.month
   AND d.placement = cr.placement
  GROUP BY cr.month, cr.placement;

  -- Requests are attached to the month their conversation started in,
  -- consistently with the conversation statistics above.
  INSERT INTO analytics.monthly_request_stats (
    month,
    placement,
    classification_status,
    subject,
    intent,
    requests
  )
  SELECT
    date_trunc(
      'month',
      c.started_at AT TIME ZONE 'Europe/Paris'
    )::date,
    c.placement,
    coalesce(k.classification_status, 'missing'),
    k.subject,
    k.intent,
    count(*)
  FROM analytics.conversations AS c
  JOIN analytics.chat_requests AS r
    ON r.conversation_id = c.conversation_id
  LEFT JOIN analytics.request_classifications AS k
    ON k.request_id = r.request_id
  WHERE c.started_at >= (v_first_month::timestamp AT TIME ZONE 'Europe/Paris')
    AND c.started_at < (v_current_month::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY 1, 2, 3, 4, 5;

  SELECT count(DISTINCT month)
  INTO v_months
  FROM analytics.monthly_conversation_stats
  WHERE month >= v_first_month
    AND month < v_current_month;

  RETURN v_months;
END;
$$;

-- Deletes detailed rows older than the retention period. Conversations are
-- removed only once none of their requests remains.
CREATE FUNCTION analytics.purge_expired(
  p_retention interval DEFAULT interval '12 months'
)
RETURNS TABLE (
  deleted_classifications integer,
  deleted_requests integer,
  deleted_conversations integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cutoff timestamptz := clock_timestamp() - p_retention;
BEGIN
  IF p_retention < interval '1 day' THEN
    RAISE EXCEPTION 'Retention period is too short'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM analytics.request_classifications AS k
  USING analytics.chat_requests AS r
  WHERE k.request_id = r.request_id
    AND r.received_at < v_cutoff;

  GET DIAGNOSTICS deleted_classifications = ROW_COUNT;

  DELETE FROM analytics.chat_requests
  WHERE received_at < v_cutoff;

  GET DIAGNOSTICS deleted_requests = ROW_COUNT;

  DELETE FROM analytics.conversations AS c
  WHERE c.started_at < v_cutoff
    AND NOT EXISTS (
      SELECT 1
      FROM analytics.chat_requests AS r
      WHERE r.conversation_id = c.conversation_id
    );

  GET DIAGNOSTICS deleted_conversations = ROW_COUNT;

  RETURN NEXT;
END;
$$;

-- Single entry point for the scheduler: summarize first, then purge.
CREATE FUNCTION analytics.run_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM analytics.refresh_monthly_stats();
  PERFORM analytics.purge_expired();
END;
$$;

REVOKE ALL ON FUNCTION analytics.refresh_monthly_stats(interval),
                       analytics.purge_expired(interval),
                       analytics.run_retention()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
