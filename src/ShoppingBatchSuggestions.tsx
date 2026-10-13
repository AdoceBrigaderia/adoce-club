import { useCallback, useEffect, useRef, useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { confirmAction } from "./lib/confirm-dialog";
import "./shopping-batch-suggestions.css";

type Suggestion = { flavor_id: string; name: string; cakes: number; slices_per_cake: number | null; quantity: number | null; issue: string | null; has_existing_batch: boolean };
type Preview = { items: Suggestion[]; updated_at: string | null };

export default function ShoppingBatchSuggestions({ today, onImported }: { today: string; onImported: () => Promise<void> }) {
  const [date, setDate] = useState(today);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const importing = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setBusy(true); setPreview(null); setChosen([]);
    try {
      const { data, error } = await requireSupabase().rpc("manager_get_shopping_day_suggestions", { requested_date: date });
      if (request !== generation.current) return;
      if (error) throw error;
      const next = data as Preview;
      setPreview(next); setChosen(next.items.filter((item) => !item.issue && !item.has_existing_batch).map((item) => item.flavor_id));
      setNotice(""); setDenied(false);
    } catch (error) {
      if (request !== generation.current) return;
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || error);
      setDenied(message.includes("Acesso não autorizado"));
      setNotice("Não foi possível carregar o planejamento. Atualize para tentar novamente.");
    } finally { if (request === generation.current) setBusy(false); }
  }, [date]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  const create = async () => {
    if (importing.current || !preview || !chosen.length || !time || busy) return;
    importing.current = true; setBusy(true);
    try {
      if (!await confirmAction(`Criar ${chosen.length} lote(s) em ${new Date(date + "T12:00:00").toLocaleDateString("pt-BR")} às ${time}, conforme o planejamento e as fichas G?`, { confirmLabel: "Criar lotes para venda" })) return;
      const { data, error } = await requireSupabase().rpc("manager_import_shopping_day_batches", {
        requested_date: date, requested_time: time, chosen_flavor_ids: chosen,
        expected_items: preview.items, expected_updated_at: preview.updated_at,
      });
      if (error) throw error;
      await onImported(); await refresh();
      setNotice(`${data.created} lote(s) criado(s). ${data.skipped} sabor(es) preservado(s) por já possuir estoque ou lote.`);
    } catch (error) {
      setNotice(String((error as { message?: string })?.message || "Não foi possível criar os lotes. Atualize a prévia e tente novamente."));
    } finally { importing.current = false; setBusy(false); }
  };
  if (denied) return null;
  return <section className="shopping-batch-suggestions" aria-label="Planejamento para venda">
    <h3>Planejamento para venda</h3>
    {!open && preview?.items.length ? <p>Há sabores planejados para este dia. Deseja trazer o planejamento de compras?</p> : null}
    <button type="button" disabled={busy} onClick={() => setOpen(!open)}>{open ? "Fechar prévia" : "Trazer planejamento de compras"}</button>
    {notice ? <p role="status">{notice}</p> : null}
    {open ? <div>
      <div className="shopping-batch-fields"><label>Data dos lotes<input type="date" min={today} value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} /></label><label>Horário de liberação<input type="time" value={time} required disabled={busy} onChange={(e) => setTime(e.target.value)} /></label><button type="button" disabled={busy} onClick={() => void refresh()}>Atualizar prévia</button></div>
      <p>As tortas do dia são convertidas pelas fichas G. Sabores com estoque, reservas ou lotes existentes serão preservados. Altere as quantidades no planejamento de compras.</p>
      {busy ? <p role="status">Carregando…</p> : null}
      {preview && !preview.items.length ? <p>Nenhum sabor planejado para esta data.</p> : null}
      {preview?.items.map((item) => <label className="shopping-batch-row" key={item.flavor_id}><input type="checkbox" disabled={busy || !!item.issue || item.has_existing_batch} checked={chosen.includes(item.flavor_id)} onChange={(e) => setChosen((ids) => e.target.checked ? [...ids, item.flavor_id] : ids.filter((id) => id !== item.flavor_id))} /><span><strong>{item.name}</strong><span>{item.cakes} torta(s) × {item.slices_per_cake ?? "—"} fatias = {item.quantity ?? "—"} fatias</span>{item.issue ? <small>{item.issue}</small> : item.has_existing_batch ? <small>Já possui estoque, reservas ou lote — preservado</small> : null}</span></label>)}
      <button type="button" disabled={busy || !chosen.length || !time || !preview || date < today} onClick={() => void create()}>Criar lotes para venda</button>
    </div> : null}
  </section>;
}
