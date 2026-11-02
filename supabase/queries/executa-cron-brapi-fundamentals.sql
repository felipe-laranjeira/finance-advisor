SELECT net.http_post(
  url := rtrim(
    (SELECT decrypted_secret
     FROM vault.decrypted_secrets
     WHERE name = 'project_url'),
    '/'
  ) || '/functions/v1/fundamentals-snapshot',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'publishable_key'
    ),
    'x-market-job-secret', (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'market_job_secret'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 300000
) AS request_id;