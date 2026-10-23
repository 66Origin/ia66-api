BEGIN;

-- Credentials are configured separately and must never enter the repository.
CREATE ROLE o_analytics_writer
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO o_analytics_writer;
GRANT USAGE ON SCHEMA analytics TO o_analytics_writer;

GRANT SELECT
  ON analytics.browser_visitors,
     analytics.conversations,
     analytics.chat_requests
  TO o_analytics_writer;

GRANT INSERT (
  visitor_id,
  recognition_expires_at
)
  ON analytics.browser_visitors
  TO o_analytics_writer;

GRANT UPDATE (
  last_seen_at,
  conversation_count,
  last_conversation_started_at
)
  ON analytics.browser_visitors
  TO o_analytics_writer;

GRANT INSERT (
  conversation_id,
  visitor_id,
  started_at,
  placement,
  recognition_status,
  previous_conversation_count,
  previous_conversation_started_at
)
  ON analytics.conversations
  TO o_analytics_writer;

GRANT INSERT (
  request_id,
  conversation_id
)
  ON analytics.chat_requests
  TO o_analytics_writer;

GRANT UPDATE (
  status,
  completed_at,
  generation_duration_ms,
  error_stage,
  error_code
)
  ON analytics.chat_requests
  TO o_analytics_writer;

GRANT EXECUTE ON FUNCTION analytics.record_chat_request(
  uuid, uuid, uuid, text
)
  TO o_analytics_writer;

-- These policies apply exclusively to the trusted server role.
-- Existing table constraints continue to validate the stored values.

CREATE POLICY o_writer_select_visitors
  ON analytics.browser_visitors
  FOR SELECT
  TO o_analytics_writer
  USING (true);

CREATE POLICY o_writer_insert_visitors
  ON analytics.browser_visitors
  FOR INSERT
  TO o_analytics_writer
  WITH CHECK (true);

CREATE POLICY o_writer_update_visitors
  ON analytics.browser_visitors
  FOR UPDATE
  TO o_analytics_writer
  USING (true)
  WITH CHECK (true);

CREATE POLICY o_writer_select_conversations
  ON analytics.conversations
  FOR SELECT
  TO o_analytics_writer
  USING (true);

CREATE POLICY o_writer_insert_conversations
  ON analytics.conversations
  FOR INSERT
  TO o_analytics_writer
  WITH CHECK (true);

CREATE POLICY o_writer_select_requests
  ON analytics.chat_requests
  FOR SELECT
  TO o_analytics_writer
  USING (true);

CREATE POLICY o_writer_insert_requests
  ON analytics.chat_requests
  FOR INSERT
  TO o_analytics_writer
  WITH CHECK (true);

CREATE POLICY o_writer_update_requests
  ON analytics.chat_requests
  FOR UPDATE
  TO o_analytics_writer
  USING (status = 'received')
  WITH CHECK (status IN ('generated', 'failed'));

COMMIT;