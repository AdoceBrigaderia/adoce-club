import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Bell,
  CalendarClock,
  Check,
  Clock3,
  Eye,
  ImagePlus,
  Megaphone,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  normalizeProductImage,
  PRODUCT_IMAGE_LIMIT,
  safeMediaFileName,
  validateProductImage,
} from "./admin-media";
import "./content-admin.css";

type AdminTab =
  "catalog" | "today" | "operation" | "promotions" | "notifications";
type Flavor = {
  id: string;
  name: string;
  category: "traditional" | "premium";
  short_description: string | null;
  description: string | null;
  ingredients: string | null;
  base_price: number | null;
  image_path: string | null;
  active: boolean;
  sort_order: number;
};
type FlavorImage = {
  id: string;
  flavor_id: string;
  image_path: string;
  alt_text: string;
  caption: string | null;
  image_role: string;
  sort_order: number;
  active: boolean;
};
type AvailabilityStatus =
  "available" | "last_units" | "sold_out" | "preorder_only" | "unavailable";
type Availability = {
  id?: string;
  flavor_id: string;
  status: AvailabilityStatus;
  note: string | null;
};
type Channel = {
  slug: string;
  label: string;
  status: string;
  message: string | null;
  next_change_at: string | null;
};
type BusinessHour = {
  id: string;
  channel_slug: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
  note: string | null;
};
type BusinessHourException = {
  id: string;
  channel_slug: string;
  service_date: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  message: string | null;
};
type Promotion = {
  id: string;
  title: string;
  body: string;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};
type NotificationCampaign = {
  id: string;
  title: string;
  body: string;
  topic: string;
  channels: string[];
  status: string;
  scheduled_at: string | null;
  created_at: string;
};

const emptyFlavor = {
  name: "",
  category: "traditional" as "traditional" | "premium",
  short_description: "",
  description: "",
  ingredients: "",
  base_price: "16.00",
  active: true,
};

const availabilityLabels: Record<AvailabilityStatus, string> = {
  available: "Disponível agora",
  last_units: "Últimas unidades",
  sold_out: "Esgotado",
  preorder_only: "Somente encomenda",
  unavailable: "Indisponível",
};
const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function todayInFortaleza() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function OperationContentAdmin({
  session,
}: {
  session: Session;
  role: string;
}) {
  const [tab, setTab] = useState<AdminTab>("catalog");
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [images, setImages] = useState<FlavorImage[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [editing, setEditing] = useState<Flavor | null>(null);
  const [draft, setDraft] = useState({ ...emptyFlavor });
  const [galleryFlavor, setGalleryFlavor] = useState<Flavor | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hourDraft, setHourDraft] = useState({
    channel_slug: "store",
    weekday: 1,
    opens_at: "09:00",
    closes_at: "18:00",
    note: "",
  });
  const [exceptionDraft, setExceptionDraft] = useState({
    channel_slug: "store",
    service_date: todayInFortaleza(),
    closed: true,
    opens_at: "09:00",
    closes_at: "18:00",
    note: "",
  });
  const [promoDraft, setPromoDraft] = useState({
    title: "",
    body: "",
    starts_at: todayInFortaleza() + "T09:00",
    ends_at: "",
    active: false,
  });
  const [campaignDraft, setCampaignDraft] = useState({
    title: "",
    body: "",
    topic: "flavors",
    channel: "email",
    scheduled_at: "",
  });

  const load = useCallback(async () => {
    setBusy(true);
    const supabase = requireSupabase();
    const today = todayInFortaleza();
    const [
      flavorResult,
      imageResult,
      availabilityResult,
      channelResult,
      hourResult,
      exceptionResult,
      promoResult,
      campaignResult,
    ] = await Promise.all([
      supabase
        .from("flavors")
        .select(
          "id,name,category,short_description,description,ingredients,base_price,image_path,active,sort_order",
        )
        .order("sort_order")
        .order("name"),
      supabase
        .from("flavor_images")
        .select(
          "id,flavor_id,image_path,alt_text,caption,image_role,sort_order,active",
        )
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("flavor_availability")
        .select("id,flavor_id,status,note")
        .eq("service_date", today),
      supabase
        .from("store_channels")
        .select("slug,label,status,message,next_change_at")
        .order("slug"),
      supabase
        .from("business_hours")
        .select("id,channel_slug,weekday,opens_at,closes_at,active,note")
        .order("weekday")
        .order("opens_at"),
      supabase
        .from("business_hour_exceptions")
        .select(
          "id,channel_slug,service_date,closed,opens_at,closes_at,message",
        )
        .gte("service_date", today)
        .order("service_date")
        .limit(60),
      supabase
        .from("promotions")
        .select("id,title,body,starts_at,ends_at,active")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notification_campaigns")
        .select("id,title,body,topic,channels,status,scheduled_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const error =
      flavorResult.error ||
      imageResult.error ||
      availabilityResult.error ||
      channelResult.error ||
      hourResult.error ||
      exceptionResult.error ||
      promoResult.error ||
      campaignResult.error;
    setBusy(false);
    if (error) return setNotice(error.message);
    setFlavors((flavorResult.data || []) as Flavor[]);
    setImages((imageResult.data || []) as FlavorImage[]);
    setAvailability((availabilityResult.data || []) as Availability[]);
    setChannels((channelResult.data || []) as Channel[]);
    setHours((hourResult.data || []) as BusinessHour[]);
    setExceptions((exceptionResult.data || []) as BusinessHourException[]);
    setPromotions((promoResult.data || []) as Promotion[]);
    setCampaigns((campaignResult.data || []) as NotificationCampaign[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFlavor = async () => {
    if (draft.name.trim().length < 2)
      return setNotice("Informe o nome do produto.");
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      category: draft.category,
      short_description: draft.short_description.trim() || null,
      description: draft.description.trim() || null,
      ingredients: draft.ingredients.trim() || null,
      base_price: Number(draft.base_price.replace(",", ".")) || null,
      active: draft.active,
    };
    const query = editing
      ? requireSupabase().from("flavors").update(payload).eq("id", editing.id)
      : requireSupabase().from("flavors").insert(payload);
    const { error } = await query;
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(
      editing
        ? "Produto atualizado com segurança."
        : "Produto criado. Agora você pode adicionar as fotos.",
    );
    setEditing(null);
    setDraft({ ...emptyFlavor });
    await load();
  };

  const editFlavor = (flavor: Flavor) => {
    setEditing(flavor);
    setDraft({
      name: flavor.name,
      category: flavor.category,
      short_description: flavor.short_description || "",
      description: flavor.description || "",
      ingredients: flavor.ingredients || "",
      base_price: flavor.base_price?.toFixed(2) || "",
      active: flavor.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadImage = async (flavor: Flavor, file: File, role: string) => {
    const current = images.filter(
      (item) => item.flavor_id === flavor.id && item.active,
    );
    if (current.length >= PRODUCT_IMAGE_LIMIT)
      return setNotice(
        `Cada produto pode ter até ${PRODUCT_IMAGE_LIMIT} fotos.`,
      );
    const validation = validateProductImage(file);
    if (validation) return setNotice(validation);
    setBusy(true);
    try {
      const blob = await normalizeProductImage(file);
      const path = `produtos/${flavor.id}/${Date.now()}-${safeMediaFileName(flavor.name)}.webp`;
      const supabase = requireSupabase();
      const { error: uploadError } = await supabase.storage
        .from("adoce-media")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("adoce-media").getPublicUrl(path);
      const { error: imageError } = await supabase
        .from("flavor_images")
        .insert({
          flavor_id: flavor.id,
          image_path: data.publicUrl,
          alt_text: `${flavor.name} — foto ${role === "cover" ? "principal" : "da galeria"}`,
          image_role: role,
          sort_order: current.length,
        });
      if (imageError) throw imageError;
      if (role === "cover") {
        const { error: coverError } = await supabase
          .from("flavors")
          .update({ image_path: data.publicUrl })
          .eq("id", flavor.id);
        if (coverError) throw coverError;
      }
      setNotice("Foto otimizada e adicionada ao produto.");
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a foto.",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async (image: FlavorImage) => {
    if (!window.confirm("Remover esta foto da apresentação do produto?"))
      return;
    const { error } = await requireSupabase()
      .from("flavor_images")
      .update({ active: false })
      .eq("id", image.id);
    if (error) return setNotice(error.message);
    setNotice("Foto removida da apresentação.");
    await load();
  };

  const setTodayStatus = async (flavor: Flavor, status: AvailabilityStatus) => {
    setBusy(true);
    const { error } = await requireSupabase()
      .from("flavor_availability")
      .upsert(
        {
          flavor_id: flavor.id,
          service_date: todayInFortaleza(),
          status,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "flavor_id,service_date" },
      );
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`${flavor.name}: ${availabilityLabels[status]}.`);
    await load();
  };

  const saveChannel = async (channel: Channel) => {
    const { error } = await requireSupabase()
      .from("store_channels")
      .update({
        status: channel.status,
        message: channel.message?.trim() || null,
        next_change_at: channel.next_change_at || null,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", channel.slug);
    if (error) return setNotice(error.message);
    setNotice(`${channel.label} atualizado.`);
    await load();
  };

  const addHour = async () => {
    const { error } = await requireSupabase()
      .from("business_hours")
      .insert({ ...hourDraft, note: hourDraft.note.trim() || null });
    if (error) return setNotice(error.message);
    setNotice("Horário adicionado.");
    await load();
  };

  const removeHour = async (id: string) => {
    if (!window.confirm("Remover este horário recorrente?")) return;
    const { error } = await requireSupabase()
      .from("business_hours")
      .delete()
      .eq("id", id);
    if (error) return setNotice(error.message);
    await load();
  };

  const saveException = async () => {
    const { error } = await requireSupabase()
      .from("business_hour_exceptions")
      .upsert(
        {
          channel_slug: exceptionDraft.channel_slug,
          service_date: exceptionDraft.service_date,
          closed: exceptionDraft.closed,
          opens_at: exceptionDraft.closed ? null : exceptionDraft.opens_at,
          closes_at: exceptionDraft.closed ? null : exceptionDraft.closes_at,
          message: exceptionDraft.note.trim() || null,
        },
        { onConflict: "channel_slug,service_date" },
      );
    if (error) return setNotice(error.message);
    await load();
    setNotice("Exceção de funcionamento salva.");
  };

  const removeException = async (id: string) => {
    if (!window.confirm("Remover esta exceção de funcionamento?")) return;
    const { error } = await requireSupabase()
      .from("business_hour_exceptions")
      .delete()
      .eq("id", id);
    if (error) return setNotice(error.message);
    await load();
    setNotice("Exceção removida.");
  };

  const savePromotion = async () => {
    if (promoDraft.title.trim().length < 2 || promoDraft.body.trim().length < 2)
      return setNotice("Preencha o título e o texto da promoção.");
    const { error } = await requireSupabase()
      .from("promotions")
      .insert({
        title: promoDraft.title.trim(),
        body: promoDraft.body.trim(),
        starts_at: new Date(promoDraft.starts_at).toISOString(),
        ends_at: promoDraft.ends_at
          ? new Date(promoDraft.ends_at).toISOString()
          : null,
        active: promoDraft.active,
        created_by: session.user.id,
      });
    if (error) return setNotice(error.message);
    setPromoDraft({
      title: "",
      body: "",
      starts_at: todayInFortaleza() + "T09:00",
      ends_at: "",
      active: false,
    });
    setNotice("Promoção salva.");
    await load();
  };

  const togglePromotion = async (promo: Promotion) => {
    const { error } = await requireSupabase()
      .from("promotions")
      .update({ active: !promo.active })
      .eq("id", promo.id);
    if (error) return setNotice(error.message);
    await load();
    setNotice(promo.active ? "Promoção pausada." : "Promoção ativada.");
  };

  const removePromotion = async (promo: Promotion) => {
    if (!window.confirm(`Excluir a promoção “${promo.title}”?`)) return;
    const { error } = await requireSupabase()
      .from("promotions")
      .delete()
      .eq("id", promo.id);
    if (error) return setNotice(error.message);
    await load();
    setNotice("Promoção excluída.");
  };

  const saveCampaign = async () => {
    if (
      campaignDraft.title.trim().length < 2 ||
      campaignDraft.body.trim().length < 2
    )
      return setNotice("Preencha o título e a mensagem.");
    const { error } = await requireSupabase()
      .from("notification_campaigns")
      .insert({
        title: campaignDraft.title.trim(),
        body: campaignDraft.body.trim(),
        topic: campaignDraft.topic,
        channels: [campaignDraft.channel],
        status: campaignDraft.scheduled_at ? "scheduled" : "draft",
        scheduled_at: campaignDraft.scheduled_at
          ? new Date(campaignDraft.scheduled_at).toISOString()
          : null,
        created_by: session.user.id,
      });
    if (error) return setNotice(error.message);
    setCampaignDraft({
      title: "",
      body: "",
      topic: "flavors",
      channel: "email",
      scheduled_at: "",
    });
    setNotice(
      "Campanha salva como rascunho editorial. Nenhuma mensagem foi enviada sem revisão.",
    );
    await load();
  };

  const cancelCampaign = async (campaign: NotificationCampaign) => {
    if (!["draft", "scheduled"].includes(campaign.status))
      return setNotice(
        "Esta comunicação já iniciou o processamento e não pode ser cancelada aqui.",
      );
    if (!window.confirm(`Cancelar a comunicação “${campaign.title}”?`)) return;
    const { error } = await requireSupabase()
      .from("notification_campaigns")
      .update({ status: "cancelled" })
      .eq("id", campaign.id);
    if (error) return setNotice(error.message);
    setNotice(
      "Comunicação cancelada. Nenhuma nova mensagem será enviada por ela.",
    );
    await load();
  };

  const gallery = useMemo(
    () => images.filter((item) => item.flavor_id === galleryFlavor?.id),
    [images, galleryFlavor],
  );

  return (
    <div className="content-admin">
      <div className="operation-title content-admin-title">
        <div>
          <span>Operação e administração</span>
          <h1>Central Adoce</h1>
          <p>Atualize o Adoce Hoje sem depender de alterações no site.</p>
        </div>
        <a
          className="content-preview"
          href="/#adoce-hoje"
          target="_blank"
          rel="noreferrer"
        >
          <Eye /> Ver como cliente
        </a>
      </div>
      <nav className="content-tabs" aria-label="Áreas da administração">
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          <PackageOpen /> Produtos
        </button>
        <button
          className={tab === "today" ? "active" : ""}
          onClick={() => setTab("today")}
        >
          <Check /> Disponibilidade
        </button>
        <button
          className={tab === "operation" ? "active" : ""}
          onClick={() => setTab("operation")}
        >
          <Store /> Funcionamento
        </button>
        <button
          className={tab === "promotions" ? "active" : ""}
          onClick={() => setTab("promotions")}
        >
          <Megaphone /> Promoções
        </button>
        <button
          className={tab === "notifications" ? "active" : ""}
          onClick={() => setTab("notifications")}
        >
          <Bell /> Notificações
        </button>
      </nav>

      {tab === "catalog" && (
        <>
          <section className="admin-panel editor-panel">
            <div className="panel-heading">
              <div>
                <small>{editing ? "Editando produto" : "Novo produto"}</small>
                <h2>{editing?.name || "Cadastrar sabor"}</h2>
              </div>
              {editing && (
                <button
                  className="icon-button"
                  onClick={() => {
                    setEditing(null);
                    setDraft({ ...emptyFlavor });
                  }}
                >
                  <X />
                </button>
              )}
            </div>
            <div className="admin-form-grid">
              <label>
                Nome principal <span>{draft.name.length}/80</span>
                <input
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Categoria
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as "traditional" | "premium",
                    })
                  }
                >
                  <option value="traditional">Tradicional</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <label>
                Preço da fatia
                <input
                  inputMode="decimal"
                  value={draft.base_price}
                  onChange={(e) =>
                    setDraft({ ...draft, base_price: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Chamada curta <span>{draft.short_description.length}/90</span>
                <input
                  maxLength={90}
                  value={draft.short_description}
                  onChange={(e) =>
                    setDraft({ ...draft, short_description: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Descrição <span>{draft.description.length}/300</span>
                <textarea
                  maxLength={300}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Ingredientes e observações{" "}
                <span>{draft.ingredients.length}/400</span>
                <textarea
                  maxLength={400}
                  value={draft.ingredients}
                  onChange={(e) =>
                    setDraft({ ...draft, ingredients: e.target.value })
                  }
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />{" "}
                Exibir no catálogo
              </label>
            </div>
            <button
              className="admin-primary"
              onClick={() => void saveFlavor()}
              disabled={busy}
            >
              <Save /> {editing ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </section>
          <div className="admin-product-grid">
            {flavors.map((flavor) => (
              <article
                key={flavor.id}
                className={!flavor.active ? "inactive" : ""}
              >
                <div className="product-thumb">
                  {flavor.image_path ? (
                    <img src={flavor.image_path} alt={flavor.name} />
                  ) : (
                    <ImagePlus />
                  )}
                </div>
                <small>
                  {flavor.category === "premium" ? "Premium" : "Tradicional"}
                </small>
                <h3>{flavor.name}</h3>
                <p>
                  {flavor.short_description ||
                    "Descrição curta ainda não informada."}
                </p>
                <div className="product-actions">
                  <button onClick={() => editFlavor(flavor)}>
                    <Pencil /> Editar
                  </button>
                  <button onClick={() => setGalleryFlavor(flavor)}>
                    <ImagePlus /> Fotos (
                    {images.filter((i) => i.flavor_id === flavor.id).length})
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "today" && (
        <section className="admin-panel">
          <div className="panel-heading">
            <div>
              <small>Adoce Hoje</small>
              <h2>
                Disponibilidade de{" "}
                {new Date(todayInFortaleza() + "T12:00:00").toLocaleDateString(
                  "pt-BR",
                )}
              </h2>
              <p>O cliente verá somente o status que você confirmar aqui.</p>
            </div>
          </div>
          <div className="availability-list">
            {flavors
              .filter((f) => f.active)
              .map((flavor) => {
                const current =
                  availability.find((item) => item.flavor_id === flavor.id)
                    ?.status || "unavailable";
                return (
                  <article key={flavor.id}>
                    <span className={`availability-dot ${current}`} />
                    <div>
                      <strong>{flavor.name}</strong>
                      <small>{availabilityLabels[current]}</small>
                    </div>
                    <select
                      value={current}
                      onChange={(e) =>
                        void setTodayStatus(
                          flavor,
                          e.target.value as AvailabilityStatus,
                        )
                      }
                      disabled={busy}
                    >
                      {Object.entries(availabilityLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </article>
                );
              })}
          </div>
        </section>
      )}

      {tab === "operation" && (
        <>
          <div className="channel-grid">
            {channels.map((channel, index) => (
              <article className="admin-panel" key={channel.slug}>
                <Store />
                <h3>{channel.label}</h3>
                <label>
                  Funcionamento
                  <select
                    value={channel.status === "paused" ? "paused" : "scheduled"}
                    onChange={(e) =>
                      setChannels(
                        channels.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                status:
                                  e.target.value === "paused"
                                    ? "paused"
                                    : "closed",
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="scheduled">Seguir agenda automática</option>
                    <option value="paused">Pausar excepcionalmente</option>
                  </select>
                </label>
                <small>
                  Os horários abaixo determinam automaticamente quando aparece
                  aberto ou fechado.
                </small>
                <label>
                  Mensagem para o cliente
                  <input
                    maxLength={160}
                    value={channel.message || ""}
                    onChange={(e) =>
                      setChannels(
                        channels.map((item, i) =>
                          i === index
                            ? { ...item, message: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  className="admin-primary"
                  onClick={() => void saveChannel(channel)}
                >
                  <Save /> Atualizar
                </button>
              </article>
            ))}
          </div>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Agenda automática</small>
                <h2>Horários recorrentes</h2>
              </div>
            </div>
            <div className="hour-form">
              <select
                value={hourDraft.channel_slug}
                onChange={(e) =>
                  setHourDraft({ ...hourDraft, channel_slug: e.target.value })
                }
              >
                {channels.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={hourDraft.weekday}
                onChange={(e) =>
                  setHourDraft({
                    ...hourDraft,
                    weekday: Number(e.target.value),
                  })
                }
              >
                {week.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={hourDraft.opens_at}
                onChange={(e) =>
                  setHourDraft({ ...hourDraft, opens_at: e.target.value })
                }
              />
              <input
                type="time"
                value={hourDraft.closes_at}
                onChange={(e) =>
                  setHourDraft({ ...hourDraft, closes_at: e.target.value })
                }
              />
              <button className="admin-primary" onClick={() => void addHour()}>
                <Plus /> Adicionar
              </button>
            </div>
            <div className="hour-list">
              {hours.map((hour) => (
                <article key={hour.id}>
                  <Clock3 />
                  <span>
                    <strong>
                      {week[hour.weekday]} ·{" "}
                      {channels.find((c) => c.slug === hour.channel_slug)
                        ?.label || hour.channel_slug}
                    </strong>
                    <small>
                      {hour.opens_at.slice(0, 5)} às{" "}
                      {hour.closes_at.slice(0, 5)}
                    </small>
                  </span>
                  <button
                    className="icon-button danger"
                    onClick={() => void removeHour(hour.id)}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          </section>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Feriados e eventos</small>
                <h2>Exceções da agenda</h2>
                <p>
                  Esta configuração prevalece sobre o horário recorrente na data
                  escolhida.
                </p>
              </div>
            </div>
            <div className="exception-form">
              <select
                value={exceptionDraft.channel_slug}
                onChange={(e) =>
                  setExceptionDraft({
                    ...exceptionDraft,
                    channel_slug: e.target.value,
                  })
                }
              >
                {channels.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={exceptionDraft.service_date}
                onChange={(e) =>
                  setExceptionDraft({
                    ...exceptionDraft,
                    service_date: e.target.value,
                  })
                }
              />
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={exceptionDraft.closed}
                  onChange={(e) =>
                    setExceptionDraft({
                      ...exceptionDraft,
                      closed: e.target.checked,
                    })
                  }
                />{" "}
                Fechado nesta data
              </label>
              {!exceptionDraft.closed && (
                <>
                  <input
                    type="time"
                    value={exceptionDraft.opens_at}
                    onChange={(e) =>
                      setExceptionDraft({
                        ...exceptionDraft,
                        opens_at: e.target.value,
                      })
                    }
                  />
                  <input
                    type="time"
                    value={exceptionDraft.closes_at}
                    onChange={(e) =>
                      setExceptionDraft({
                        ...exceptionDraft,
                        closes_at: e.target.value,
                      })
                    }
                  />
                </>
              )}
              <input
                maxLength={160}
                placeholder="Observação para o cliente"
                value={exceptionDraft.note}
                onChange={(e) =>
                  setExceptionDraft({ ...exceptionDraft, note: e.target.value })
                }
              />
              <button
                className="admin-primary"
                onClick={() => void saveException()}
              >
                <Save /> Salvar exceção
              </button>
            </div>
            <div className="hour-list">
              {exceptions.map((item) => (
                <article key={item.id}>
                  <CalendarClock />
                  <span>
                    <strong>
                      {new Date(
                        item.service_date + "T12:00:00",
                      ).toLocaleDateString("pt-BR")}{" "}
                      ·{" "}
                      {channels.find((c) => c.slug === item.channel_slug)
                        ?.label || item.channel_slug}
                    </strong>
                    <small>
                      {item.closed
                        ? "Fechado"
                        : `${item.opens_at?.slice(0, 5)} às ${item.closes_at?.slice(0, 5)}`}{" "}
                      {item.message ? `· ${item.message}` : ""}
                    </small>
                  </span>
                  <button
                    className="icon-button danger"
                    onClick={() => void removeException(item.id)}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "promotions" && (
        <>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Comunicação comercial</small>
                <h2>Nova promoção</h2>
              </div>
            </div>
            <div className="admin-form-grid">
              <label>
                Título
                <input
                  maxLength={80}
                  value={promoDraft.title}
                  onChange={(e) =>
                    setPromoDraft({ ...promoDraft, title: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Texto
                <textarea
                  maxLength={300}
                  value={promoDraft.body}
                  onChange={(e) =>
                    setPromoDraft({ ...promoDraft, body: e.target.value })
                  }
                />
              </label>
              <label>
                Início
                <input
                  type="datetime-local"
                  value={promoDraft.starts_at}
                  onChange={(e) =>
                    setPromoDraft({ ...promoDraft, starts_at: e.target.value })
                  }
                />
              </label>
              <label>
                Fim opcional
                <input
                  type="datetime-local"
                  value={promoDraft.ends_at}
                  onChange={(e) =>
                    setPromoDraft({ ...promoDraft, ends_at: e.target.value })
                  }
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={promoDraft.active}
                  onChange={(e) =>
                    setPromoDraft({ ...promoDraft, active: e.target.checked })
                  }
                />{" "}
                Publicar assim que começar
              </label>
            </div>
            <button
              className="admin-primary"
              onClick={() => void savePromotion()}
            >
              <Save /> Salvar promoção
            </button>
          </section>
          <div className="promotion-list">
            {promotions.map((promo) => (
              <article className="admin-panel" key={promo.id}>
                <Megaphone />
                <span>
                  <strong>{promo.title}</strong>
                  <p>{promo.body}</p>
                  <small>
                    {promo.active ? "Ativa" : "Rascunho"} ·{" "}
                    {new Date(promo.starts_at).toLocaleString("pt-BR")}
                  </small>
                  <div className="promotion-actions">
                    <button onClick={() => void togglePromotion(promo)}>
                      {promo.active ? "Pausar" : "Ativar"}
                    </button>
                    <button
                      className="danger"
                      onClick={() => void removePromotion(promo)}
                    >
                      <Trash2 /> Excluir
                    </button>
                  </div>
                </span>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "notifications" && (
        <>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <small>Central de notificações</small>
                <h2>Preparar comunicação</h2>
                <p>
                  A campanha fica em rascunho ou agendada. O envio só ocorrerá
                  pelos canais efetivamente configurados e autorizados pelo
                  cliente.
                </p>
              </div>
            </div>
            <div className="admin-form-grid">
              <label>
                Título <span>{campaignDraft.title.length}/80</span>
                <input
                  maxLength={80}
                  value={campaignDraft.title}
                  onChange={(e) =>
                    setCampaignDraft({
                      ...campaignDraft,
                      title: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Assunto
                <select
                  value={campaignDraft.topic}
                  onChange={(e) =>
                    setCampaignDraft({
                      ...campaignDraft,
                      topic: e.target.value,
                    })
                  }
                >
                  <option value="flavors">Sabores disponíveis</option>
                  <option value="festival">Festival</option>
                  <option value="promotions">Promoções</option>
                  <option value="club_news">Novidades do Clube</option>
                  <option value="rewards">Prêmios e indicações</option>
                  <option value="birthday">Aniversário</option>
                </select>
              </label>
              <label>
                Canal
                <select
                  value={campaignDraft.channel}
                  onChange={(e) =>
                    setCampaignDraft({
                      ...campaignDraft,
                      channel: e.target.value,
                    })
                  }
                >
                  <option value="email">E-mail</option>
                  <option value="push">Notificação do aparelho</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              <label>
                Agendar (opcional)
                <input
                  type="datetime-local"
                  value={campaignDraft.scheduled_at}
                  onChange={(e) =>
                    setCampaignDraft({
                      ...campaignDraft,
                      scheduled_at: e.target.value,
                    })
                  }
                />
              </label>
              <label className="wide">
                Mensagem <span>{campaignDraft.body.length}/240</span>
                <textarea
                  maxLength={240}
                  value={campaignDraft.body}
                  onChange={(e) =>
                    setCampaignDraft({ ...campaignDraft, body: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="admin-safety">
              <CalendarClock />
              <span>
                <strong>Revisão antes do disparo</strong>
                <small>
                  Rascunhos não enviam mensagens. Push e WhatsApp só serão
                  liberados após a configuração técnica dos respectivos
                  provedores.
                </small>
              </span>
            </div>
            <button
              className="admin-primary"
              onClick={() => void saveCampaign()}
            >
              <Save /> Salvar comunicação
            </button>
          </section>
          <div className="promotion-list">
            {campaigns.map((campaign) => (
              <article className="admin-panel" key={campaign.id}>
                <Bell />
                <span>
                  <strong>{campaign.title}</strong>
                  <p>{campaign.body}</p>
                  <small>
                    {campaign.status === "draft"
                      ? "Rascunho"
                      : campaign.status === "scheduled"
                        ? "Agendada"
                        : campaign.status === "cancelled"
                          ? "Cancelada"
                          : campaign.status}{" "}
                    · {campaign.channels.join(", ")}{" "}
                    {campaign.scheduled_at
                      ? `· ${new Date(campaign.scheduled_at).toLocaleString("pt-BR")}`
                      : ""}
                  </small>
                  {["draft", "scheduled"].includes(campaign.status) && (
                    <div className="promotion-actions">
                      <button
                        className="danger"
                        onClick={() => void cancelCampaign(campaign)}
                      >
                        Cancelar comunicação
                      </button>
                    </div>
                  )}
                </span>
              </article>
            ))}
          </div>
        </>
      )}

      {galleryFlavor && (
        <div
          className="operation-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Fotos do produto"
        >
          <div className="gallery-modal">
            <button
              className="modal-close"
              onClick={() => setGalleryFlavor(null)}
            >
              <X />
            </button>
            <small>Galeria do produto</small>
            <h2>{galleryFlavor.name}</h2>
            <p>
              Até {PRODUCT_IMAGE_LIMIT} fotos. O sistema reduz automaticamente
              para WebP e no máximo 1600 px.
            </p>
            <div className="gallery-grid">
              {gallery.map((image) => (
                <figure key={image.id}>
                  <img src={image.image_path} alt={image.alt_text} />
                  <figcaption>
                    {image.image_role === "cover" ? "Principal" : "Galeria"}
                    <button onClick={() => void removeImage(image)}>
                      <Trash2 />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="upload-row">
              <label className="admin-primary">
                <ImagePlus /> Foto principal
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    void uploadImage(galleryFlavor, e.target.files[0], "cover")
                  }
                />
              </label>
              <label className="admin-secondary">
                <Plus /> Adicionar à galeria
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    void uploadImage(
                      galleryFlavor,
                      e.target.files[0],
                      "gallery",
                    )
                  }
                />
              </label>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="operation-toast">
          <Check /> {notice}
          <button onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      )}
      {busy && <div className="admin-busy">Salvando com segurança...</div>}
    </div>
  );
}
