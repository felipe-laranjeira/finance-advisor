import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('https://icons.brapi.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#fff"/></svg>',
    }),
  );
});

test('opens a stock page and restores list filters, sorting, and visible columns', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Buscar ticker ou empresa').fill('PETR4');
  await page.getByRole('button', { name: 'Ordenar por Preço', exact: true }).click();
  await page.getByRole('button', { name: 'Colunas' }).click();
  await page.getByRole('checkbox', { name: 'Empresa' }).uncheck();
  await page.getByRole('button', { name: 'Colunas' }).click();

  const tickerLink = page.getByRole('link', { name: 'Ver análise de PETR4, Petróleo Brasileiro S.A.' });
  await expect(tickerLink).toBeVisible();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    tickerLink.click(),
  ]);

  await expect(page).toHaveURL(/\/acoes\/PETR4\?/);
  await expect(page.getByRole('heading', { name: 'Petróleo Brasileiro S.A.' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para a lista' }).click();

  await expect(page).toHaveURL(/q=PETR4/);
  await expect(page.getByPlaceholder('Buscar ticker ou empresa')).toHaveValue('PETR4');
  await expect(page.getByRole('button', { name: 'Ordenar por Preço', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Empresa/ })).toHaveCount(0);
});

test('activates the ticker link with the keyboard', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const tickerLink = page.getByRole('link', { name: 'Ver análise de PETR4, Petróleo Brasileiro S.A.' });
  await tickerLink.focus();
  await expect(tickerLink).toBeFocused();
  await tickerLink.press('Enter');
  await expect(page).toHaveURL(/\/acoes\/PETR4/);
});

test('shows a friendly 404 for tickers outside the active public universe', async ({ page }) => {
  await page.goto('/acoes/ZZZZ3', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Este ticker não está disponível' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar para a lista' })).toBeVisible();
});

test('renders missing fundamentals and falls back when a logo fails', async ({ page }) => {
  await page.route('**/MGLU3.svg*', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('/acoes/MGLU3', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Magazine Luiza S.A.' })).toBeVisible();
  await expect(page.getByText('Dado ausente ou sem base válida').first()).toBeVisible();
  await expect(page.getByTestId('stock-logo-MGLU3')).toHaveText('MG');
});

test('keeps the stock detail usable on mobile and has no automated accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/acoes/PETR4', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Petróleo Brasileiro S.A.' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
