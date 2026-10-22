BEGIN;

CREATE FUNCTION analytics.record_chat_request(
  p_request_id uuid,
  p_conversation_id uuid,
  p_visitor_id uuid,
  p_placement text
)
RETURNS TABLE (
  request_created boolean,
  conversation_created boolean,
  previous_conversation_count integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_existing_conversation_id uuid;
  v_conversation analytics.conversations%ROWTYPE;
  v_visitor analytics.browser_visitors%ROWTYPE;
  v_request_created boolean := false;
  v_conversation_created boolean := false;
  v_started_at timestamptz;
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
    IF v_conversation.visitor_id IS DISTINCT FROM p_visitor_id
       OR v_conversation.placement <> p_placement THEN
      RAISE EXCEPTION 'Conversation context does not match'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_visitor_id IS NOT NULL THEN
      INSERT INTO analytics.browser_visitors (visitor_id)
      VALUES (p_visitor_id)
      ON CONFLICT (visitor_id) DO NOTHING;

      -- Serialize counter changes for the same browser.
      SELECT v.*
      INTO STRICT v_visitor
      FROM analytics.browser_visitors AS v
      WHERE v.visitor_id = p_visitor_id
      FOR UPDATE;

      IF v_visitor.recognition_expires_at IS NOT NULL
         AND v_visitor.recognition_expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'Visitor recognition has expired'
          USING ERRCODE = '22023';
      END IF;
    END IF;

    v_started_at := clock_timestamp();

    INSERT INTO analytics.conversations (
      conversation_id,
      visitor_id,
      started_at,
      placement,
      recognition_status,
      previous_conversation_count,
      previous_conversation_started_at
    )
    VALUES (
      p_conversation_id,
      p_visitor_id,
      v_started_at,
      p_placement,
      CASE WHEN p_visitor_id IS NULL THEN 'unknown' ELSE 'known' END,
      CASE
        WHEN p_visitor_id IS NULL THEN NULL
        ELSE v_visitor.conversation_count
      END,
      CASE
        WHEN p_visitor_id IS NULL THEN NULL
        ELSE v_visitor.last_conversation_started_at
      END
    )
    RETURNING * INTO v_conversation;

    IF p_visitor_id IS NOT NULL THEN
      UPDATE analytics.browser_visitors
      SET
        conversation_count = conversation_count + 1,
        last_conversation_started_at = v_started_at,
        last_seen_at = v_started_at
      WHERE visitor_id = p_visitor_id;
    END IF;

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
    v_conversation_created,
    v_conversation.previous_conversation_count;
END;
$$;

REVOKE ALL ON FUNCTION analytics.record_chat_request(
  uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;