import { useRef, type ReactNode } from "react";

// Horizontal controls stay beside the table; the shared page-level header
// manager keeps this and every other table header visible while scrolling.
export default function CostSheetTable({ children }: { children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  return <>
    <div className="adoce-table-scroll-controls" aria-label="Navegar pelas colunas"><button type="button" onClick={() => wrapper.current?.scrollBy({left:-320,behavior:"smooth"})}>← Colunas anteriores</button><button type="button" onClick={() => wrapper.current?.scrollBy({left:320,behavior:"smooth"})}>Próximas colunas →</button></div>
    <div ref={wrapper} tabIndex={0} role="region" aria-label="Tabela de custos, role para os lados para ver todas as colunas" className="adoce-items-table-scroll adoce-cost-sheet-table-scroll">{children}</div>
  </>;
}
