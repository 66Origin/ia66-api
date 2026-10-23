BEGIN;

CREATE SCHEMA analytics;

REVOKE ALL ON SCHEMA analytics
FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE analytics.browser_visitors (
  visitor_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  conversation_count integer NOT NULL DEFAULT 0,
  last_conversation_started_at timestamptz,
  recognition_expires_at timestamptz,

  CONSTRAINT visitor_count_nonnegative
    CHECK (conversation_count >= 0)
);

CREATE TABLE analytics.conversations (
  conversation_id uuid PRIMARY KEY,

  visitor_id uuid
    REFERENCES analytics.browser_visitors(visitor_id)
    ON DELETE SET NULL,

  started_at timestamptz NOT NULL DEFAULT now(),

  placement text NOT NULL
    CHECK (placement IN ('home', 'global')),

  recognition_status text NOT NULL
    CHECK (recognition_status IN ('known', 'unknown')),

  previous_conversation_count integer,
  previous_conversation_started_at timestamptz,

  CONSTRAINT conversation_recognition_consistent CHECK (
    (
      recognition_status = 'known'
      AND previous_conversation_count IS NOT NULL
      AND previous_conversation_count >= 0
    )
    OR
    (
      recognition_status = 'unknown'
      AND previous_conversation_count IS NULL
      AND previous_conversation_started_at IS NULL
    )
  )
);

CREATE TABLE analytics.chat_requests (
  request_id uuid PRIMARY KEY,

  conversation_id uuid NOT NULL
    REFERENCES analytics.conversations(conversation_id),

  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'generated', 'failed')),

  generation_duration_ms integer
    CHECK (generation_duration_ms >= 0),

  error_stage text,
  error_code text
);

CREATE INDEX conversations_started_at_idx
  ON analytics.conversations(started_at);

CREATE INDEX conversations_visitor_id_idx
  ON analytics.conversations(visitor_id);

CREATE INDEX chat_requests_conversation_id_idx
  ON analytics.chat_requests(conversation_id);

CREATE INDEX chat_requests_received_at_idx
  ON analytics.chat_requests(received_at);

ALTER TABLE analytics.browser_visitors
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE analytics.conversations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE analytics.chat_requests
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA analytics
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;