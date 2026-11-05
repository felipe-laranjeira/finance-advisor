import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261101000000_create_stock_fundamentals.sql'),
  'utf8',
);
const logoMigration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261104000000_add_company_logo_url.sql'),
  'utf8',
);

test('fundamental tables grant public reads but reserve writes for service_role', () => {
  for (const table of ['fundamentals_latest', 'financials_annual', 'dividends_history']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`ON public\\.${table}[\\s\\S]*?FOR SELECT`));
  }

  assert.match(
    migration,
    /REVOKE ALL ON public\.fundamentals_latest, public\.financials_annual, public\.dividends_history\s+FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    migration,
    /GRANT SELECT ON public\.fundamentals_latest, public\.financials_annual, public\.dividends_history\s+TO anon, authenticated/,
  );
  assert.match(
    migration,
    /GRANT ALL ON public\.fundamentals_latest, public\.financials_annual, public\.dividends_history\s+TO service_role/,
  );
  assert.doesNotMatch(
    migration,
    /CREATE POLICY[\s\S]*?FOR (?:INSERT|UPDATE|DELETE)[\s\S]*?TO (?:anon|authenticated)/,
  );
});

test('adds only a nullable company logo URL without granting visitor writes', () => {
  assert.match(logoMigration, /ALTER TABLE public\.companies\s+ADD COLUMN logo_url TEXT/);
  assert.doesNotMatch(logoMigration, /NOT NULL|GRANT|POLICY/i);
});
