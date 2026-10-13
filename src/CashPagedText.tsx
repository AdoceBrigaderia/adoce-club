import { useState } from "react";
export default function CashPagedText({text}: {text:string}) {
  const [page,setPage] = useState(0);
  const lines = text.split("\n").flatMap(line=>line.length ? line.match(/.{1,32}/g) || [line] : [""]);
  const pages = Math.max(1,Math.ceil(lines.length/8));
  return <><pre className="cash-paged-text">{lines.slice(page*8,page*8+8).join("\n")}</pre><div className="cash-fast-footer cash-reprint-pages"><button type="button" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>{page+1} / {pages}</span><button type="button" disabled={page+1>=pages} onClick={()=>setPage(value=>value+1)}>Próxima</button></div></>;
}
