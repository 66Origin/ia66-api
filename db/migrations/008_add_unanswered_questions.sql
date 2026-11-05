BEGIN;

-- Questions O could not answer or classify, kept 90 days to improve the
-- corpus. Only the current message is stored, after masking e-mail addresses
-- and phone numbers, with no link to the other messages of the conversation.

CREATE TABLE analytics.unanswered_questions (
  request_id uuid PRIMARY KEY
    REFERENCES analytics.chat_requests(request_id),

  question text NOT NULL
    CHECK (char_length(question) BETWEEN 1 AND 2000),

  reason text NOT NULL
    CHECK (
      reason IN (
        'generation_failed',
        'empty_response',
        'unclassifiable'
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX unanswered_questions_created_at_idx
  ON analytics.unanswered_questions(created_at);

ALTER TABLE analytics.unanswered_questions
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics.unanswered_questions
FROM PUBLIC, anon, authenticated, service_role;

-- The API can write these questions but never read them back.
GRANT INSERT (request_id, question, reason)
  ON analytics.unanswered_questions
  TO o_analytics_writer;

CREATE POLICY o_writer_insert_unanswered
  ON analytics.unanswered_questions
  FOR INSERT
  TO o_analytics_writer
  WITH CHECK (true);

-- The purge gains a second retention period, so its signature changes.
DROP FUNCTION analytics.purge_expired(interval);

CREATE FUNCTION analytics.purge_expired(
  p_retention interval DEFAULT interval '12 months',
  p_unanswered_retention interval DEFAULT interval '90 days'
)
RETURNS TABLE (
  deleted_unanswered integer,
  deleted_classifications integer,
  deleted_requests integer,
  deleted_conversations integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := v_now - p_retention;
BEGIN
  IF p_retention < interval '1 day'
     OR p_unanswered_retention < interval '1 day' THEN
    RAISE EXCEPTION 'Retention period is too short'
      USING ERRCODE = '22023';
  END IF;

  -- Also covers questions whose request is about to be purged.
  DELETE FROM analytics.unanswered_questions AS q
  WHERE q.created_at < v_now - p_unanswered_retention
     OR q.request_id IN (
       SELECT r.request_id
       FROM analytics.chat_requests AS r
       WHERE r.received_at < v_cutoff
     );

  GET DIAGNOSTICS deleted_unanswered = ROW_COUNT;

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

REVOKE ALL ON FUNCTION analytics.purge_expired(interval, interval)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
