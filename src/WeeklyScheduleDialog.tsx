import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import "./weekly-schedule.css";

export type WeeklyMenuItem = {
  id: string;
  service_date: string;
  channel_slug: "online_orders" | "in_person";
  flavor_id: string;
  quantity_planned: number | null;
  quantity_reserved: number;
  status: "published" | "sold_out" | "hidden";
  note: string | null;
};

type ScheduleFlavor = {
  id: string;
  name: string;
  image: string;
};

type ScheduleHour = {
  channel_slug: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
};

type ScheduleException = {
  channel_slug: string;
  service_date: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

type ScheduleChannel = WeeklyMenuItem["channel_slug"];

const whatsappBase = "https://wa.me/5585982156026?text=";

function parseDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number) {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return dateKey(result);
}

function dayTitle(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(parseDate(date));
}

function dayShort(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
    .format(parseDate(date))
    .replace(".", "");
}

function serviceWindows(
  date: string,
  channel: ScheduleChannel,
  hours: ScheduleHour[],
  exceptions: ScheduleException[],
) {
  const exception = exceptions.find(
    (item) => item.channel_slug === channel && item.service_date === date,
  );
  if (exception?.closed) return [];
  if (exception?.opens_at && exception?.closes_at) {
    return [{ opens_at: exception.opens_at, closes_at: exception.closes_at }];
  }
  const weekday = parseDate(date).getUTCDay();
  return hours.filter(
    (item) =>
      item.active &&
      item.channel_slug === channel &&
      item.weekday === weekday,
  );
}

function hourLabel(windows: Array<{ opens_at: string; closes_at: string }>) {
  return windows
    .map(
      (window) =>
        `${window.opens_at.slice(0, 5)} às ${window.closes_at.slice(0, 5)}`,
    )
    .join(" · ");
}

export default function WeeklyScheduleDialog({
  open,
  onClose,
  today,
  hours,
  exceptions,
  menuItems,
  flavors,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
  hours: ScheduleHour[];
  exceptions: ScheduleException[];
  menuItems: WeeklyMenuItem[];
  flavors: ScheduleFlavor[];
}) {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index);
        const stall = serviceWindows(date, "in_person", hours, exceptions);
        const pickup = serviceWindows(date, "online_orders", hours, exceptions);
        const dateItems = menuItems.filter(
          (item) => item.service_date === date && item.status !== "hidden",
        );
        const hasStallMenu = dateItems.some(
          (item) => item.channel_slug === "in_person",
        );
        const hasPickupMenu = dateItems.some(
          (item) => item.channel_slug === "online_orders",
        );
        const hasBookableMenu = dateItems.some((item) => {
          const available =
            item.quantity_planned === null ||
            item.quantity_planned - item.quantity_reserved > 0;
          const channelHasHours =
            item.channel_slug === "in_person"
              ? stall.length > 0
              : pickup.length > 0;
          return item.status === "published" && available && channelHasHours;
        });
        return {
          date,
          stall,
          pickup,
          hasStall: stall.length > 0,
          hasPickup: pickup.length > 0,
          hasStallMenu,
          hasPickupMenu,
          hasBookableMenu,
          hasMenu: dateItems.length > 0,
        };
      }),
    [today, hours, exceptions, menuItems],
  );
  const firstAvailableDate =
    days.find((day) => day.hasBookableMenu)?.date ||
    days.find((day) => day.hasMenu)?.date ||
    days.find((day) => day.hasPickup || day.hasStall)?.date ||
    today;
  const [selectedDate, setSelectedDate] = useState(firstAvailableDate);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedDate(firstAvailableDate);
    setQuantities({});
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("schedule-dialog-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("schedule-dialog-open");
    };
  }, [open, firstAvailableDate, onClose]);

  if (!open) return null;

  const selectedDay = days.find((day) => day.date === selectedDate) || days[0];
  const selectedItems = menuItems
    .filter(
      (item) =>
        item.service_date === selectedDate && item.status !== "hidden",
    )
    .map((item) => ({
      ...item,
      flavor: flavors.find((flavor) => flavor.id === item.flavor_id),
    }))
    .filter((item) => item.flavor);
  const selectedCount = selectedItems.reduce(
    (total, item) => total + (quantities[item.id] || 0),
    0,
  );
  const onlineLink =
    whatsappBase +
    encodeURIComponent(
      `Olá, Adoce! Vi a agenda da semana e quero conhecer os sabores disponíveis para retirada em ${dayTitle(selectedDate)}.`,
    );
  const reservationText = selectedItems
    .filter((item) => (quantities[item.id] || 0) > 0)
    .map(
      (item) =>
        `${quantities[item.id]}x ${item.flavor?.name} (${item.channel_slug === "in_person" ? "barraquinha" : "retirada"})`,
    )
    .join(", ");
  const reservationLink =
    whatsappBase +
    encodeURIComponent(
      `Olá, Adoce! Quero solicitar uma reserva para ${dayTitle(selectedDate)}: ${reservationText}. Sei que a reserva será confirmada pela Adoce no WhatsApp.`,
    );

  const renderFlavorList = (channel: ScheduleChannel, channelActive: boolean) => {
    const channelItems = selectedItems.filter(
      (item) => item.channel_slug === channel,
    );
    if (!channelItems.length) return null;

    return (
      <div className="weekly-flavor-list">
        {channelItems.map((item) => {
          const available =
            item.quantity_planned === null
              ? null
              : Math.max(item.quantity_planned - item.quantity_reserved, 0);
          const selected = quantities[item.id] || 0;
          const maximum = available === null ? 12 : available;
          const soldOut = item.status === "sold_out" || maximum === 0;
          return (
            <article key={item.id} className={soldOut ? "sold-out" : ""}>
              <img
                src={item.flavor!.image}
                alt={`Fatia ${item.flavor!.name}`}
              />
              <div>
                <strong>{item.flavor!.name}</strong>
                <small>
                  {soldOut
                    ? "Esse sabor já foi muito amado e esgotou"
                    : available === null
                      ? "Disponibilidade confirmada pela Adoce"
                      : `${available} ${available === 1 ? "fatia disponível" : "fatias disponíveis"}`}
                </small>
              </div>
              {!soldOut && channelActive ? (
                <div
                  className="weekly-quantity"
                  aria-label={`Quantidade de ${item.flavor!.name}`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: Math.max(selected - 1, 0),
                      }))
                    }
                    disabled={selected === 0}
                    aria-label={`Remover uma ${item.flavor!.name}`}
                  >
                    <Minus />
                  </button>
                  <strong>{selected}</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: Math.min(selected + 1, maximum),
                      }))
                    }
                    disabled={selected >= maximum}
                    aria-label={`Adicionar uma ${item.flavor!.name}`}
                  >
                    <Plus />
                  </button>
                </div>
              ) : !soldOut ? (
                <small className="weekly-awaiting-hour">
                  Horário ainda não confirmado
                </small>
              ) : null}
            </article>
          );
        })}
      </div>
    );
  };

  const channels = [
    {
      slug: "online_orders" as const,
      icon: ShoppingBag,
      title: "Pedidos para retirada",
      active: selectedDay.hasPickup,
      windows: selectedDay.pickup,
      activeText: "Retirada programada neste dia",
      inactiveText: "Sem retirada programada neste dia",
      emptyTitle: "Os sabores para retirada ainda não foram publicados.",
      emptyText:
        "Não precisa esperar a barraquinha. Chame a Adoce para consultar o que estará disponível.",
    },
    {
      slug: "in_person" as const,
      icon: Store,
      title: "Barraquinha de rua",
      active: selectedDay.hasStall,
      windows: selectedDay.stall,
      activeText: "A barraquinha estará por perto",
      inactiveText: "Neste dia, a barraquinha descansa",
      emptyTitle: "O cardápio da barraquinha ainda está ganhando forma.",
      emptyText:
        "Chame a gente e conte qual sabor você gostaria de encontrar na barraquinha.",
    },
  ];

  return (
    <div className="weekly-schedule-backdrop" onMouseDown={onClose}>
      <section
        className="weekly-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-schedule-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="weekly-schedule-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar agenda"
          ref={closeButtonRef}
        >
          <X />
        </button>
        <header className="weekly-schedule-heading">
          <CalendarDays />
          <div>
            <h2 id="weekly-schedule-title">Sabores e atendimentos da semana</h2>
            <p>
              Veja o que estará disponível para retirada e na barraquinha, sem
              misturar as duas modalidades.
            </p>
          </div>
        </header>

        <div className="weekly-day-rail" aria-label="Próximos sete dias">
          {days.map((day) => (
            <button
              type="button"
              key={day.date}
              className={day.date === selectedDate ? "active" : ""}
              onClick={() => {
                setSelectedDate(day.date);
                setQuantities({});
              }}
            >
              {day.hasStall ? <Store /> : <ShoppingBag />}
              <span>{dayShort(day.date)}</span>
              <small>
                {day.hasStall && day.hasPickup
                  ? "Retirada + barraquinha"
                  : day.hasStall
                    ? "Barraquinha"
                    : day.hasPickup
                      ? "Retirada"
                      : "Sem atendimento"}
              </small>
            </button>
          ))}
        </div>

        <div className="weekly-schedule-content">
          <div className="weekly-selected-date weekly-date-summary">
            <div>
              <CalendarDays />
              <span>
                <strong>{dayTitle(selectedDate)}</strong>
                <small>
                  Escolha uma modalidade abaixo para planejar sua vontade.
                </small>
              </span>
            </div>
          </div>

          <div className="weekly-channel-grid">
            {channels.map((channel) => {
              const ChannelIcon = channel.icon;
              const flavorList = renderFlavorList(channel.slug, channel.active);
              return (
                <article
                  className={`weekly-channel-card ${channel.slug}`}
                  key={channel.slug}
                >
                  <div className="weekly-channel-head">
                    <div>
                      <ChannelIcon />
                      <span>
                        <strong>{channel.title}</strong>
                        <small>
                          {channel.active
                            ? channel.activeText
                            : channel.inactiveText}
                        </small>
                      </span>
                    </div>
                    {channel.windows.length ? (
                      <span className="weekly-hour">
                        <Clock3 /> {hourLabel(channel.windows)}
                      </span>
                    ) : null}
                  </div>

                  {!channel.active &&
                  ((channel.slug === "online_orders" && selectedDay.hasPickupMenu) ||
                    (channel.slug === "in_person" && selectedDay.hasStallMenu)) ? (
                    <p className="weekly-channel-awaiting">
                      Os sabores já estão previstos, mas a reserva será liberada
                      somente quando o horário deste atendimento for confirmado.
                    </p>
                  ) : null}

                  {flavorList || (
                    <div className="weekly-menu-pending">
                      <Heart />
                      <strong>{channel.emptyTitle}</strong>
                      <p>{channel.emptyText}</p>
                      {channel.slug === "online_orders" ? (
                        <a href={onlineLink} target="_blank" rel="noreferrer">
                          <MessageCircle /> Consultar retirada
                        </a>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        {selectedCount > 0 ? (
          <footer className="weekly-reservation-bar">
            <div>
              <strong>
                Solicitação de reserva · {selectedCount}{" "}
                {selectedCount === 1 ? "fatia" : "fatias"}
              </strong>
              <small>A Adoce confirma sua reserva pelo WhatsApp.</small>
            </div>
            <a href={reservationLink} target="_blank" rel="noreferrer">
              <Heart /> Solicitar minha reserva
            </a>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
