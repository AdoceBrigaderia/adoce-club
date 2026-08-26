-- Product photos must point to actual image files, never to social page URLs.
update public.commercial_products
set image_url = case slug
  when 'docinhos-tradicionais' then '/adoce-hoje/docinhos-tradicionais.webp'
  when 'docinhos-especiais' then '/adoce-hoje/docinhos-premium.webp'
  else image_url
end
where slug in ('docinhos-tradicionais', 'docinhos-especiais');
