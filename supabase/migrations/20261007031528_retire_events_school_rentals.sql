-- Remoção autorizada por Rubens Bezerra em 07/10/2026.
-- As ofertas encerradas deixam de ser públicas sem apagar pedidos e auditoria.
update public.commercial_products
set active = false,
    published = false,
    exibir_whatsapp = false
where segment in ('events', 'school', 'rentals');

-- O QR do Clube também foi retirado por decisão de Rubens: não é utilizado.
drop function if exists public.issue_customer_qr();
drop function if exists public.staff_lookup_customer_by_qr(text);
revoke select on public.customer_qr_tokens from authenticated;
