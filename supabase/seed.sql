insert into public.app_settings(id,store_name,slice_price,average_cost,stamps_required,instagram_url) values(true,'Adoce Brigaderia',16,6.67,14,'https://instagram.com/adocebrigaderia') on conflict(id) do update set store_name=excluded.store_name;
insert into public.weekly_flavors(name,active) values ('Ninho com Morango',true),('Brigadeiro Clássico',true),('Chocolate Belga',true);
-- Perfis dependem de usuários em auth.users e devem ser criados por trigger em cada ambiente.
