import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const tickers = ['itub4', 'wege3', 'mglu3', 'petr4'];
const endpoints = [
  'quote',
  'statistics',
  'financial-data',
  'income-statement',
  'balance-sheet',
  'dividends',
  'profile',
];

function readFixture(ticker: string, endpoint: string) {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'brapi', `${ticker}-${endpoint}.json`), 'utf8'),
  ) as {
    results?: Array<{
      requestedSymbol?: string;
      symbol?: string;
      data?: Record<string, unknown> | Array<Record<string, unknown>>;
    }>;
    error?: boolean;
    code?: string;
    message?: string;
  };
}

test('stores a response or explicit provider denial for every discovery request', () => {
  for (const ticker of tickers) {
    for (const endpoint of endpoints) {
      const fixture = readFixture(ticker, endpoint);
      if (fixture.error) {
        assert.ok(fixture.code, `${ticker} ${endpoint} error has a provider code`);
        assert.ok(fixture.message, `${ticker} ${endpoint} error has a reason`);
        continue;
      }

      const result = fixture.results?.[0];
      assert.equal(result?.requestedSymbol, ticker.toUpperCase());
      assert.ok(result?.data, `${ticker} ${endpoint} contains data`);
    }
  }
});

test('fixtures expose the selected source fields for the table', () => {
  const quote = readFixture('petr4', 'quote').results?.[0]?.data as Record<string, unknown>;
  const statistics = readFixture('mglu3', 'statistics').results?.[0]?.data as Record<string, unknown>;
  const financialData = readFixture('petr4', 'financial-data').results?.[0]?.data as Record<string, unknown>;
  const dividends = readFixture('petr4', 'dividends').results?.[0]?.data as Record<string, unknown>;
  const income = readFixture('mglu3', 'income-statement').results?.[0]?.data as Array<Record<string, unknown>>;

  assert.equal(typeof quote.regularMarketPrice, 'number');
  assert.equal(typeof quote.regularMarketTime, 'string');
  assert.match(String(quote.logourl), /^https:\/\/icons\.brapi\.dev\/icons\/PETR4\.svg$/);
  assert.equal(typeof statistics.trailingEps, 'number');
  assert.equal(typeof statistics.bookValue, 'number');
  assert.equal(typeof financialData.returnOnEquity, 'number');
  assert.ok(Array.isArray(dividends.cashDividends));
  assert.ok(income.some((record) => record.netIncome === -498975000));
  assert.equal(readFixture('wege3', 'financial-data').code, 'MODULES_NOT_AVAILABLE');
});
