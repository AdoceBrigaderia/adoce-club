import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Save } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-audit-decisions.css";

type AuditItem = {
  id: string;
  sort_order: number;
  area: string;
  item_name: string;
  files: string | null;
  access_route: string | null;
  purpose: string | null;
  frequency: string | null;
  necessary: string | null;
  recommendation: string | null;
  status: "pending" | "decided";
  decision: string | null;
  decision_note: string | null;
  decided_at: string | null;
};

const decisionOptions = ["Manter", "Descartar", "Religar", "Consolidar", "Redesenhar", "Investigar", "Outro"];

type Draft = { decision: string; note: string };

export default function OperationAuditDecisions() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await requireSupabase().rpc("owner_list_audit_items");
    setLoading(false);
    if (error) return setMessage(error.message);
    setItems((data || []) as AuditItem[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const pending = useMemo(() => items.filter((item) => item.status === "pending"), [items]);
  const decided = useMemo(() => items.filter((item) => item.status === "decided"), [items]);

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: { decision: current[id]?.decision || "", note: current[id]?.note || "", ...patch },
    }));
  };

  const dirtyIds = useMemo(
    () => Object.entries(drafts).filter(([, draft]) => draft.decision).map(([id]) => id),
    [drafts],
  );

  const saveAll = async () => {
    if (!dirtyIds.length) return;
    setBusy(true);
    setMessage("");
    const supabase = requireSupabase();
    for (const id of dirtyIds) {
      const draft = drafts[id];
      const { error } = await supabase.rpc("owner_set_audit_decision", {
        target_id: id,
        new_decision: draft.decision,
        new_note: draft.note || null,
      });
      if (error) {
        setBusy(false);
        setMessage(`Não foi possível salvar uma das decisões: ${error.message}`);
        return;
      }
    }
    setDrafts((current) => {
      const next = { ...current };
      for (const id of dirtyIds) delete next[id];
      return next;
    });
    await load();
    setBusy(false);
    setMessage(`${dirtyIds.length} decisão(ões) salva(s).`);
  };

  const reopen = async (id: string) => {
    setBusy(true);
    const { error } = await requireSupabase().rpc("owner_reopen_audit_item", { target_id: id });
    setBusy(false);
    if (error) return setMessage(error.message);
    await load();
  };

  return (
    <div className="audit-decisions">
      <header className="audit-decisions-heading">
        <div>
          <span>Reformulação da marca</span>
          <h1>Auditoria funcional do site</h1>
          <p>
            Cada função do sistema, pública e da Operação. Escolha o que fazer com cada item — o que você já salvar
            sai desta lista e vai para "Decisões tomadas", mesmo que a auditoria ainda não tenha terminado.
          </p>
        </div>
        {message ? <p role="status" className="audit-decisions-message">{message}</p> : null}
      </header>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <section className="audit-decisions-section">
            <h2>Pendentes de decisão <small>{pending.length}</small></h2>
            <div className="audit-decisions-table-wrap">
              <table className="audit-decisions-table">
                <thead>
                  <tr>
                    <th>Área</th>
                    <th>Função/Tela</th>
                    <th>Arquivo(s)</th>
                    <th>Rota de acesso</th>
                    <th>Para que existe</th>
                    <th>Frequência</th>
                    <th>Necessária?</th>
                    <th>Recomendação</th>
                    <th className="audit-decisions-decision-col">Sua decisão</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((item) => (
                    <tr key={item.id}>
                      <td>{item.area}</td>
                      <td>{item.item_name}</td>
                      <td>{item.files}</td>
                      <td>{item.access_route}</td>
                      <td>{item.purpose}</td>
                      <td>{item.frequency}</td>
                      <td>{item.necessary}</td>
                      <td>{item.recommendation}</td>
                      <td className="audit-decisions-decision-col">
                        <select
                          value={drafts[item.id]?.decision || ""}
                          onChange={(event) => setDraft(item.id, { decision: event.target.value })}
                        >
                          <option value="">Escolher...</option>
                          {decisionOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <textarea
                          placeholder="Observação (opcional)"
                          value={drafts[item.id]?.note || ""}
                          onChange={(event) => setDraft(item.id, { note: event.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                  {!pending.length ? (
                    <tr><td colSpan={9}>Nenhum item pendente — tudo já foi decidido.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="audit-decisions-section">
            <h2>Decisões tomadas <small>{decided.length}</small></h2>
            <div className="audit-decisions-table-wrap">
              <table className="audit-decisions-table audit-decisions-table-decided">
                <thead>
                  <tr>
                    <th>Área</th>
                    <th>Função/Tela</th>
                    <th>Arquivo(s)</th>
                    <th>Decisão</th>
                    <th>Observação</th>
                    <th>Quando</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {decided.map((item) => (
                    <tr key={item.id}>
                      <td>{item.area}</td>
                      <td>{item.item_name}</td>
                      <td>{item.files}</td>
                      <td><span className="audit-decision-badge">{item.decision}</span></td>
                      <td>{item.decision_note}</td>
                      <td>{item.decided_at ? new Date(item.decided_at).toLocaleString("pt-BR") : ""}</td>
                      <td>
                        <button type="button" disabled={busy} onClick={() => void reopen(item.id)} aria-label="Reabrir para decidir de novo">
                          <RotateCcw aria-hidden="true" /> Reabrir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!decided.length ? (
                    <tr><td colSpan={7}>Nenhuma decisão registrada ainda.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <button
        type="button"
        className="audit-decisions-floating-save"
        disabled={busy || !dirtyIds.length}
        onClick={() => void saveAll()}
      >
        {busy ? "Salvando..." : dirtyIds.length ? <><Save aria-hidden="true" /> Salvar {dirtyIds.length} decisão(ões)</> : <><Check aria-hidden="true" /> Tudo salvo</>}
      </button>
    </div>
  );
}
