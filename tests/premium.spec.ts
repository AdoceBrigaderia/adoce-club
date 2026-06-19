import { expect, test, type Page } from '@playwright/test';

async function mockBetaApi(page: Page) {
  await page.route('**/.netlify/functions/sale-create', async route => {
    await route.fulfill({ json: { id: 'sale-cloud', token: 'ADOCE-PREMIUM-TESTE' } });
  });
  await page.route('**/.netlify/functions/products-upsert', async route => {
    await route.fulfill({ json: { ok: true } });
  });
}

async function clearState(page: Page) {
  await page.goto('/premium-preview');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await mockBetaApi(page);
  await clearState(page);
});

test('premium separa cliente e operação em rotas próprias', async ({ page }) => {
  await page.goto('/premium-cliente');
  await expect(page.getByRole('button', { name: 'Vitrine' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Caixa' })).toHaveCount(0);

  await page.goto('/premium-operacao');
  await expect(page.getByRole('button', { name: 'Caixa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vitrine' })).toHaveCount(0);
});

test('premium registra venda com vários sabores, baixa estoque e mostra QR', async ({ page }) => {
  await page.goto('/premium-operacao');
  await expect(page.getByText(/no estoque/)).toBeVisible();

  await page.getByRole('button', { name: /Chocolatudo 6 disp/ }).click();
  await page.getByRole('button', { name: /Chocolatudo 6 disp/ }).click();
  await page.getByRole('button', { name: /Ferrero 6 disp/ }).click();
  await expect(page.getByText(/3 fatias.*48,00/)).toBeVisible();

  await page.getByRole('button', { name: 'Pix' }).click();
  await page.getByRole('button', { name: 'Fechar venda' }).click();
  await expect(page.getByText('Cliente escaneia para receber carimbos')).toBeVisible();
  await expect(page.locator('.pp-sale-qr svg')).toBeVisible();
  await expect(page.getByRole('button', { name: /Chocolatudo 4 disp/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ferrero 5 disp/ })).toBeVisible();
});

test('premium Mercado Pago pendente só libera QR após aprovação', async ({ page }) => {
  await page.goto('/premium-operacao');
  await page.getByRole('button', { name: /Chocolatudo 6 disp/ }).click();
  await page.getByRole('button', { name: 'Mercado Pago Point' }).click();
  await page.getByRole('button', { name: 'Fechar venda' }).click();

  await expect(page.getByText('Aguardando confirmação')).toBeVisible();
  await expect(page.locator('.pp-sale-qr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pagamento aprovado' }).click();
  await expect(page.getByText('Cliente escaneia para receber carimbos')).toBeVisible();
});

test('premium cliente cria reserva e operação lista/cancela com observação', async ({ page }) => {
  await page.goto('/premium-cliente');
  await page.getByRole('button', { name: 'Compra' }).click();
  await page.getByRole('button', { name: /Chocolatudo/ }).click();
  await page.getByRole('button', { name: /Ferrero/ }).click();
  await page.getByRole('button', { name: 'Fechar compra' }).click();
  await expect(page.getByText(/Reserva/)).toBeVisible();

  await page.goto('/premium-operacao');
  await page.getByRole('button', { name: /Reservas/ }).click();
  await expect(page.getByRole('heading', { name: 'Reservas antecipadas' })).toBeVisible();
  await expect(page.getByText('1x Chocolatudo')).toBeVisible();
  await expect(page.getByText('1x Ferrero Rocher')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await page.getByLabel('Observação do cancelamento').fill('Cliente pediu cancelamento pelo WhatsApp.');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText('Nenhuma reserva ativa.')).toBeVisible();
});

test('premium não cria overflow horizontal em mobile, tablet e desktop', async ({ page }) => {
  const sizes = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 900 },
  ];

  for (const viewport of sizes) {
    await page.setViewportSize(viewport);
    for (const route of ['/premium-cliente', '/premium-operacao']) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(2);
    }
  }
});
