import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const defaultHeaders = [
  'Ticker',
  'Empresa',
  'Preço',
  'Receita',
  'Lucro líquido',
  'Margem líquida',
  'Dividend yield',
  'Preço teto',
  'Preço justo',
  'Situação',
];

test.beforeEach(async ({ page }) => {
  await page.route('https://icons.brapi.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#fff"/></svg>',
    }),
  );
});

async function getVisibleHeaderLabels(page: import('@playwright/test').Page) {
  return page.locator('thead th button[aria-label^="Ordenar por"]').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')?.replace('Ordenar por ', '')),
  );
}

async function waitForMarketHomeReady(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-market-home-ready="true"]')).toBeAttached();
}

test('renders exactly the default columns in the requested order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);

  await expect(page.locator('thead th')).toHaveCount(10);
  expect(await getVisibleHeaderLabels(page)).toEqual(defaultHeaders);
});

test('renders URL-selected columns in the initial server HTML', async ({ page }) => {
  const response = await page.request.get('http://127.0.0.1:3001/?cols=price,roe');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const labels = [...html.matchAll(/<th\b[\s\S]*?<\/th>/g)]
    .map((header) => header[0].match(/aria-label="Ordenar por ([^"]+)"/)?.[1])
    .filter((label): label is string => label !== undefined);

  expect(labels).toEqual([
    'Ticker',
    'Preço',
    'Situação',
    'ROE',
  ]);
});

test('updates the URL when options are selected and restores the default selection', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  await page.getByRole('button', { name: 'Colunas' }).click();
  await expect(page.getByRole('checkbox', { name: 'Empresa' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'P/L' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'P/L' }).check();
  await page.getByRole('checkbox', { name: 'ROE' }).check();

  await expect.poll(() => new URL(page.url()).searchParams.get('cols')).toContain('pe');
  await expect.poll(() => new URL(page.url()).searchParams.get('cols')).toContain('roe');
  await expect(page.locator('thead th')).toHaveCount(12);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('thead th')).toHaveCount(12);
  const columnsButton = page.getByRole('button', { name: 'Colunas' });
  if ((await columnsButton.getAttribute('aria-expanded')) !== 'true') {
    await columnsButton.click();
  }
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();

  await expect(page.locator('thead th')).toHaveCount(10);
  await expect.poll(() => new URL(page.url()).searchParams.has('cols')).toBe(false);
});

test('operates the column selector and default reset with the keyboard', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  const columnsButton = page.getByRole('button', { name: 'Colunas' });
  await columnsButton.focus();
  await columnsButton.press('Enter');

  const priceEarnings = page.getByRole('checkbox', { name: 'P/L' });
  await priceEarnings.focus();
  await priceEarnings.press('Space');
  await expect(priceEarnings).toBeChecked();

  const reset = page.getByRole('button', { name: 'Restaurar padrão' });
  await reset.focus();
  await reset.press('Enter');
  await expect(page.locator('thead th')).toHaveCount(10);
});

test('normalizes empty and invalid column ids without breaking the page', async ({ page }) => {
  await page.goto('/?cols=unknown,invalid', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  await expect(page.locator('thead th')).toHaveCount(10);
  await page.goto('/?cols=', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  await expect(page.locator('thead th')).toHaveCount(10);
});

test('sorts missing values last in both directions and exposes sort state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  const revenueHeader = page.getByRole('columnheader', { name: /Receita/ });
  const revenueSortButton = page.getByRole('button', { name: 'Ordenar por Receita' });

  await revenueSortButton.click();
  await expect(revenueHeader).toHaveAttribute('aria-sort', 'ascending');
  let tickers = await page.locator('tbody tr a[aria-label^="Ver análise"]').evaluateAll((links) =>
    links.map((link) => link.textContent?.trim()),
  );
  expect(tickers.at(-1)).toBe('MGLU3');

  await revenueSortButton.click();
  await expect(revenueHeader).toHaveAttribute('aria-sort', 'descending');
  tickers = await page.locator('tbody tr a[aria-label^="Ver análise"]').evaluateAll((links) =>
    links.map((link) => link.textContent?.trim()),
  );
  expect(tickers.at(-1)).toBe('MGLU3');
});

test('fits the default table at 1280px and shows the required fields in mobile cards', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desktopOverflow).toBe(false);
  const defaultTableOverflow = await page.locator('table').evaluate((table) => {
    const container = table.parentElement;
    return container !== null && table.scrollWidth > container.clientWidth;
  });
  expect(defaultTableOverflow).toBe(false);
  await page.getByRole('button', { name: 'Colunas' }).click();
  await page.getByRole('checkbox', { name: 'P/L' }).check();
  const oneOptionalColumnOverflows = await page.locator('table').evaluate((table) => {
    const container = table.parentElement;
    return container !== null && table.scrollWidth > container.clientWidth;
  });
  expect(oneOptionalColumnOverflows).toBe(false);
  await page.getByRole('button', { name: 'Colunas' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  const firstCard = page.locator('ul.lg\\:hidden li').first();
  await expect(firstCard.getByText('Preço teto', { exact: true })).toBeVisible();
  await expect(firstCard.getByText('Preço justo', { exact: true })).toBeVisible();
  await expect(firstCard.getByText('Receita', { exact: true })).toBeVisible();
  await expect(firstCard.getByText('Lucro líquido', { exact: true })).toBeVisible();
  await expect(firstCard.getByText('Dividend yield', { exact: true })).toBeVisible();
  const optionalColumns = firstCard.getByText('Outras colunas selecionadas (1)', {
    exact: true,
  });
  await expect(optionalColumns).toBeVisible();
  await optionalColumns.click();
  await expect(firstCard.getByText('P/L', { exact: true })).toBeVisible();
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(mobileOverflow).toBe(false);
});

test('opens accessible header help with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMarketHomeReady(page);
  const help = page.getByRole('columnheader', { name: /Preço teto/ })
    .getByRole('button', { name: 'Sobre Preço teto' });

  await help.focus();
  await expect(help).toBeFocused();
  await help.press('Enter');
  await expect(
    page.getByRole('tooltip').filter({ hasText: 'Bazin/Barsi' }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
