import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareMarketColumnValues,
  DEFAULT_MARKET_COLUMNS,
  getVisibleMarketColumns,
  MARKET_COLUMNS,
  MARKET_COLUMN_CONFIG_VERSION,
  migrateLegacyColumnPreference,
} from '../lib/market/columns.ts';

test('defines the requested default and optional columns in display order', () => {
  assert.deepEqual(DEFAULT_MARKET_COLUMNS, [
    'ticker',
    'company',
    'price',
    'revenue',
    'netIncome',
    'netMargin',
    'dividendYield',
    'ceiling',
    'fairPrice',
    'status',
  ]);
  assert.deepEqual(
    MARKET_COLUMNS.filter((column) => column.optional).map((column) => column.id),
    ['sector', 'operatingExpenses', 'pe', 'pb', 'roe', 'netDebtToEbitda'],
  );
  assert.ok(MARKET_COLUMNS.every((column) => column.sortable && column.description));
});

test('parses URL column ids, ignores unknowns and duplicates, and keeps required columns', () => {
  assert.deepEqual(getVisibleMarketColumns(null), DEFAULT_MARKET_COLUMNS);
  assert.deepEqual(getVisibleMarketColumns('price,roe,price,unknown'), [
    'ticker',
    'price',
    'status',
    'roe',
  ]);
  assert.deepEqual(getVisibleMarketColumns('ticker'), ['ticker', 'status']);
  assert.deepEqual(getVisibleMarketColumns(['pb', 'pe']), [
    'ticker',
    'status',
    'pe',
    'pb',
  ]);
});

test('returns the default selection for empty or entirely invalid URL values', () => {
  assert.deepEqual(getVisibleMarketColumns(''), DEFAULT_MARKET_COLUMNS);
  assert.deepEqual(getVisibleMarketColumns('unknown,invalid'), DEFAULT_MARKET_COLUMNS);
});

test('keeps missing values last in either sort direction', () => {
  assert.equal(compareMarketColumnValues(null, 10, 'asc'), 1);
  assert.equal(compareMarketColumnValues(null, 10, 'desc'), 1);
  assert.equal(compareMarketColumnValues(10, null, 'asc'), -1);
  assert.equal(compareMarketColumnValues(10, null, 'desc'), -1);
  assert.equal(compareMarketColumnValues(2, 10, 'asc'), -8);
  assert.equal(compareMarketColumnValues('A', 'B', 'desc'), 1);
});

test('discards the unversioned local preference and records the current config version', () => {
  const values = new Map([
    ['market-home-columns', JSON.stringify(['ticker', 'price'])],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  migrateLegacyColumnPreference(storage);

  assert.equal(values.has('market-home-columns'), false);
  assert.equal(values.get('market-home-columns-version'), MARKET_COLUMN_CONFIG_VERSION);
});
