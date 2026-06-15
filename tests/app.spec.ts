import { expect, test } from '@playwright/test';

async function openCash(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar como Vendedor' }).click();
  await page.goto('/admin/caixa');
  await page.getByRole('button', { name: 'Abrir caixa agora' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('cliente vê cartão premium com 14 espaços e fatias', async ({ page }) => {
  await page.getByRole('button', { name: 'Entrar como Cliente' }).click();
  await expect(page.getByText('Seu cartão fidelidade')).toBeVisible();
  await expect(page.locator('.stamp')).toHaveCount(14);
  await expect(page.locator('.stamp img')).toHaveCount(9);
});

test('venda fica bloqueada sem caixa aberto', async ({ page }) => {
  await page.goto('/vendedor/nova-venda');
  await expect(page.getByText('Abra o caixa antes da primeira venda')).toBeVisible();
});

test('abre caixa, registra venda presencial e exibe QR Code', async ({ page }) => {
  await openCash(page);
  await page.goto('/vendedor/nova-venda');
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Pix' }).click();
  await page.getByRole('button', { name: /Cliente Presencial/ }).click();
  await expect(page.getByRole('heading', { name: 'Venda registrada!' })).toBeVisible();
  await expect(page.getByText('Peça ao cliente para escanear')).toBeVisible();
  await expect(page.locator('.qr svg')).toHaveCount(2);
});

test('delivery gera token, copia link e pode ser reaberto', async ({ page }) => {
  await openCash(page);
  await page.goto('/vendedor/nova-venda');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Cartão' }).click();
  await page.getByRole('button', { name: /Delivery \/ Retirada/ }).click();
  await expect(page.locator('.token')).toContainText('ADOCE-');
  await page.getByRole('button', { name: 'Copiar link' }).click();
  await expect(page.getByText('Link copiado.')).toBeVisible();
  await page.getByRole('link', { name: 'Ver vendas recentes' }).click();
  const rows = page.locator('.sale-row');
  await expect(rows).toHaveCount(3);
  await rows.locator('a').first().click();
  await expect(page.getByRole('heading', { name: 'Venda registrada!' })).toBeVisible();
});

test('cliente resgata token uma vez e mantém carimbos após recarregar', async ({ page }) => {
  await page.goto('/cliente/resgatar/ADOCE-A11');
  await page.getByRole('button', { name: 'Receber carimbos' }).click();
  await expect(page.getByText('Carimbos adicionados com sucesso!')).toBeVisible();
  await page.getByRole('button', { name: 'Ver meu cartão' }).click();
  await expect(page.getByText('11 de 14 carimbos')).toBeVisible();
  await page.reload();
  await expect(page.getByText('11 de 14 carimbos')).toBeVisible();
  await page.goto('/cliente/resgatar/ADOCE-A11');
  await page.getByRole('button', { name: 'Receber carimbos' }).click();
  await expect(page.getByText('Este token é inválido ou já foi usado.')).toBeVisible();
});

test('família e indicação têm regras claras', async ({ page }) => {
  await page.goto('/cliente/familia');
  await expect(page.getByText('Todos os membros compartilham os carimbos.')).toBeVisible();
  await page.getByRole('button', { name: 'Criar cartão familiar' }).click();
  await expect(page.getByText('Família Demo')).toBeVisible();
  await page.goto('/cliente/indicacoes');
  await expect(page.getByText('Quando seu amigo fizer a 1ª compra, você ganha +1 carimbo.')).toBeVisible();
  await page.getByRole('button', { name: /Simular primeira/ }).click();
  await expect(page.getByRole('button', { name: 'Bônus já liberado' })).toBeDisabled();
});

test('admin visualiza relatório e salva configurações', async ({ page }) => {
  await page.goto('/admin/relatorios');
  await expect(page.getByText('Faturamento bruto')).toBeVisible();
  await expect(page.getByText('Lucro bruto estimado')).toBeVisible();
  await page.goto('/admin/configuracoes');
  await page.getByLabel('Preço da fatia').fill('18');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('Configurações salvas.')).toBeVisible();
});

test('portal offline abre e a busca filtra seções', async ({ page }) => {
  await page.goto('file:///D:/Projetos/AdoceClub/Documentacao/Portal/index.html');
  await expect(page.getByRole('heading', { name: 'Adoce Club', exact: true })).toBeVisible();
  await page.getByPlaceholder('Buscar na documentação').fill('GitHub');
  await expect(page.getByRole('heading', { name: 'Git e GitHub' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeHidden();
});
