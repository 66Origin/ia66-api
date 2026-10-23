BEGIN;

CREATE TABLE analytics.request_classifications (
  request_id uuid PRIMARY KEY
    REFERENCES analytics.chat_requests(request_id),

  subject text,
  intent text,

  classification_status text NOT NULL
    CHECK (
      classification_status IN (
        'classified',
        'unclassifiable',
        'failed'
      )
    ),

  classification_version text NOT NULL
    CHECK (classification_version = 'v1'),

  classified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT classification_subject_valid CHECK (
    subject IN (
      'agency_team',
      'expertise_services',
      'projects_references',
      'method_collaboration',
      'careers',
      'news_content',
      'other'
    )
  ),

  CONSTRAINT classification_intent_valid CHECK (
    intent IN (
      'get_information',
      'explore_references',
      'evaluate_agency',
      'get_contact',
      'apply',
      'propose_partnership',
      'other'
    )
  ),

  CONSTRAINT classification_result_consistent CHECK (
    (
      classification_status = 'classified'
      AND subject IS NOT NULL
      AND intent IS NOT NULL
      AND classified_at IS NOT NULL
    )
    OR
    (
      classification_status = 'unclassifiable'
      AND subject IS NULL
      AND intent IS NULL
      AND classified_at IS NOT NULL
    )
    OR
    (
      classification_status = 'failed'
      AND subject IS NULL
      AND intent IS NULL
      AND classified_at IS NULL
    )
  )
);

ALTER TABLE analytics.request_classifications
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics.request_classifications
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT
  ON analytics.request_classifications
  TO o_analytics_writer;

GRANT INSERT (
  request_id,
  subject,
  intent,
  classification_status,
  classification_version,
  classified_at
)
  ON analytics.request_classifications
  TO o_analytics_writer;

CREATE POLICY o_writer_select_classifications
  ON analytics.request_classifications
  FOR SELECT
  TO o_analytics_writer
  USING (true);

CREATE POLICY o_writer_insert_classifications
  ON analytics.request_classifications
  FOR INSERT
  TO o_analytics_writer
  WITH CHECK (true);

COMMIT;