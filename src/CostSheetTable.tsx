import { useRef, type ReactNode } from "react";

// Wrapper generico de rolagem horizontal com botoes "anterior/proximo", usado
// por qualquer tabela larga da Operacao (fichas de custo, planejador de
// compras). Antes ShoppingWeekTable.tsx tinha sua propria copia desse mesmo
// padrao (ref + dois botoes de scrollBy) - consolidado aqui numa so
// implementacao (decisao "Consolidar" da auditoria funcional).
export default function CostSheetTable({
  children,
  scrollAmount = 320,
  label = "Tabela de custos, role para os lados para ver todas as colunas",
  prevLabel = "← Colunas anteriores",
  nextLabel = "Próximas colunas →",
  className = "adoce-items-table-scroll adoce-cost-sheet-table-scroll",
}: {
  children: ReactNode;
  scrollAmount?: number;
  label?: string;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  return <>
    <div className="adoce-table-scroll-controls" aria-label="Navegar pelas colunas"><button type="button" onClick={() => wrapper.current?.scrollBy({left:-scrollAmount,behavior:"smooth"})}>{prevLabel}</button><button type="button" onClick={() => wrapper.current?.scrollBy({left:scrollAmount,behavior:"smooth"})}>{nextLabel}</button></div>
    <div ref={wrapper} tabIndex={0} role="region" aria-label={label} className={className}>{children}</div>
  </>;
}
