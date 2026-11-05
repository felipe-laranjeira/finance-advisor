import { createServer } from 'node:http';

const companies = [
  {
    id: 'petrobras',
    name: 'Petróleo Brasileiro S.A.',
    sector: 'Petróleo, gás e biocombustíveis',
    logo_url: 'https://icons.brapi.dev/icons/PETR4.svg',
  },
  {
    id: 'magazine-luiza',
    name: 'Magazine Luiza S.A.',
    sector: 'Consumo cíclico',
    logo_url: 'https://icons.brapi.dev/icons/MGLU3.svg',
  },
];

const tables = {
  tickers: [
    { symbol: 'PETR4', company_id: 'petrobras', financial_institution_type: 'none' },
    { symbol: 'MGLU3', company_id: 'magazine-luiza', financial_institution_type: 'none' },
  ],
  companies,
  prices_latest: [
    {
      ticker: 'PETR4',
      price: '40.0000',
      quote_at: '2026-11-03T18:00:00.000Z',
      fetched_at: '2026-11-03T18:01:00.000Z',
      is_stale: false,
    },
    {
      ticker: 'MGLU3',
      price: '8.0000',
      quote_at: '2026-11-03T18:00:00.000Z',
      fetched_at: '2026-11-03T18:01:00.000Z',
      is_stale: false,
    },
  ],
  fundamentals_latest: [
    {
      ticker: 'PETR4',
      reference_period_end: '2026-09-30',
      period_type: 'ttm',
      revenue: '10000000000',
      net_income: '1000000000',
      ebitda: '2000000000',
      total_debt: '5000000000',
      cash: '2000000000',
      eps: '3.00',
      book_value_per_share: '20.00',
      roe: '0.10',
      shares_outstanding: '1000000000',
      fetched_at: '2026-11-03T18:01:00.000Z',
      is_stale: false,
      last_error: null,
    },
  ],
  financials_annual: [
    {
      ticker: 'PETR4',
      fiscal_year_end: '2025-12-31',
      consolidation_type: 'consolidated',
      revenue: '10000000000',
      net_income: '1000000000',
      cost_of_revenue: '-5000000000',
      selling_general_administrative: '-1000000000',
      other_operating_expenses: '-1000000000',
    },
  ],
  dividends_history: [2021, 2022, 2023, 2024, 2025].map((year) => ({
    ticker: 'PETR4',
    event_type: 'dividend',
    amount_per_share: '1.00',
    entitlement_date: `${year}-06-15`,
  })),
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:54321');
  if (url.pathname === '/health') {
    response.writeHead(200).end('ok');
    return;
  }

  const table = url.pathname.split('/').pop();
  const rows = tables[table];
  if (!rows) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'Unknown mock table' }));
    return;
  }

  response.writeHead(200, {
    'content-type': 'application/json',
    'content-range': `0-${rows.length - 1}/${rows.length}`,
  });
  response.end(JSON.stringify(rows));
});

server.listen(54321, '127.0.0.1');
