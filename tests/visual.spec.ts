import path from 'node:path';
import { expect, test } from '@playwright/test';

const prints = path.resolve('Documentacao/prints');

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('gera prints visuais oficiais', async ({ page }) => {
  await page.goto('/cliente');
  await page.screenshot({ path: path.join(prints, '01-cliente-home.png'), fullPage: true });

  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar como Vendedor' }).click();
  await page.goto('/admin/caixa');
  await page.getByRole('button', { name: 'Abrir caixa agora' }).click();
  await page.goto('/vendedor');
  await expect(page.getByRole('heading', { name: 'Nova venda' })).toBeVisible();
  await page.screenshot({ path: path.join(prints, '02-vendedor-home.png'), fullPage: true });

  await page.goto('/vendedor/nova-venda');
  await page.getByRole('button', { name: /Cliente Presencial/ }).click();
  await page.screenshot({ path: path.join(prints, '03-venda-qr.png'), fullPage: true });

  await page.goto('/admin/relatorios');
  await page.screenshot({ path: path.join(prints, '04-relatorios.png'), fullPage: true });

  await page.goto('/cliente/familia');
  await page.getByRole('button', { name: 'Criar cartão familiar' }).click();
  await page.screenshot({ path: path.join(prints, '05-familia-indicacao.png'), fullPage: true });

  await page.goto('/documentacao/index.html');
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.screenshot({ path: path.join(prints, '06-portal-documentacao.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(prints, '07-portal-documentacao-mobile.png'), fullPage: true });
});
