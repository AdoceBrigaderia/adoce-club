import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { floatingTableIndex } from "./table-and-sheet-ui";

type FloatingHeader = {
  top: number;
  left: number;
  width: number;
  tableWidth: number;
  scrollLeft: number;
  columns: { html: string; width: number; className: string }[];
};

const visible = (element: Element) => {
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
};

const horizontalContainer = (table: HTMLTableElement) => {
  let element = table.parentElement;
  while (element && element !== document.body) {
    const style = getComputedStyle(element);
    if (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth) return element;
    element = element.parentElement;
  }
  return table.parentElement || document.documentElement;
};

const stickyTop = () => {
  const candidates = [...document.querySelectorAll<HTMLElement>(".operation-home > header, .operation-shell > aside, .public-header, .today-header")]
    .filter(visible)
    .map(element => element.getBoundingClientRect().bottom)
    .filter(bottom => bottom > 0 && bottom < window.innerHeight);
  return Math.max(0, ...candidates);
};

export default function PersistentTableHeaders() {
  const [header, setHeader] = useState<FloatingHeader | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const tables = [...document.querySelectorAll<HTMLTableElement>("table")]
        .filter(table => !table.closest("[data-floating-table-header]") && !table.closest("[data-no-floating-header]"));
      const top = stickyTop();
      const viewports = tables.map(table => {
        const head = table.tHead;
        return {
          headerTop: head?.getBoundingClientRect().top ?? 0,
          tableBottom: table.getBoundingClientRect().bottom,
          headerHeight: head?.getBoundingClientRect().height ?? 0,
          visible: Boolean(head && visible(head)),
        };
      });
      const index = floatingTableIndex(viewports, top);
      if (index < 0) { setHeader(null); return; }
      const table = tables[index];
      const head = table.tHead!;
      const container = horizontalContainer(table);
      const containerRect = container.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const cells = [...head.rows[0].cells];
      setHeader({
        top,
        left: Math.max(0, containerRect.left),
        width: Math.min(containerRect.width, window.innerWidth - Math.max(0, containerRect.left)),
        tableWidth: tableRect.width,
        scrollLeft: container.scrollLeft,
        columns: cells.map(cell => ({ html: cell.innerHTML, width: cell.getBoundingClientRect().width, className: cell.className })),
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "open"] });
    schedule();
    return () => {
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (!header) return null;
  return createPortal(
    <div data-floating-table-header className="adoce-global-floating-table-header" aria-hidden="true" style={{ top: header.top, left: header.left, width: header.width }}>
      <table style={{ width: header.tableWidth, tableLayout: "fixed", transform: `translateX(${-header.scrollLeft}px)` }}>
        <colgroup>{header.columns.map((column, index) => <col key={index} style={{ width: column.width }} />)}</colgroup>
        <thead><tr>{header.columns.map((column, index) => <th key={index} className={column.className} dangerouslySetInnerHTML={{ __html: column.html }} />)}</tr></thead>
      </table>
    </div>,
    document.body,
  );
}
