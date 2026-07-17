import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import "./adoce-hoje.css";
import "./today-promotions.css";

type Availability = "all" | "available" | "premium";
type Flavor = {
  id: string;
  name: string;
  note: string;
  price: number;
  image: string;
  available: boolean;
  premium: boolean;
  status?: string;
};
type Channel = {
  slug: string;
  label: string;
  status: "open" | "closed" | "opening_soon" | "paused";
  message: string | null;
  next_change_at: string | null;
};

type ServiceKind = "pickup" | "stall";
type ServiceWindow = {
  kind: ServiceKind;
  start: number;
  end: number;
  label: string;
};

const weeklyServiceWindows: Record<number, ServiceWindow[]> = {
  0: [],
  1: [{ kind: "pickup", start: 9, end: 22, label: "Retirada na Fábrica Adoce, das 9h às 22h." }],
  2: [{ kind: "pickup", start: 9, end: 22, label: "Retirada na Fábrica Adoce, das 9h às 22h." }],
  3: [{ kind: "pickup", start: 9, end: 22, label: "Retirada na Fábrica Adoce, das 9h às 22h." }],
  4: [
    { kind: "pickup", start: 9, end: 18, label: "Retirada na Fábrica Adoce, das 9h às 18h." },
    { kind: "stall", start: 19.5, end: 23, label: "Barraquinha Adoce, das 19h30 às 23h." },
  ],
  5: [
    { kind: "pickup", start: 9, end: 18, label: "Retirada na Fábrica Adoce, das 9h às 18h." },
    { kind: "stall", start: 19.5, end: 23, label: "Barraquinha Adoce, das 19h30 às 23h." },
  ],
  6: [
    { kind: "pickup", start: 9, end: 16, label: "Retirada na Fábrica Adoce, das 9h às 16h." },
    { kind: "stall", start: 17, end: 23, label: "Barraquinha Adoce, das 17h às 23h." },
  ],
};

function getFortalezaNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "0";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    weekday: weekdays[value("weekday")] ?? 0,
    hour: Number(value("hour")) + Number(value("minute")) / 60,
  };
}

function serviceState(kind: ServiceKind) {
  const now = getFortalezaNow();
  const today = weeklyServiceWindows[now.weekday].filter(
    (window) => window.kind === kind,
  );
  const active = today.find(
    (window) => now.hour >= window.start && now.hour < window.end,
  );
  return {
    open: Boolean(active),
    message:
      active?.label ||
      today.map((window) => window.label).join(" ") ||
      (kind === "stall"
        ? "A barraquinha não funciona hoje."
        : "Não há retirada programada hoje."),
  };
}

const fallback: Flavor[] = [
  {
    id: "kinder",
    name: "Kinder Bueno",
    note: "Chocolate cremoso com Kinder Bueno.",
    price: 20,
    image: "/adoce-hoje/kinder-bueno.webp",
    available: false,
    premium: true,
  },
  {
    id: "ninho",
    name: "Chocolate trufado com brigadeiro de Ninho e pedaços de morango",
    note: "Chocolate trufado, Ninho e morangos.",
    price: 16,
    image: "/adoce-hoje/trufado-ninho-morango.webp",
    available: true,
    premium: false,
  },
  {
    id: "choco-morango",
    name: "Chocolatudo trufado com morangos",
    note: "Chocolate super molhadinho, toque trufado e morangos.",
    price: 16,
    image: "/adoce-hoje/chocolatudo-trufado-morangos.webp",
    available: true,
    premium: false,
  },
  {
    id: "castanha",
    name: "Brigadeiro de chocolate com castanha de caju",
    note: "Brigadeiro cremoso com a crocância da castanha de caju.",
    price: 16,
    image: "/adoce-hoje/brigadeiro-castanha.webp",
    available: true,
    premium: false,
  },
  {
    id: "red",
    name: "Red Velvet com Ninho e Nutella",
    note: "Red Velvet, Ninho e Nutella.",
    price: 16,
    image: "/adoce-hoje/red-velvet.webp",
    available: false,
    premium: false,
  },
  {
    id: "choco",
    name: "Chocolatudo",
    note: "Chocolate intenso e muito recheio.",
    price: 16,
    image: "/adoce-hoje/chocolatudo.webp",
    available: true,
    premium: false,
  },
  {
    id: "ferrero",
    name: "Ferrero Rocher",
    note: "Chocolate, creme e crocância.",
    price: 16,
    image: "/adoce-hoje/ferrero-rocher.webp",
    available: true,
    premium: false,
  },
  {
    id: "oreo",
    name: "Oreo",
    note: "Chocolate, creme e Oreo.",
    price: 16,
    image: "/adoce-hoje/oreo.webp",
    available: true,
    premium: false,
  },
  {
    id: "limao",
    name: "Limão com frutas vermelhas",
    note: "Cítrica, cremosa e frutada.",
    price: 16,
    image: "/adoce-hoje/limao-frutas-vermelhas.webp",
    available: false,
    premium: false,
  },
  {
    id: "abacaxi",
    name: "Abacaxi com coco",
    note: "Tropical, cremosa e molhadinha.",
    price: 16,
    image: "/adoce-hoje/abacaxi-coco.webp",
    available: true,
    premium: false,
  },
];

const whatsappBase = "https://wa.me/5585982156026?text=";
const maps =
  "https://www.google.com/maps/search/?api=1&query=Festival%20de%20Fatias%20Adoce%20Brigaderia";
const orderLink = (flavor?: string) =>
  whatsappBase +
  encodeURIComponent(
    flavor
      ? `Olá, Adoce! Quero saber se a fatia ${flavor} está disponível.`
      : "Olá, Adoce! Quero conhecer os sabores disponíveis hoje.",
  );

function Brand() {
  return (
    <a className="today-brand" href="/">
      <img src="/site/logo.webp" alt="Adoce Brigaderia" />
      <span>
        <strong>Clube Adoce</strong>
        <small>Adoce Hoje</small>
      </span>
    </a>
  );
}

export default function AdoceHoje() {
  const [filter, setFilter] = useState<Availability>("all");
  const [flavors, setFlavors] = useState<Flavor[]>(fallback);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    document.title = "Adoce Hoje · Clube Adoce";
  }, []);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(new Date()),
    [],
  );
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void (async () => {
      const supabase = requireSupabase();
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: catalog }, { data: availability }, { data: channelData }] =
        await Promise.all([
          supabase
            .from("flavors")
            .select(
              "id,name,category,short_description,description,image_path,base_price",
            )
            .eq("active", true)
            .order("sort_order"),
          supabase
            .from("flavor_availability")
            .select("flavor_id,status,note")
            .eq("service_date", today),
          supabase
            .from("store_channels")
            .select("slug,label,status,message,next_change_at")
            .order("slug"),
        ]);
      if (catalog?.length) {
        setFlavors(
          catalog.map((item) => {
            const status = availability?.find((a) => a.flavor_id === item.id);
            return {
              id: item.id,
              name: item.name,
              note:
                item.short_description ||
                item.description ||
                "Feita com carinho em cada camada.",
              price: Number(item.base_price || 0),
              image: item.image_path || "/adoce-hoje/sabores-hoje.webp",
              available: Boolean(
                status &&
                  ["available", "last_units", "preorder_only"].includes(
                    status.status,
                  ),
              ),
              premium: item.category === "premium",
              status: status?.status,
            };
          }),
        );
      }
      if (channelData) setChannels(channelData as Channel[]);
      setUpdated(true);
    })();
  }, []);
  const visible = useMemo(
    () =>
      flavors.filter(
        (f) =>
          filter === "all" ||
          (filter === "available" ? f.available : f.premium),
      ),
    [flavors, filter],
  );
  const inPerson = channels.find((c) => c.slug === "in_person");
  const online = channels.find((c) => c.slug === "online_orders");
  const stallState = serviceState("stall");
  const pickupState = serviceState("pickup");
  const open = inPerson?.status === "paused" ? false : stallState.open;
  const availableCount = flavors.filter((f) => f.available).length;
  const stallStatus = open ? "Aberto agora" : "Fechado agora";
  const pickupOpen = online?.status === "paused" ? false : pickupState.open;
  const pickupStatus = pickupOpen ? "Aberto agora" : "Fechado agora";
  return (
    <main className="today-page">
      <header className="today-header">
        <Brand />
        <nav>
          <a href="#sabores">Sabores</a>
          <a href="#atendimento">Atendimento</a>
          <a
            className="today-order-small"
            href={orderLink()}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle /> Consultar
          </a>
        </nav>
      </header>
      <section className="today-hero">
        <div className="today-hero-copy">
          <div className="today-live">
            <span className={open ? "" : "closed"} /> Informações atualizadas
          </div>
          <p className="today-kicker">{dateLabel}</p>
          <h1>
            Descubra o que pode <em>adoçar seu dia.</em>
          </h1>
          <p className="today-lead">
            Sabores, disponibilidade e atendimento reunidos em um só lugar —
            sempre com uma informação honesta antes de você sair de casa.
          </p>
          <div className="today-status-grid">
            <div>
              <ShoppingBag />
              <span>
                <strong>
                  {availableCount
                    ? `${availableCount} sabores sinalizados`
                    : "Consulte a disponibilidade"}
                </strong>
                <small>
                  {updated
                    ? "Catálogo conectado ao Clube Adoce"
                    : "Carregando informações"}
                </small>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                <strong>{stallStatus}</strong>
                <small>{inPerson?.message || stallState.message}</small>
              </span>
            </div>
          </div>
          <div className="today-hero-actions">
            <a
              className="today-primary"
              href={orderLink()}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Falar com a Adoce
            </a>
            <a
              className="today-secondary"
              href={maps}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin /> Como chegar
            </a>
          </div>
        </div>
        <figure className="today-poster">
          <img
            src="/adoce-hoje/sabores-hoje.webp"
            alt="Seleção de fatias Adoce"
          />
          <figcaption>Feitas para transformar vontade em felicidade</figcaption>
        </figure>
      </section>
      <section className="today-group-order" aria-labelledby="compra-em-grupo">
        <div className="today-group-visual">
          <img src="/adoce-hoje/ferrero-rocher.webp" alt="Fatia Adoce para compartilhar" />
          <span><Users /> Compra em grupo</span>
        </div>
        <div>
          <p className="today-kicker">Junte a galera</p>
          <h2 id="compra-em-grupo">5 ou mais fatias e a entrega fica por nossa conta.</h2>
          <p>Trabalho, condomínio, família ou rua: façam um único pedido para o mesmo endereço em Fortaleza e recebam entrega grátis.</p>
          <ul>
            <li><Check /> Sabores identificados no pacote</li>
            <li><Check /> Pagamento antecipado por Pix ou link de cartão</li>
            <li><Check /> Entrega por motorista de aplicativo</li>
          </ul>
          <a className="today-primary" href={orderLink()} target="_blank" rel="noreferrer"><MessageCircle /> Organizar pedido do grupo</a>
        </div>
      </section>
      <section className="today-flavors" id="sabores">
        <div className="today-section-head">
          <div>
            <p className="today-kicker">Catálogo Adoce</p>
            <h2>Escolha sua próxima paixão</h2>
          </div>
          <p>
            A disponibilidade muda ao longo do dia. Quando um sabor não estiver
            sinalizado, consulte pelo WhatsApp antes de pedir.
          </p>
        </div>
        <div className="today-filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos <span>{flavors.length}</span>
          </button>
          <button
            className={filter === "available" ? "active" : ""}
            onClick={() => setFilter("available")}
          >
            Sinalizados hoje <span>{availableCount}</span>
          </button>
          <button
            className={filter === "premium" ? "active" : ""}
            onClick={() => setFilter("premium")}
          >
            Premium <span>{flavors.filter((f) => f.premium).length}</span>
          </button>
        </div>
        <div className="today-card-grid">
          {visible.map((flavor) => (
            <article className="today-flavor-card" key={flavor.id}>
              <div className="today-card-image">
                <img
                  src={flavor.image}
                  alt={`Fatia ${flavor.name}`}
                  loading="lazy"
                />
                <span className={`today-availability-seal ${flavor.available ? "available" : "unavailable"}`}>
                  {flavor.available ? <Heart /> : <Clock3 />}
                  <strong>{flavor.available ? "Disponível agora" : "Não disponível agora"}</strong>
                </span>
                {flavor.premium && (
                  <span className="today-premium">
                    <Sparkles /> Premium
                  </span>
                )}
              </div>
              <div className="today-card-body">
                <div>
                  <div className="today-card-status">
                    {flavor.available ? (
                      <>
                        <span className="now" />{" "}
                        {flavor.status === "last_units"
                          ? "Últimas unidades"
                          : "Sinalizado hoje"}
                      </>
                    ) : (
                      <>
                        <Clock3 /> Consulte antes de pedir
                      </>
                    )}
                  </div>
                  <h3>{flavor.name}</h3>
                  <p>{flavor.note}</p>
                </div>
                <div className="today-price">
                  <small>a partir de</small>
                  <strong>
                    {flavor.price
                      ? `R$ ${flavor.price.toFixed(2).replace(".", ",")}`
                      : "Consulte"}
                  </strong>
                </div>
              </div>
              <a href={orderLink(flavor.name)} target="_blank" rel="noreferrer">
                <MessageCircle /> Quero esta
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="today-event" id="atendimento">
        <div className="today-event-copy">
          <p className="today-kicker">Atendimento Adoce</p>
          <h2>{open ? "Estamos te esperando." : "Confira antes de sair."}</h2>
          <p>
            <strong>Barraquinha:</strong> {stallStatus}.{" "}
            {inPerson?.message || stallState.message}
          </p>
          <p>
            <strong>Retirada:</strong> {pickupStatus}.{" "}
            {online?.message || pickupState.message} Endereço: Rua Professor
            Odílio Filho, 227, Passaré.
          </p>
          <a
            className="today-primary"
            href={maps}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin /> Abrir localização
          </a>
        </div>
        <div className="today-contact">
          <Heart />
          <h3>Fale com a gente</h3>
          <a href={orderLink()} target="_blank" rel="noreferrer">
            85 98215-6026
          </a>
          <a
            href="https://wa.me/5585981994370"
            target="_blank"
            rel="noreferrer"
          >
            85 98199-4370
          </a>
          <small>
            Confirme o sabor e a forma de atendimento antes do deslocamento.
          </small>
        </div>
      </section>
      <footer className="today-footer">
        <Brand />
        <p>Aqui na Adoce você compra a fatia e a felicidade vai junto.</p>
      </footer>
      <div className="today-mobile-bar">
        <a href={maps} target="_blank" rel="noreferrer">
          <MapPin /> Chegar
        </a>
        <a href={orderLink()} target="_blank" rel="noreferrer">
          <MessageCircle /> Consultar
        </a>
      </div>
    </main>
  );
}
