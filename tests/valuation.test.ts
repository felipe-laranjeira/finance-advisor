import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ceilingPrice,
  classify,
  dividendYield,
  dividendsPerShare12m,
  fairPrice,
  marginOfSafety,
  netDebtToEbitda,
  netMargin,
  operatingExpenses,
  priceToBook,
  priceToEarnings,
} from '../lib/valuation.ts';

test('calculates margin, valuation multiples, and Graham fair price', () => {
  assert.equal(netMargin(50, 100).value, 0.5);
  assert.equal(priceToEarnings(30, 3).value, 10);
  assert.equal(priceToBook(30, 15).value, 2);
  assert.equal(fairPrice(2, 8).value, Math.sqrt(22.5 * 2 * 8));
});

test('does not calculate earnings or book multiples for invalid inputs', () => {
  assert.deepEqual(priceToEarnings(30, -1).reasons, ['negative_earnings']);
  assert.deepEqual(priceToEarnings(30, 0).reasons, ['negative_earnings']);
  assert.deepEqual(priceToBook(30, -1).reasons, ['missing_data']);
  assert.equal(netMargin(50, 0).value, null);
});

test('sums JCP and dividends by entitlement date in the trailing twelve months', () => {
  const result = dividendsPerShare12m(
    [
      { amountPerShare: 0.2, type: 'jcp', entitlementDate: '2026-05-10' },
      { amountPerShare: 0.3, type: 'dividend', entitlementDate: '2026-05-10' },
      { amountPerShare: 5, type: 'rendimento', entitlementDate: '2026-05-10' },
      { amountPerShare: 1, type: 'dividend', entitlementDate: '2025-10-31' },
      { amountPerShare: 1, type: 'dividend', entitlementDate: '2026-11-03' },
    ],
    '2026-11-02',
  );

  assert.equal(result.value, 0.5);
  assert.deepEqual(result.reasons, []);
  assert.equal(dividendYield(result.value, 10).value, 0.05);
});

test('uses five complete calendar years or the disclosed twelve-month fallback', () => {
  const fiveYearHistory = [1, 2, 3, 4, 5].map((amountPerShare, index) => ({
    amountPerShare,
    type: 'dividend',
    entitlementDate: `${2021 + index}-06-01`,
  }));
  const fiveYearCeiling = ceilingPrice(fiveYearHistory, '2026-11-02');

  assert.equal(fiveYearCeiling.value, 3 / 0.06);
  assert.equal(fiveYearCeiling.windowUsed, 'avg_5_full_calendar_years');
  assert.equal(fiveYearCeiling.formula, 'bazin-6pct-avg5y@1');

  const shortHistory = ceilingPrice(
    [
      { amountPerShare: 0.4, type: 'jcp', entitlementDate: '2026-02-01' },
      { amountPerShare: 0.6, type: 'dividend', entitlementDate: '2026-05-01' },
    ],
    '2026-11-02',
  );

  assert.equal(shortHistory.value, 1 / 0.06);
  assert.equal(shortHistory.windowUsed, 'last_12_months');
  assert.deepEqual(shortHistory.reasons, ['insufficient_history']);
});

test('returns no ceiling when no dividend history is available', () => {
  const result = ceilingPrice([], '2026-11-02');

  assert.equal(result.value, null);
  assert.deepEqual(result.reasons, ['no_dividends']);
});

test('classifies a price equal to the ceiling as below the ceiling', () => {
  const result = classify(50, 50, 75);

  assert.equal(result.status, 'below_ceiling');
  assert.deepEqual(result.reasons, []);
  assert.equal(marginOfSafety(50, 50).value, 0);
});

test('does not present a misleading classification or bank leverage ratio', () => {
  assert.equal(classify(20, null, null, ['negative_earnings']).status, 'not_applicable');
  assert.deepEqual(fairPrice(-1, 10).reasons, ['negative_earnings']);
  assert.equal(netDebtToEbitda(100, 25, 15, 'bank').value, null);
  assert.deepEqual(netDebtToEbitda(100, 25, 15, 'insurer').reasons, ['not_applicable']);
  assert.equal(netDebtToEbitda(100, 25, 0).value, null);
  assert.equal(operatingExpenses(-100, -20, -5).value, 125);
  assert.equal(operatingExpenses(-100, -20, -5, 'bank').value, null);
  assert.equal(marginOfSafety(null, 10).value, null);
});
