import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatQuarter,
  formatRatio,
  tickerInitials,
} from '../lib/market/format.ts';

test('formats financial values for Brazilian Portuguese and preserves unavailable values', () => {
  assert.match(formatCurrency(1234.5), /R\$\s*1\.234,50/);
  assert.match(formatCompactCurrency(1200000), /1,2/);
  assert.equal(formatPercent(0.1234), '12,3%');
  assert.equal(formatRatio(1.234), '1,23');
  assert.equal(formatCurrency(null), '—');
  assert.equal(formatCompactCurrency(null), '—');
  assert.equal(formatPercent(null), '—');
  assert.equal(formatRatio(null), '—');
});

test('formats reference quarters and logo fallback initials', () => {
  assert.equal(formatQuarter('2026-06-30'), 'T2/2026');
  assert.equal(formatQuarter(null), '—');
  assert.equal(tickerInitials('petr4'), 'PE');
});
