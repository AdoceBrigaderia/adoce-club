// Home publica — catalogo completo de fatias primeiro, Encomendar logo abaixo.
// Mesma logica do AdoceHome.tsx (07/08/2026): a fatia vem antes da marca.
// Aqui vai alem, mostrando todos os sabores do dia, nao so os 3 primeiros.

import AdoceHoje from "./AdoceHoje";
import "./adoce-home.css";

export default function AdoceHomeCatalog() {
  return <AdoceHoje compact />;
}
