begin;

-- Sem uma escolha explícita do cliente, nenhuma comunicação promocional é
-- habilitada. As preferências continuam podendo ser definidas no cadastro e
-- alteradas posteriormente no perfil.
alter table public.notification_preferences
  alter column flavors set default false,
  alter column festival set default false,
  alter column promotions set default false,
  alter column club_news set default false,
  alter column rewards set default false,
  alter column birthday set default false,
  alter column email_enabled set default false,
  alter column push_enabled set default false,
  alter column whatsapp_enabled set default false;

commit;
