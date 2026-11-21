import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const checkedExtensions = new Set([...sourceExtensions, '.sql', '.json', '.md', '.toml']);

function listFiles(directory: string): string[] {
  if (!statSync(directory, { throwIfNoEntry: false })) return [];
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? listFiles(file) : [file];
  });
}

function sourceFiles() {
  return [
    ...[
      'app',
      'components',
      'lib',
      'tests',
      'scripts',
      'supabase/functions',
      'supabase/migrations',
      'supabase/queries',
    ].flatMap((directory) =>
      listFiles(path.join(root, directory))
    ),
    ...['middleware.ts', 'next.config.ts', 'package.json', 'README.md'].map((file) =>
      path.join(root, file)
    ),
    path.join(root, '.env.example'),
  ].filter((file) => checkedExtensions.has(path.extname(file)) || file.endsWith('.env.example'));
}

test('application sources do not publish sensitive NEXT_PUBLIC environment variables', () => {
  const publicPrefix = ['NEXT', '_PUBLIC_'].join('');
  const sensitiveName = new RegExp(
    `${publicPrefix}[A-Z0-9_]*(?:${['KEY', 'SECRET', 'TOKEN', 'SERVICE', 'PASSWORD'].join('|')})[A-Z0-9_]*`,
    'g',
  );
  const allowed = new Set([
    `${publicPrefix}SUPABASE_URL`,
    `${publicPrefix}SUPABASE_ANON_KEY`,
  ]);
  const violations = sourceFiles().flatMap((file) => {
    const contents = readFileSync(file, 'utf8');
    return [...contents.matchAll(sensitiveName)]
      .map((match) => match[0])
      .filter((name) => !allowed.has(name))
      .map((name) => `${path.relative(root, file)}: ${name}`);
  });
  assert.deepEqual(violations, []);
});

test('Gemini SDK imports are restricted to the server AI module', () => {
  const sdkImport = new RegExp(`['"]${['@google', '/genai'].join('')}['"]`);
  const violations = sourceFiles().filter((file) => {
    if (!sourceExtensions.has(path.extname(file))) return false;
    if (path.relative(root, file) === path.join('lib', 'ai', 'server.ts')) return false;
    return sdkImport.test(readFileSync(file, 'utf8'));
  });
  assert.deepEqual(violations.map((file) => path.relative(root, file)), []);
});

test('source code contains no Google API key marker', () => {
  const keyMarker = ['AI', 'za'].join('');
  const violations = sourceFiles().filter((file) =>
    sourceExtensions.has(path.extname(file)) &&
    readFileSync(file, 'utf8').includes(keyMarker)
  );
  assert.deepEqual(violations.map((file) => path.relative(root, file)), []);
});

test('investment advice uses an HTML-safe Markdown renderer', () => {
  const component = readFileSync(
    path.join(root, 'components', 'InvestmentAdvisor.tsx'),
    'utf8',
  );
  assert.match(component, /ReactMarkdown/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|rehypeRaw/);
});

test('the AI usage migration keeps visitor writes disabled and enforces ownership', () => {
  const migration = readFileSync(
    path.join(root, 'supabase', 'migrations', '20261120000000_create_ai_usage.sql'),
    'utf8',
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(migration, /revoke all on public\.ai_usage from anon, authenticated/i);
  assert.match(migration, /grant select on public\.ai_usage to authenticated/i);
  assert.match(migration, /revoke all on function public\.consume_ai_usage\([\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.consume_ai_usage\([\s\S]*to service_role/i);
  assert.match(migration, /global_daily_count >= p_global_daily_limit/i);
});
