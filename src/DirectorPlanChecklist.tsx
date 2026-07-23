import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Cloud,
  Lightbulb,
  LockKeyhole,
  Search,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  DIRECTOR_ARCHIVED_DECISION_COUNT,
  DIRECTOR_AREA_CONTEXT,
  DIRECTOR_DECISIONS,
  DIRECTOR_PHASE_CONTEXT,
} from "./director-plan-data";
import "./director-plan-checklist.css";

type Review = {
  decision_id: string;
  rubens_answer: string;
  beth_answer: string;
  final_decision: string;
  notes: string;
  updated_at?: string;
};

type ReviewField = "rubens_answer" | "beth_answer" | "final_decision" | "notes";
type SaveState = "idle" | "saving" | "saved" | "error";

const answerOptions = [
  ["", "Ainda não respondi"],
  ["approved", "Aprovo a sugestão"],
  ["adjust", "Quero ajustar"],
  ["reject", "Não aprovo"],
  ["discuss", "Precisamos conversar"],
];

const emptyReview = (decisionId: string): Review => ({
  decision_id: decisionId,
  rubens_answer: "",
  beth_answer: "",
  final_decision: "",
  notes: "",
});

export default function DirectorPlanChecklist({ session }: { session: Session }) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("Todas");
  const [area, setArea] = useState("Todas");
  const [priority, setPriority] = useState("Todas");
  const [onlyPending, setOnlyPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activeDecisionId, setActiveDecisionId] = useState(DIRECTOR_DECISIONS[0]?.id || "");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let active = true;
    void requireSupabase()
      .from("project_decision_reviews")
      .select("decision_id,rubens_answer,beth_answer,final_decision,notes,updated_at")
      .order("decision_id")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage("Não foi possível abrir as respostas. Atualize a página e tente novamente.");
        } else {
          setReviews(
            Object.fromEntries(
              ((data || []) as Review[]).map((review) => [review.decision_id, review]),
            ),
          );
        }
        setLoading(false);
      });
    return () => {
      active = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const saveReview = useCallback(
    async (review: Review) => {
      setSaveState("saving");
      setMessage("");
      const { data, error } = await requireSupabase()
        .from("project_decision_reviews")
        .upsert(
          {
            ...review,
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "decision_id" },
        )
        .select("decision_id,rubens_answer,beth_answer,final_decision,notes,updated_at")
        .single();
      if (error) {
        setSaveState("error");
        setMessage("Esta resposta não foi salva. Confira sua internet e tente novamente.");
        return;
      }
      setReviews((current) => ({ ...current, [review.decision_id]: data as Review }));
      setSaveState("saved");
    },
    [session.user.id],
  );

  const updateReview = (decisionId: string, field: ReviewField, value: string) => {
    const next = { ...(reviews[decisionId] || emptyReview(decisionId)), [field]: value };
    setReviews((current) => ({ ...current, [decisionId]: next }));
    setSaveState("saving");
    const previous = timers.current.get(decisionId);
    if (previous) clearTimeout(previous);
    timers.current.set(
      decisionId,
      setTimeout(() => {
        timers.current.delete(decisionId);
        void saveReview(next);
      }, 700),
    );
  };

  const areas = useMemo(
    () => ["Todas", ...new Set(DIRECTOR_DECISIONS.map((item) => item.area))],
    [],
  );
  const phases = useMemo(
    () =>
      [...new Set(DIRECTOR_DECISIONS.map((item) => item.phase))].sort(
        (first, second) => Number(first.split(" ")[1]) - Number(second.split(" ")[1]),
      ),
    [],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return DIRECTOR_DECISIONS.filter((item) => {
      const review = reviews[item.id];
      const matchesText =
        !normalized ||
        `${item.id} ${item.area} ${item.question} ${item.recommendation}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return (
        matchesText &&
        (phase === "Todas" || item.phase === phase) &&
        (area === "Todas" || item.area === area) &&
        (priority === "Todas" || item.priority === priority) &&
        (!onlyPending || !review?.final_decision.trim())
      );
    });
  }, [area, onlyPending, phase, priority, query, reviews]);
  useEffect(() => {
    if (!filtered.some((item) => item.id === activeDecisionId)) {
      setActiveDecisionId(filtered[0]?.id || "");
    }
  }, [activeDecisionId, filtered]);
  const finalized = DIRECTOR_DECISIONS.filter(
    (item) => reviews[item.id]?.final_decision.trim(),
  ).length;
  const progress = Math.round((finalized / DIRECTOR_DECISIONS.length) * 100);
  const activePhase = phase === "Todas" ? null : DIRECTOR_PHASE_CONTEXT[phase];

  if (loading) return <div className="director-loading">Abrindo o Plano Diretor com segurança...</div>;

  return (
    <div className="director-checklist">
      <header className="director-heading">
        <div>
          <span className="director-private"><LockKeyhole /> Área privada dos proprietários</span>
          <h1>Pendências do Plano Diretor</h1>
          <p>Aqui aparecem somente as escolhas que ainda precisam da confirmação de vocês. Cada alteração é salva automaticamente.</p>
        </div>
        <div className="director-save" data-state={saveState}>
          {saveState === "error" ? <CircleAlert /> : saveState === "saved" ? <CheckCircle2 /> : <Cloud />}
          <span>
            {saveState === "saving" ? "Salvando..." : saveState === "error" ? "Falha ao salvar" : "Tudo salvo"}
          </span>
        </div>
      </header>

      <section className="director-progress" aria-label={`${progress}% do checklist concluído`}>
        <div><strong>{finalized}</strong><span>de {DIRECTOR_DECISIONS.length} pendências finalizadas</span></div>
        <div className="director-progress-track"><span style={{ width: `${progress}%` }} /></div>
        <b>{progress}%</b>
      </section>

      <p className="director-archived-summary">
        <CheckCircle2 />
        <span>
          <strong>{DIRECTOR_ARCHIVED_DECISION_COUNT} decisões anteriores já saíram desta lista.</strong>
          Elas foram definidas, implementadas ou deixaram de exigir validação, mas as respostas históricas continuam preservadas.
        </span>
      </p>

      <section className="director-introduction" aria-labelledby="director-introduction-title">
        <div className="director-introduction-copy">
          <span><BookOpen /> Como usar esta validação</span>
          <h2 id="director-introduction-title">Só o que ainda precisa de uma decisão real.</h2>
          <p>
            O checklist inicial foi comparado com as regras aprovadas e com o que já está em uso.
            Restaram apenas decisões ligadas à rotina de vocês, a testes físicos, ao contador ou
            a etapas futuras.
          </p>
        </div>
        <ol>
          <li><b>1</b><span><strong>Entendam o motivo</strong><small>Leiam o contexto antes de escolher uma resposta.</small></span></li>
          <li><b>2</b><span><strong>Respondam individualmente</strong><small>Rubens e Beth registram se concordam ou se precisam conversar.</small></span></li>
          <li><b>3</b><span><strong>Fechem a regra</strong><small>A decisão final é o que realmente orientará o projeto.</small></span></li>
        </ol>
      </section>

      {activePhase && (
        <section className="director-phase-context" aria-live="polite">
          <span>{phase}</span>
          <div>
            <h2>{activePhase.title}</h2>
            <p>{activePhase.purpose}</p>
          </div>
        </section>
      )}

      <section className="director-filters">
        <label className="director-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar dúvida, tema ou código" /></label>
        <label><span>Etapa do projeto</span><select value={phase} onChange={(event) => setPhase(event.target.value)}><option>Todas</option>{phases.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Área</span><select value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Prioridade</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option>Todas</option><option>Crítica</option><option>Alta</option><option>Média</option></select></label>
        <label className="director-pending"><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} /><span>Mostrar somente pendentes</span></label>
      </section>

      {message && <p className="director-message" role="alert">{message}</p>}
      <p className="director-result-count">Mostrando {filtered.length} de {DIRECTOR_DECISIONS.length} pendências atuais</p>

      <section className="director-list">
        {filtered.map((item, index) => {
          const review = reviews[item.id] || emptyReview(item.id);
          const complete = Boolean(review.final_decision.trim());
          const active = activeDecisionId === item.id;
          return (
            <article className={`director-item ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={item.id}>
              <button type="button" className="director-item-summary" aria-expanded={active} onClick={() => setActiveDecisionId(active ? "" : item.id)}>
                <span className="director-item-number">Decisão {index + 1} de {filtered.length}</span>
                <span className="director-item-top">
                  <span className="director-id">{item.id}</span><span>{item.area}</span><span className={`priority-${item.priority.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{item.priority}</span><span>{item.phase}</span>
                  {complete && <b><CheckCircle2 /> Finalizada</b>}
                </span>
                <strong>{item.question}</strong>
                <ChevronDown className="director-item-chevron" />
              </button>
              {active && (
                <div className="director-item-body">
                  <div className="director-context">
                    <Lightbulb />
                    <div><strong>Por que esta decisão é necessária?</strong><p>{DIRECTOR_AREA_CONTEXT[item.area]}</p></div>
                  </div>
                  <div className="director-recommendation"><strong>O que recomendamos para começar</strong><p>{item.recommendation}</p><small>Quem precisa validar principalmente: {item.owner}</small></div>
                  <div className="director-answers">
                    <label><span>O que o Rubens pensa?</span><select value={review.rubens_answer} onChange={(event) => updateReview(item.id, "rubens_answer", event.target.value)}>{answerOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                    <label><span>O que a Beth pensa?</span><select value={review.beth_answer} onChange={(event) => updateReview(item.id, "beth_answer", event.target.value)}>{answerOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  </div>
                  <label className="director-final"><span>Qual regra o projeto deve seguir?</span><small>Escrevam o acordo final de forma direta. É esta resposta que será usada na construção do sistema.</small><textarea value={review.final_decision} onChange={(event) => updateReview(item.id, "final_decision", event.target.value)} placeholder="Ex.: No primeiro piloto, os pedidos online funcionarão somente enquanto a barraca estiver aberta." maxLength={2000} /></label>
                  {!review.final_decision.trim() && <button type="button" className="director-use-recommendation" onClick={() => updateReview(item.id, "final_decision", item.recommendation)}>Usar a recomendação como decisão final</button>}
                  <label className="director-notes"><span>O que ainda precisa ser conversado ou confirmado?</span><small>Use este espaço para dúvidas, condições ou informações que precisam ser verificadas.</small><textarea value={review.notes} onChange={(event) => updateReview(item.id, "notes", event.target.value)} placeholder="Opcional" maxLength={4000} /></label>
                  <nav className="director-decision-navigation" aria-label="Navegar entre decisões filtradas">
                    <button type="button" disabled={index === 0} onClick={() => setActiveDecisionId(filtered[index - 1]?.id || item.id)}><ArrowLeft /> Decisão anterior</button>
                    <span>{index + 1} de {filtered.length}</span>
                    <button type="button" disabled={index === filtered.length - 1} onClick={() => setActiveDecisionId(filtered[index + 1]?.id || item.id)}>Próxima decisão <ArrowRight /></button>
                  </nav>
                </div>
              )}
            </article>
          );
        })}
        {!filtered.length && <div className="director-empty"><CircleAlert /><strong>Nenhuma decisão encontrada</strong><p>Limpe a busca ou altere os filtros para continuar.</p></div>}
      </section>
    </div>
  );
}
