BEGIN;

-- Browser recognition is removed: nothing is stored on the visitor's device
-- for analytics, and conversations are no longer linked to a browser.

DROP FUNCTION analytics.record_chat_request(uuid, uuid, uuid, text);

DROP INDEX analytics.conversations_visitor_id_idx;

ALTER TABLE analytics.conversations
  DROP CONSTRAINT conversation_recognition_consistent,
  DROP COLUMN visitor_id,
  DROP COLUMN recognition_status,
  DROP COLUMN previous_conversation_count,
  DROP COLUMN previous_conversation_started_at;

-- Dropping the table also drops its RLS policies and grants.
DROP TABLE analytics.browser_visitors;

CREATE FUNCTION analytics.record_chat_request(
  p_request_id uuid,
  p_conversation_id uuid,
  p_placement text
)
RETURNS TABLE (
  request_created boolean,
  conversation_created boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_existing_conversation_id uuid;
  v_conversation analytics.conversations%ROWTYPE;
  v_request_created boolean := false;
  v_conversation_created boolean := false;
BEGIN
  IF p_request_id IS NULL OR p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Request and conversation IDs are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_placement IS NULL
     OR p_placement NOT IN ('home', 'global') THEN
    RAISE EXCEPTION 'Invalid placement'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize deliveries of the same request.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('o:request:' || p_request_id::text, 0)
  );

  -- Serialize requests belonging to the same conversation.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('o:conversation:' || p_conversation_id::text, 0)
  );

  SELECT r.conversation_id
  INTO v_existing_conversation_id
  FROM analytics.chat_requests AS r
  WHERE r.request_id = p_request_id;

  IF FOUND AND v_existing_conversation_id <> p_conversation_id THEN
    RAISE EXCEPTION 'Request ID belongs to another conversation'
      USING ERRCODE = '22023';
  END IF;

  SELECT c.*
  INTO v_conversation
  FROM analytics.conversations AS c
  WHERE c.conversation_id = p_conversation_id;

  IF FOUND THEN
    IF v_conversation.placement <> p_placement THEN
      RAISE EXCEPTION 'Conversation context does not match'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    INSERT INTO analytics.conversations (
      conversation_id,
      started_at,
      placement
    )
    VALUES (
      p_conversation_id,
      clock_timestamp(),
      p_placement
    );

    v_conversation_created := true;
  END IF;

  IF v_existing_conversation_id IS NULL THEN
    INSERT INTO analytics.chat_requests (
      request_id,
      conversation_id
    )
    VALUES (
      p_request_id,
      p_conversation_id
    );

    v_request_created := true;
  END IF;

  RETURN QUERY SELECT
    v_request_created,
    v_conversation_created;
END;
$$;

REVOKE ALL ON FUNCTION analytics.record_chat_request(
  uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION analytics.record_chat_request(
  uuid, uuid, text
)
  TO o_analytics_writer;

COMMIT;
