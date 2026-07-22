import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CalendarDays,
  Clock3,
  Heart,
  House,
  MapPin,
  MessageCircle,
  Images,
  Megaphone,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import GroupOrderArtwork from "./GroupOrderArtwork";
import { serviceStatusMessage } from "./service-status";
import WeeklyScheduleDialog, { type WeeklyMenuItem } from "./WeeklyScheduleDialog";
import { trackPublicEvent } from "./analytics";
import "./adoce-hoje.css";
import "./adoce-hoje-content.css";
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
  illustrative?: boolean;
  availabilityNote?: string;
  quantityAvailable?: number | null;
  quantityReserved?: number;
  photos?: FlavorPhoto[];
  wholeCakePrice?: number;
  wholeCakeImage?: string;
  wholeCakeAvailable?: boolean;
};
type FlavorPhoto = {
  id: string;
  flavor_id: string;
  image_path: string;
  alt_text: string;
  image_role: "cover" | "gallery";
  sort_order: number;
};
type Promotion = {
  id: string;
  title: string;
  body: string;
  starts_at: string;
  ends_at: string | null;
};
type Channel = {
  slug: string;
  label: string;
  status: "open" | "closed" | "opening_soon" | "paused";
  message: string | null;
  next_change_at: string | null;
};

export type ServiceKind = "pickup" | "stall";
type ServiceWindow = {
  kind: ServiceKind;
  start: number;
  end: number;
  label: string;
};
export type BusinessHour = {
  channel_slug: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
  note: string | null;
};
export type BusinessHourException = {
  channel_slug: string;
  service_date: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  message: string | null;
};

const weeklyServiceWindows: Record<number, ServiceWindow[]> = {
  0: [],
  1: [
    {
      kind: "pickup",
      start: 9,
      end: 22,
      label: "Retirada no portão da Adoce, das 9h às 22h.",
    },
  ],
  2: [
    {
      kind: "pickup",
      start: 9,
      end: 22,
      label: "Retirada no portão da Adoce, das 9h às 22h.",
    },
  ],
  3: [
    {
      kind: "pickup",
      start: 9,
      end: 22,
      label: "Retirada no portão da Adoce, das 9h às 22h.",
    },
  ],
  4: [
    {
      kind: "pickup",
      start: 9,
      end: 18,
      label: "Retirada no portão da Adoce, das 9h às 18h.",
    },
    {
      kind: "stall",
      start: 19.5,
      end: 23,
      label: "Barraquinha Adoce, das 19h30 às 23h.",
    },
  ],
  5: [
    {
      kind: "pickup",
      start: 9,
      end: 18,
      label: "Retirada no portão da Adoce, das 9h às 18h.",
    },
    {
      kind: "stall",
      start: 19.5,
      end: 23,
      label: "Barraquinha Adoce, das 19h30 às 23h.",
    },
  ],
  6: [
    {
      kind: "pickup",
      start: 9,
      end: 16,
      label: "Retirada no portão da Adoce, das 9h às 16h.",
    },
    {
      kind: "stall",
      start: 17,
      end: 23,
      label: "Barraquinha Adoce, das 17h às 23h.",
    },
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
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  };
}

function timeNumber(value: string | null) {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours + minutes / 60;
}

function clockLabel(value: number) {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dateAfter(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function scrollToTodaySection(id: "sabores" | "atendimento") {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function serviceState(
  kind: ServiceKind,
  hours: BusinessHour[],
  exceptions: BusinessHourException[],
  currentTime = getFortalezaNow(),
) {
  const now = currentTime;
  const slug = kind === "stall" ? "in_person" : "online_orders";
  const exception = exceptions.find(
    (item) => item.channel_slug === slug && item.service_date === now.date,
  );
  const databaseWindows: ServiceWindow[] = hours
    .filter(
      (item) =>
        item.active &&
        item.weekday === now.weekday &&
        item.channel_slug === slug,
    )
    .map((item) => ({
      kind,
      start: timeNumber(item.opens_at),
      end: timeNumber(item.closes_at),
      label:
        item.note ||
        `${kind === "stall" ? "Barraquinha Adoce" : "Retirada no portão da Adoce"}, das ${item.opens_at.slice(0, 5)} às ${item.closes_at.slice(0, 5)}.`,
    }));
  const fallbackWindows = weeklyServiceWindows[now.weekday].filter(
    (window) => window.kind === kind,
  );
  const hasChannelSchedule = hours.some(
    (item) => item.active && item.channel_slug === slug,
  );
  const today = exception
    ? exception.closed
      ? []
      : [
          {
            kind,
            start: timeNumber(exception.opens_at),
            end: timeNumber(exception.closes_at),
            label:
              exception.message ||
              `Funcionamento especial das ${exception.opens_at?.slice(0, 5)} às ${exception.closes_at?.slice(0, 5)}.`,
          },
        ]
    : hasChannelSchedule
      ? databaseWindows
      : fallbackWindows;
  const active = today.find(
    (window) => now.hour >= window.start && now.hour < window.end,
  );
  const firstWindow = today[0];
  const lastWindow = today[today.length - 1];
  const beforeOpening = Boolean(firstWindow && now.hour < firstWindow.start);
  const finishedToday = Boolean(lastWindow && now.hour >= lastWindow.end);
  const subject = kind === "stall" ? "A barraquinha" : "A retirada";
  const timingMessage = beforeOpening
    ? `${subject} abre hoje às ${clockLabel(firstWindow.start)} e funciona até ${clockLabel(lastWindow.end)}.`
    : finishedToday
      ? `${subject} encerrou o atendimento de hoje às ${clockLabel(lastWindow.end)}.`
      : today.map((window) => window.label).join(" ");
  return {
    open: Boolean(active),
    phase: active
      ? ("open" as const)
      : beforeOpening
        ? ("before_opening" as const)
        : finishedToday
          ? ("finished_today" as const)
          : ("unavailable" as const),
    message:
      active?.label ||
      (exception?.closed
        ? exception.message || "Fechado excepcionalmente hoje."
        : "") ||
      timingMessage ||
      (kind === "stall"
        ? "A barraquinha não funciona hoje."
        : "Não há retirada programada hoje."),
  };
}

export function serviceHeadline(
  kind: ServiceKind,
  state: ReturnType<typeof serviceState>,
) {
  if (state.open) {
    return kind === "stall" ? "Barraquinha aberta agora" : "Retirada aberta agora";
  }
  if (state.phase === "before_opening") {
    return kind === "stall" ? "A barraquinha abre mais tarde" : "A retirada abre mais tarde";
  }
  if (state.phase === "finished_today") {
    return kind === "stall" ? "Barraquinha encerrada hoje" : "Retirada encerrada hoje";
  }
  return kind === "stall" ? "Barraquinha fechada hoje" : "Sem retirada neste momento";
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
        <strong>Adoce Brigaderia</strong>
        <small>Festival de Fatias</small>
      </span>
    </a>
  );
}

export default function AdoceHoje() {
  const [filter, setFilter] = useState<Availability>("all");
  const [flavors, setFlavors] = useState<Flavor[]>(
    fallback.map((flavor) => ({ ...flavor, available: false })),
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [hourExceptions, setHourExceptions] = useState<BusinessHourException[]>(
    [],
  );
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenuItem[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const openSchedule = () => {
    trackPublicEvent("schedule_open", { source: "adoce_hoje" });
    setScheduleOpen(true);
  };
  const [selectedFlavor, setSelectedFlavor] = useState<Flavor | null>(null);
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    document.title = "Adoce Hoje · Clube Adoce";
  }, []);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
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
      const today = getFortalezaNow().date;
      const scheduleEnd = dateAfter(today, 6);
      const now = new Date().toISOString();
      const [
        { data: catalog, error: catalogError },
        { data: availability },
        { data: channelData },
        { data: hoursData },
        { data: exceptionData },
        { data: imageData },
        { data: promotionData },
        { data: weeklyMenuData },
      ] = await Promise.all([
        supabase
          .from("flavors")
          .select(
            "id,name,category,short_description,description,image_path,base_price,whole_cake_price,whole_cake_image_path,whole_cake_available",
          )
          .eq("active", true)
          .order("name"),
        supabase
          .from("flavor_availability")
          .select("flavor_id,status,note,quantity_available,quantity_reserved")
          .eq("service_date", today),
        supabase
          .from("store_channels")
          .select("slug,label,status,message,next_change_at")
          .order("slug"),
        supabase
          .from("business_hours")
          .select("channel_slug,weekday,opens_at,closes_at,active,note")
          .eq("active", true),
        supabase
          .from("business_hour_exceptions")
          .select("channel_slug,service_date,closed,opens_at,closes_at,message")
          .gte("service_date", today)
          .lte("service_date", scheduleEnd),
        supabase
          .from("flavor_images")
          .select("id,flavor_id,image_path,alt_text,image_role,sort_order")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("promotions")
          .select("id,title,body,starts_at,ends_at")
          .eq("active", true)
          .lte("starts_at", now)
          .or(`ends_at.is.null,ends_at.gte.${now}`)
          .order("starts_at", { ascending: false }),
        supabase
          .from("weekly_service_menu")
          .select(
            "id,service_date,channel_slug,flavor_id,quantity_planned,quantity_reserved,status,note",
          )
          .gte("service_date", today)
          .lte("service_date", scheduleEnd)
          .neq("status", "hidden")
          .order("service_date"),
      ]);
      if (catalog?.length) {
        const photos = (imageData || []) as FlavorPhoto[];
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
              illustrative: Boolean(item.image_path?.includes("ilustrativa")),
              availabilityNote: status?.note || undefined,
              quantityAvailable: status?.quantity_available,
              quantityReserved: status?.quantity_reserved || 0,
              photos: photos.filter((photo) => photo.flavor_id === item.id),
              wholeCakePrice: item.whole_cake_price
                ? Number(item.whole_cake_price)
                : undefined,
              wholeCakeImage: item.whole_cake_image_path || undefined,
              wholeCakeAvailable: Boolean(item.whole_cake_available),
            };
          }),
        );
      }
      if (channelData) setChannels(channelData as Channel[]);
      if (hoursData) setBusinessHours(hoursData as BusinessHour[]);
      if (exceptionData)
        setHourExceptions(exceptionData as BusinessHourException[]);
      if (promotionData) setPromotions(promotionData as Promotion[]);
      if (weeklyMenuData) setWeeklyMenu(weeklyMenuData as WeeklyMenuItem[]);
      setUpdated(!catalogError);
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
  const wholeCakes = useMemo(() => {
    const configured = flavors
      .filter(
        (flavor) =>
          flavor.wholeCakeAvailable &&
          flavor.wholeCakeImage &&
          flavor.wholeCakePrice,
      )
      .map((flavor) => ({
        name: flavor.name,
        image: flavor.wholeCakeImage!,
        price: flavor.wholeCakePrice!,
      }));
    configured.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      );
    return configured;
  }, [flavors]);
  const inPerson = channels.find((c) => c.slug === "in_person");
  const online = channels.find((c) => c.slug === "online_orders");
  const stallState = serviceState("stall", businessHours, hourExceptions);
  const pickupState = serviceState("pickup", businessHours, hourExceptions);
  const stallPaused = inPerson?.status === "paused";
  const open = stallPaused ? false : stallState.open;
  const availableCount = flavors.filter((f) => f.available).length;
  const stallHeadline = stallPaused
    ? "Barraquinha pausada agora"
    : serviceHeadline("stall", stallState);
  const stallMessage = serviceStatusMessage({
    open,
    paused: inPerson?.status === "paused",
    channelMessage: inPerson?.message,
    scheduleMessage: stallState.message,
    pausedMessage: "Atendimento presencial pausado no momento.",
  });
  const pickupPaused = online?.status === "paused";
  const pickupOpen = pickupPaused ? false : pickupState.open;
  const pickupHeadline = pickupPaused
    ? "Retiradas pausadas agora"
    : serviceHeadline("pickup", pickupState);
  const pickupMessage = serviceStatusMessage({
    open: pickupOpen,
    paused: online?.status === "paused",
    channelMessage: online?.message,
    scheduleMessage: pickupState.message,
    pausedMessage: "Retiradas pausadas no momento.",
  });
  const anyServiceOpen = pickupOpen || open;
  return (
    <main className="today-page">
      <header className="today-header">
        <Brand />
        <nav>
          <button type="button" onClick={() => scrollToTodaySection("sabores")}>Sabores</button>
          <button type="button" onClick={() => scrollToTodaySection("atendimento")}>Atendimento</button>
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
            <span /> Informações atualizadas
          </div>
          <p className="today-kicker">{dateLabel}</p>
          <h1>
            Descubra o que pode <em>adoçar seu dia.</em>
          </h1>
          <p className="today-lead">
            Sabores, disponibilidade e atendimento reunidos em um só lugar —
            sempre com uma informação honesta antes de você sair de casa.
          </p>
          <div className="today-hero-actions">
            <a
              className="today-primary"
              href={orderLink()}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Falar com a Adoce
            </a>
            <button
              type="button"
              className="today-secondary"
              onClick={() => scrollToTodaySection("sabores")}
            >
              <ShoppingBag /> Ver sabores de hoje
            </button>
          </div>
        </div>
        <div className="today-service-experience" id="atendimento">
          <div className="today-service-grid" aria-label="Canais de atendimento de hoje">
            <article className={`today-service-card ${pickupOpen ? "is-open" : "is-closed"}`}>
              <img
                src="/site/adoce-hoje-retirada-ilustracao.webp"
                alt="Ilustração de um pedido on-line sendo retirado no portão da casa da Adoce"
              />
              <div className="today-service-card-body">
                <p className="today-service-kind"><House /> Pedido on-line</p>
                <h2>Pedidos para retirada</h2>
                <p className="today-service-description">
                  Peça pelo WhatsApp e, depois da confirmação, receba seu pacote no portão. O local de produção não é aberto à visitação.
                </p>
                <div className="today-channel-status" role="status">
                  <span aria-hidden="true" />
                  <div>
                    <strong>{pickupHeadline}</strong>
                    <small>{pickupMessage}</small>
                  </div>
                </div>
                {!pickupOpen ? (
                  <p className="today-next-step">
                    Você ainda pode chamar a Adoce e consultar o próximo horário disponível.
                  </p>
                ) : null}
                <a href={orderLink()} target="_blank" rel="noreferrer">
                  <MessageCircle /> {pickupOpen ? "Pedir para retirar" : "Consultar próximo horário"}
                </a>
              </div>
            </article>

            <article className={`today-service-card ${open ? "is-open" : "is-closed"}`}>
              <img
                src="/site/adoce-hoje-barraquinha-ilustracao.webp"
                alt="Ilustração da barraquinha de rua da Adoce iluminada e com fatias expostas"
              />
              <div className="today-service-card-body">
                <p className="today-service-kind"><Store /> Atendimento presencial</p>
                <h2>Barraquinha de rua</h2>
                <p className="today-service-description">
                  O Festival de Fatias presencial acontece somente nos dias e horários informados{" "}
                  <button className="today-inline-link" type="button" onClick={openSchedule}>
                    aqui
                  </button>.
                </p>
                <div className="today-channel-status" role="status">
                  <span aria-hidden="true" />
                  <div>
                    <strong>{stallHeadline}</strong>
                    <small>{stallMessage}</small>
                  </div>
                </div>
                {!open ? (
                  <p className="today-next-step">
                    A barraquinha está fechada, mas os pedidos para retirada funcionam separadamente.
                  </p>
                ) : null}
                <a
                  href={open ? maps : orderLink()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {open ? <MapPin /> : <MessageCircle />}
                  {open ? "Como chegar à barraquinha" : "Consultar retirada"}
                </a>
              </div>
            </article>
          </div>

          <div className="today-live-showcase" aria-label="Sabores realmente sinalizados hoje">
            <header>
              <span><Heart /> Uma pausa doce para hoje</span>
              <strong>
                {availableCount
                  ? availableCount === 1
                    ? "Tem um sabor esperando por você"
                    : `Tem ${availableCount} sabores esperando por você`
                  : "Quer saber o que saiu hoje?"}
              </strong>
              <small>
                {updated
                  ? anyServiceOpen
                    ? "Escolha o seu favorito e chame a gente para reservar."
                    : "Gostou de algum? Chame a gente para confirmar e combinar a retirada."
                  : "Só um instante: estamos preparando as delícias de hoje."}
              </small>
            </header>
            <div className="today-live-flavor-grid">
              {flavors
                .filter((flavor) => flavor.available)
                .slice(0, 4)
                .map((flavor) => (
                  <figure key={flavor.id}>
                    <img src={flavor.image} alt={`Fatia ${flavor.name}`} />
                    <figcaption>{flavor.name}</figcaption>
                  </figure>
                ))}
            </div>
          </div>
        </div>
      </section>
      <section className="today-group-order" aria-labelledby="pede-junto-adoce">
        <GroupOrderArtwork />
        <div>
          <p className="today-kicker">Pede Junto Adoce</p>
          <h2 id="pede-junto-adoce">
            Cada um escolhe e paga a sua. Com 5, a entrega é grátis.
          </h2>
          <p>
            No trabalho, condomínio, faculdade ou clínica: compartilhe a sala,
            chegue a cinco fatias e continue adicionando quantas quiser.
          </p>
          <ul>
            <li>
              <Check /> Sabores identificados no pacote
            </li>
            <li>
              <Check /> Cada pessoa recebe o próprio link de pagamento
            </li>
            <li>
              <Check /> Entrega por motorista de aplicativo
            </li>
          </ul>
          <a
            className="today-primary"
            href="/#pede-junto"
          >
            <MessageCircle /> Abrir meu Pede Junto
          </a>
        </div>
      </section>
      {promotions.length > 0 && (
        <section
          className="today-active-promotions"
          aria-labelledby="promocoes-ativas"
        >
          <div className="today-section-head">
            <div>
              <p className="today-kicker">Novidades Adoce</p>
              <h2 id="promocoes-ativas">Promoções em destaque</h2>
            </div>
            <p>
              Informações atualizadas pela Adoce e válidas somente durante o
              período indicado.
            </p>
          </div>
          <div className="today-promotion-grid">
            {promotions.map((promotion) => (
              <article key={promotion.id}>
                <Megaphone />
                <div>
                  <h3>{promotion.title}</h3>
                  <p>{promotion.body}</p>
                </div>
                <a href={orderLink()} target="_blank" rel="noreferrer">
                  Consultar
                </a>
              </article>
            ))}
          </div>
        </section>
      )}
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
            <article
              className={`today-flavor-card ${flavor.available ? "" : "unavailable"}`}
              key={flavor.id}
            >
              <div className="today-card-image">
                <img
                  src={flavor.image}
                  alt={`Fatia ${flavor.name}`}
                  loading="lazy"
                />
                <span
                  className={`today-availability-seal ${flavor.status === "preorder_only" ? "upcoming" : flavor.available ? "available" : "unavailable"}`}
                >
                  {flavor.available ? <Heart /> : <Clock3 />}
                  <strong>
                    {flavor.status === "preorder_only"
                      ? "Hoje às 19h30"
                      : flavor.available
                        ? "Disponível agora"
                        : "Não disponível agora"}
                  </strong>
                </span>
                {flavor.premium && (
                  <span className="today-premium">
                    <Sparkles /> Premium
                  </span>
                )}
                {flavor.illustrative && (
                  <span className="today-illustrative">Imagem ilustrativa</span>
                )}
                {(flavor.photos?.length || 0) > 1 && (
                  <button
                    className="today-gallery-button"
                    type="button"
                    onClick={() => setSelectedFlavor(flavor)}
                  >
                    <Images /> Ver fotos
                  </button>
                )}
              </div>
              <div className="today-card-body">
                <div>
                  <div className="today-card-status">
                    {flavor.available ? (
                      <>
                        <span className="now" />{" "}
                        {flavor.status === "preorder_only"
                          ? "Festival de hoje à noite"
                          : flavor.status === "last_units"
                            ? "Últimas unidades"
                            : "Sinalizado hoje"}
                      </>
                    ) : (
                      <>
                        <Clock3 /> Consulte antes de pedir
                      </>
                    )}
                  </div>
                  {flavor.available && flavor.quantityAvailable !== null && flavor.quantityAvailable !== undefined ? (
                    <div className="today-stock-count">
                      {Math.max(flavor.quantityAvailable - (flavor.quantityReserved || 0), 0)} fatia(s) livre(s) agora
                    </div>
                  ) : null}
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
              {(flavor.photos?.length || 0) > 1 && (
                <button
                  className="today-gallery-link"
                  type="button"
                  onClick={() => setSelectedFlavor(flavor)}
                >
                  Conhecer o produto
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      {wholeCakes.length > 0 && (
      <section className="today-cakes" id="tortas-inteiras">
        <div className="today-section-head">
          <div>
            <p className="today-kicker">Para celebrar por inteiro</p>
            <h2>Tortas inteiras por encomenda</h2>
          </div>
          <p>
            Fotos reais dos produtos. Consulte abaixo o valor cadastrado para o
            tamanho G; outros tamanhos ficam sob consulta.
          </p>
        </div>
        <div className="today-cake-rail">
          {wholeCakes.map((cake) => (
            <article key={cake.name}>
              <img
                src={cake.image}
                alt={`Torta inteira ${cake.name}`}
                loading="lazy"
              />
              <div>
                <h3>{cake.name}</h3>
                <p>Por encomenda · serve até 35 pessoas</p>
                <strong>
                  {cake.price.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              </div>
              <a
                href={orderLink(`Torta inteira ${cake.name}`)}
                target="_blank"
                rel="noreferrer"
              >
                Consultar esta torta
              </a>
            </article>
          ))}
        </div>
      </section>
      )}
      <section className="today-orders-bridge">
        <ShoppingBag />
        <div>
          <p className="today-kicker">Pedidos por encomenda</p>
          <h2>Procurando tortas, docinhos ou uma experiência para seu evento?</h2>
          <p>
            O Festival de Fatias continua aqui. Para produtos inteiros, festas,
            Adoce na Escola e aluguel de acervo, consulte o cardápio de encomendas.
          </p>
        </div>
        <a className="today-primary" href="/#encomendas">
          Ver encomendas e eventos
        </a>
      </section>
      <section className="today-policy-callout">
        <Clock3 />
        <div>
          <p className="today-kicker">Antes de encomendar</p>
          <h2>Nossa produção artesanal segue uma política de pedidos.</h2>
          <p>Veja quais produtos podem ser encomendados em cada dia da semana.</p>
        </div>
        <a className="today-secondary" href="/#politica-de-pedidos">
          Conferir política de pedidos
        </a>
      </section>
      <section className="today-event" id="localizacao">
        <div className="today-event-copy">
          <p className="today-kicker">Atendimento Adoce</p>
          <h2>
            {anyServiceOpen
              ? "Escolha o atendimento que funciona agora."
              : "Consulte o próximo horário."}
          </h2>
          <p>
             <strong>{stallHeadline}.</strong> {stallMessage}
          </p>
          <p>
             <strong>{pickupHeadline}.</strong> {pickupMessage} O local de produção não é aberto à visitação.
            Endereço para retirada confirmada: Rua Professor Odílio Filho,
            227, Passaré.
          </p>
          <a
            className="today-primary"
             href={open ? maps : orderLink()}
            target="_blank"
            rel="noreferrer"
          >
             {open ? <MapPin /> : <MessageCircle />}
             {open
               ? "Como chegar à barraquinha"
               : pickupOpen
                 ? "Pedir para retirar"
                 : "Consultar próximo horário"}
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
        {open ? (
          <a href={maps} target="_blank" rel="noreferrer">
            <MapPin /> Chegar
          </a>
        ) : (
          <button type="button" onClick={openSchedule}>
            <CalendarDays /> Ver agenda
          </button>
        )}
        <a href={orderLink()} target="_blank" rel="noreferrer">
          <MessageCircle /> {pickupOpen ? "Pedir para retirar" : "Consultar"}
        </a>
      </div>
      <WeeklyScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        today={getFortalezaNow().date}
        hours={businessHours}
        exceptions={hourExceptions}
        menuItems={weeklyMenu}
        flavors={flavors.map((flavor) => ({
          id: flavor.id,
          name: flavor.name,
          image: flavor.image,
        }))}
      />
      {selectedFlavor && (
        <div
          className="today-gallery-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos de ${selectedFlavor.name}`}
          onClick={() => setSelectedFlavor(null)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <button
              className="today-gallery-close"
              type="button"
              aria-label="Fechar fotos"
              onClick={() => setSelectedFlavor(null)}
            >
              <X />
            </button>
            <p className="today-kicker">Galeria do sabor</p>
            <h2>{selectedFlavor.name}</h2>
            <p>{selectedFlavor.note}</p>
            <div className="today-gallery-photos">
              {(selectedFlavor.photos || []).map((photo) => (
                <figure key={photo.id}>
                  <img
                    src={photo.image_path}
                    alt={photo.alt_text || selectedFlavor.name}
                  />
                  <figcaption>
                    {photo.image_role === "cover"
                      ? "Foto principal"
                      : "Mais detalhes"}
                  </figcaption>
                </figure>
              ))}
            </div>
            <a
              className="today-primary"
              href={orderLink(selectedFlavor.name)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Consultar disponibilidade
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
