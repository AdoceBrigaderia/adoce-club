import { ClipboardList, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { bffRpc } from "./services/bff-rpc";

type ServiceRequestHistoryRow = {
  id: string;
  request_number: string;
  status: string;
  source: string;
  quantity: number;
  desired_start: string;
  created_at: string;
  product: {
    id: string;
    name: string;
    product_type: string;
    image_url: string | null;
  };
  configuration: {
    kind: string;
    summary: unknown;
    selection: Record<string, unknown>;
    estimated_price: number | null;
  };
};

const kindLabels: Record<string, string> = {
  cake: "Torta",
  sweet: "Docinhos",
  cookie: "Biscoitos",
  school_kit: "Kit Adoce na Escola",
  fixed: "Produto fixo",
};

const statusLabels: Record<string, string> = {
  prebooked: "Pré-reserva",
  quoted: "Orçamento enviado",
  awaiting_deposit: "Aguardando sinal",
  confirmed: "Confirmada",
  in_production: "Em produção",
  ready: "Pronta",
  completed: "Concluída",
  cancelled: "Cancelada",
  expired: "Expirada",
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function configurationLines(summary: unknown) {
  if (Array.isArray(summary)) {
    return summary.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  if (summary && typeof summary === "object") {
    return Object.entries(summary as Record<string, unknown>).flatMap(([group, value]) => {
      const labels = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : typeof value === "string" ? [value] : [];
      return labels.length ? [`${group.replace(/_/g, " ")}: ${labels.join(", ")}`] : [];
    });
  }
  if (typeof summary === "string" && summary.trim()) return [summary.trim()];
  return [];
}

export default function CustomerServiceRequestHistory({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<ServiceRequestHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async () => {
    if (!profileId) return;
    setLoading(true);
    setNotice("");
    try {
      const result = await bffRpc<ServiceRequestHistoryRow[]>("staff_get_customer_service_request_history", {
        target_profile_id: profileId,
        result_limit: 30,
      });
      setRows(Array.isArray(result) ? result : []);
    } catch (error) {
      setRows([]);
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar as encomendas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [profileId]);

  return (
    <section className="customer-360-history customer-360-service-requests">
      <header>
        <ClipboardList />
        <div><h3>Encomendas personalizadas</h3><p>Composição integral registrada para este cliente.</p></div>
        <button type="button" onClick={() => void load()} aria-label="Atualizar encomendas"><RefreshCw /></button>
      </header>
      {loading ? <p>Carregando encomendas…</p> : null}
      {notice ? <p>{notice}</p> : null}
      {!loading && !notice && !rows.length ? <p>Nenhuma encomenda personalizada localizada.</p> : null}
      <div>
        {rows.map((row) => {
          const lines = configurationLines(row.configuration.summary);
          return <article key={row.id}>
            <span>
              <strong>{row.product.name}</strong>
              <small>{kindLabels[row.configuration.kind] || row.configuration.kind} · {row.request_number}</small>
              <small>{dateTime(row.desired_start)} · {row.quantity} unidade(s) · {statusLabels[row.status] || row.status}</small>
              {lines.length ? <small>{lines.join(" · ")}</small> : <small>Produto sem personalização registrada.</small>}
            </span>
            <span><b>{money(row.configuration.estimated_price)}</b><small>{row.source}</small></span>
          </article>;
        })}
      </div>
    </section>
  );
}
