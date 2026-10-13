-- Correção única de dados: antes da edição no lugar (20261013120000), cada edição de
-- preparação criava uma versão nova, mas as fichas de sabor que usavam essa preparação
-- continuavam presas na versão antiga referenciada no momento em que foram salvas.
-- Resultado: editar uma preparação não refletia no custo nem na quantidade de compras,
-- mesmo depois da correção de edição no lugar, porque as fichas nunca apontavam para a
-- versão mais recente. Esta migração reaponta todas as referências de componentes para a
-- versão mais recente de cada preparação, uma única vez. Não apaga nem altera as versões
-- antigas, que ficam preservadas sem uso.
with latest as (
  select recipe_id, size_code, max(version_number) as max_version
  from public.costing_recipe_versions group by recipe_id, size_code
),
latest_id as (
  select v.recipe_id, v.size_code, v.id as latest_version_id
  from public.costing_recipe_versions v
  join latest l on l.recipe_id = v.recipe_id and l.size_code is not distinct from v.size_code and l.max_version = v.version_number
)
update public.costing_recipe_components c
set child_recipe_version_id = li.latest_version_id
from public.costing_recipe_versions child_v
join latest_id li on li.recipe_id = child_v.recipe_id and li.size_code is not distinct from child_v.size_code
where c.child_recipe_version_id = child_v.id
  and c.child_recipe_version_id <> li.latest_version_id;
