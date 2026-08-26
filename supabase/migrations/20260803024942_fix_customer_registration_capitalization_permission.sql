-- A normalizacao do nome chama este auxiliar durante o cadastro do cliente.
grant execute on function private.capitalize_name_word(text) to authenticated;
