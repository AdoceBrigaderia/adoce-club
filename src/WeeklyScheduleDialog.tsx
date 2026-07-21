import { useEffect, useMemo, useState } from "react";
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

function stallWindows(
  date: string,
  hours: ScheduleHour[],
  exceptions: ScheduleException[],
) {
  const exception = exceptions.find(
    (item) => item.channel_slug === "in_person" && item.service_date === date,
  );
  if (exception?.closed) return [];
  if (exception?.opens_at && exception?.closes_at) {
    return [{ opens_at: exception.opens_at, closes_at: exception.closes_at }];
  }
  const weekday = parseDate(date).getUTCDay();
  return hours.filter(
    (item) =>
      item.active &&
      item.channel_slug === "in_person" &&
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
        const windows = stallWindows(date, hours, exceptions);
        return { date, windows, hasStall: windows.length > 0 };
      }),
    [today, hours, exceptions],
  );
  const firstStallDate = days.find((day) => day.hasStall)?.date || today;
  const [selectedDate, setSelectedDate] = useState(firstStallDate);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setSelectedDate(firstStallDate);
    setQuantities({});
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("schedule-dialog-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("schedule-dialog-open");
    };
  }, [open, firstStallDate, onClose]);

  if (!open) return null;

  const selectedDay = days.find((day) => day.date === selectedDate) || days[0];
  const selectedItems = menuItems
    .filter(
      (item) =>
        item.service_date === selectedDate &&
        item.channel_slug === "in_person" &&
        item.status !== "hidden",
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
      "Olá, Adoce! Vi a agenda da semana e quero conhecer os sabores disponíveis para retirada hoje.",
    );
  const reservationText = selectedItems
    .filter((item) => (quantities[item.id] || 0) > 0)
    .map((item) => `${quantities[item.id]}x ${item.flavor?.name}`)
    .join(", ");
  const reservationLink =
    whatsappBase +
    encodeURIComponent(
      `Olá, Adoce! Quero solicitar uma reserva para ${dayTitle(selectedDate)}: ${reservationText}. Sei que a reserva será confirmada pela Adoce no WhatsApp.`,
    );

  return (
    <div className="weekly-schedule-backdrop" onMouseDown={onClose}>
      <section
        className="weekly-schedule-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-schedule-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="weekly-schedule-close" type="button" onClick={onClose} aria-label="Fechar agenda">
          <X />
        </button>
        <header className="weekly-schedule-heading">
          <CalendarDays />
          <div>
            <h2 id="weekly-schedule-title">Quando a barraquinha vai estar por perto?</h2>
            <p>Veja os próximos dias e escolha como prefere adoçar a sua semana.</p>
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
              <small>{day.hasStall ? "Barraquinha" : "Pedidos on-line"}</small>
            </button>
          ))}
        </div>

        <div className="weekly-schedule-content">
          <article className="weekly-stall-day">
            <div className="weekly-selected-date">
              <div>
                <Store />
                <span>
                  <strong>{dayTitle(selectedDate)}</strong>
                  <small>
                    {selectedDay.hasStall
                      ? "A barraquinha estará por perto"
                      : "Neste dia, a barraquinha descansa"}
                  </small>
                </span>
              </div>
              {selectedDay.hasStall ? (
                <span className="weekly-hour"><Clock3 /> {hourLabel(selectedDay.windows)}</span>
              ) : null}
            </div>

            {selectedDay.hasStall ? (
              selectedItems.length ? (
                <div className="weekly-flavor-list">
                  {selectedItems.map((item) => {
                    const available =
                      item.quantity_planned === null
                        ? null
                        : Math.max(item.quantity_planned - item.quantity_reserved, 0);
                    const selected = quantities[item.id] || 0;
                    const maximum = available === null ? 12 : available;
                    const soldOut = item.status === "sold_out" || maximum === 0;
                    return (
                      <article key={item.id} className={soldOut ? "sold-out" : ""}>
                        <img src={item.flavor!.image} alt={`Fatia ${item.flavor!.name}`} />
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
                        {!soldOut ? (
                          <div className="weekly-quantity" aria-label={`Quantidade de ${item.flavor!.name}`}>
                            <button
                              type="button"
                              onClick={() => setQuantities((current) => ({ ...current, [item.id]: Math.max(selected - 1, 0) }))}
                              disabled={selected === 0}
                              aria-label={`Remover uma ${item.flavor!.name}`}
                            ><Minus /></button>
                            <strong>{selected}</strong>
                            <button
                              type="button"
                              onClick={() => setQuantities((current) => ({ ...current, [item.id]: Math.min(selected + 1, maximum) }))}
                              disabled={selected >= maximum}
                              aria-label={`Adicionar uma ${item.flavor!.name}`}
                            ><Plus /></button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="weekly-menu-pending">
                  <Heart />
                  <strong>O cardápio deste dia ainda está ganhando forma.</strong>
                  <p>Chame a gente e conte qual sabor você gostaria de encontrar na barraquinha.</p>
                </div>
              )
            ) : (
              <div className="weekly-menu-pending">
                <ShoppingBag />
                <strong>Hoje também dá para adoçar.</strong>
                <p>Faça seu pedido on-line e combine a retirada no portão com a Adoce.</p>
              </div>
            )}
          </article>

          <aside className="weekly-online-invite">
            <ShoppingBag />
            <h3>Não precisa esperar a barraquinha.</h3>
            <p>Se a vontade chegou antes, veja os sabores de hoje e peça para retirar.</p>
            <a href={onlineLink} target="_blank" rel="noreferrer">
              <MessageCircle /> Pedir para retirar
            </a>
          </aside>
        </div>

        {selectedCount > 0 ? (
          <footer className="weekly-reservation-bar">
            <div>
              <strong>Solicitação de reserva · {selectedCount} {selectedCount === 1 ? "fatia" : "fatias"}</strong>
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
