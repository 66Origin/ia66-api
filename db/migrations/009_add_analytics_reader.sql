BEGIN;

-- Read-only role used by the administration dashboard only.
-- Credentials are configured separately and must never enter the repository.
CREATE ROLE o_analytics_reader
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO o_analytics_reader;
GRANT USAGE ON SCHEMA analytics TO o_analytics_reader;

GRANT SELECT
  ON analytics.conversations,
     analytics.chat_requests,
     analytics.request_classifications,
     analytics.unanswered_questions,
     analytics.monthly_conversation_stats,
     analytics.monthly_request_stats
  TO o_analytics_reader;

CREATE POLICY o_reader_select_conversations
  ON analytics.conversations
  FOR SELECT
  TO o_analytics_reader
  USING (true);

CREATE POLICY o_reader_select_requests
  ON analytics.chat_requests
  FOR SELECT
  TO o_analytics_reader
  USING (true);

CREATE POLICY o_reader_select_classifications
  ON analytics.request_classifications
  FOR SELECT
  TO o_analytics_reader
  USING (true);

CREATE POLICY o_reader_select_unanswered
  ON analytics.unanswered_questions
  FOR SELECT
  TO o_analytics_reader
  USING (true);

CREATE POLICY o_reader_select_monthly_conversations
  ON analytics.monthly_conversation_stats
  FOR SELECT
  TO o_analytics_reader
  USING (true);

CREATE POLICY o_reader_select_monthly_requests
  ON analytics.monthly_request_stats
  FOR SELECT
  TO o_analytics_reader
  USING (true);

COMMIT;
