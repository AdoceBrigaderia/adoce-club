import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CakeSlice,
  Check,
  Copy,
  Heart,
  Infinity as InfinityIcon,
  Link2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  PackageCheck,
  PartyPopper,
  Plus,
  ShoppingBag,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import PublicHeader from "./PublicHeader";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import {
  buildPedeJuntoWhatsAppMessage,
  money,
  parsePedeJuntoHash,
  pedeJuntoInviteUrl,
  pedeJuntoStatuses,
  roomProgressCopy,
  readPedeJuntoAccess,
  savePedeJuntoAccess,
  type PedeJuntoFlavor,
  type PedeJuntoRoom,
  type StoredPedeJuntoAccess,
} from "./pede-junto";
import "./public-site.css";
import "./pede-junto.css";

type DialogMode = "create" | "enter" | "join" | null;

const places = [
  { label: "No trabalho", image: "/site/pede-junto-trabalho.webp" },
  { label: "No condomínio", image: "/site/pede-junto-condominio.webp" },
  { label: "Na faculdade", image: "/site/pede-junto-faculdade.webp" },
  { label: "Na clínica", image: "/site/pede-junto-clinica.webp" },
];

function fortalezaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

export default function GroupOrderPage() {
  const initialHash = useMemo(() => parsePedeJuntoHash(), []);
  const [dialog, setDialog] = useState<DialogMode>(
    initialHash.code && initialHash.invitationToken ? null : null,
  );
  const [room, setRoom] = useState<PedeJuntoRoom | null>(null);
  const [flavors, setFlavors] = useState<PedeJuntoFlavor[]>([]);
  const [code, setCode] = useState(initialHash.code);
  const [invitationToken, setInvitationToken] = useState(
    initialHash.invitationToken,
  );
  const [access, setAccess] = useState<StoredPedeJuntoAccess | null>(() =>
    initialHash.code ? readPedeJuntoAccess(initialHash.code) : null,
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [creatingAnotherOrder, setCreatingAnotherOrder] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [createForm, setCreateForm] = useState({
    groupName: "",
    name: "",
    phone: "",
    address: "",
    reference: "",
  });
  const [joinForm, setJoinForm] = useState({ name: "", phone: "" });
  const [inviteInput, setInviteInput] = useState("");

  const loadFlavors = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = requireSupabase();
    const today = fortalezaDate();
    const [{ data: catalog }, availabilityResult] = await Promise.all([
      supabase
        .from("flavors")
        .select("id,name,image_path,base_price")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("flavor_availability")
        .select(
          "flavor_id,status,quantity_available,quantity_reserved",
        )
        .eq("service_date", today),
    ]);
    const availability = availabilityResult.error
      ? (
          await supabase
            .from("flavor_availability")
            .select("flavor_id,status")
            .eq("service_date", today)
        ).data || []
      : availabilityResult.data || [];
    setFlavors(
      (catalog || [])
        .map((flavor) => {
          const stock = availability.find(
            (item) => item.flavor_id === flavor.id,
          ) as {
            status?: string;
            quantity_available?: number | null;
            quantity_reserved?: number;
          } | undefined;
          return {
            ...flavor,
            base_price: Number(flavor.base_price || 0),
            status: stock?.status || "unavailable",
            quantity_available: stock?.quantity_available ?? null,
            quantity_reserved: stock?.quantity_reserved || 0,
          } satisfies PedeJuntoFlavor;
        })
        .filter((flavor) =>
          ["available", "last_units", "preorder_only"].includes(flavor.status),
        ),
    );
  }, []);

  const loadRoom = useCallback(
    async (
      nextCode = code,
      nextInvitationToken = invitationToken,
      nextParticipantToken = access?.participantToken || "",
      silent = false,
    ) => {
      if (!nextCode || !nextInvitationToken || !isSupabaseConfigured) return;
      if (!silent) setBusy(true);
      const { data, error } = await requireSupabase().rpc("pede_junto_room", {
        group_code: nextCode,
        invitation_token: nextInvitationToken,
        participant_token: nextParticipantToken || null,
      });
      if (!silent) setBusy(false);
      if (error) {
        if (!silent) setNotice(error.message);
        return;
      }
      const nextRoom = data as PedeJuntoRoom;
      setRoom(nextRoom);
      const viewer = nextRoom.participants.find((item) => item.is_viewer);
      if (viewer) {
        setQuantities(
          Object.fromEntries(viewer.items.map((item) => [item.flavor_id, item.quantity])),
        );
      }
    },
    [access?.participantToken, code, invitationToken],
  );

  useEffect(() => {
    document.title = "Pede Junto Adoce · Adoce Brigaderia";
    void loadFlavors();
  }, [loadFlavors]);

  useEffect(() => {
    if (!code || !invitationToken) return;
    void loadRoom();
    const timer = window.setInterval(() => void loadRoom(undefined, undefined, undefined, true), 12_000);
    return () => window.clearInterval(timer);
  }, [code, invitationToken, loadRoom]);

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) return setNotice("O serviço está temporariamente indisponível.");
    setBusy(true);
    setNotice("");
    const { data, error } = await requireSupabase().rpc("create_pede_junto_group", {
      group_name: createForm.groupName,
      organizer_name: createForm.name,
      organizer_phone: createForm.phone,
      delivery_address: createForm.address,
      delivery_reference: createForm.reference || null,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = data as {
      public_code: string;
      invitation_token: string;
      organizer_token: string;
      participant_token: string;
      room: PedeJuntoRoom;
    };
    const nextAccess: StoredPedeJuntoAccess = {
      invitationToken: result.invitation_token,
      participantToken: result.participant_token,
      organizerToken: result.organizer_token,
    };
    savePedeJuntoAccess(result.public_code, nextAccess);
    setAccess(nextAccess);
    setCode(result.public_code);
    setInvitationToken(result.invitation_token);
    setRoom(result.room);
    setDialog(null);
    setCreatingAnotherOrder(false);
    setSelectionOpen(true);
    window.location.hash = `pede-junto?grupo=${encodeURIComponent(result.public_code)}&convite=${encodeURIComponent(result.invitation_token)}`;
    window.setTimeout(
      () => document.querySelector("#sala-pede-junto")?.scrollIntoView({ behavior: "smooth" }),
      80,
    );
  };

  const joinGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!code || !invitationToken) return;
    setBusy(true);
    setNotice("");
    const { data, error } = await requireSupabase().rpc("join_pede_junto_group", {
      group_code: code,
      invitation_token: invitationToken,
      participant_name: joinForm.name,
      participant_phone: joinForm.phone,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = data as {
      participant_token: string;
      room: PedeJuntoRoom;
    };
    const nextAccess = {
      invitationToken,
      participantToken: result.participant_token,
    };
    savePedeJuntoAccess(code, nextAccess);
    setAccess(nextAccess);
    setRoom(result.room);
    setDialog(null);
    setSelectionOpen(true);
  };

  const openInvitation = (event: FormEvent) => {
    event.preventDefault();
    try {
      const value = inviteInput.trim();
      const parsed = value.startsWith("http")
        ? parsePedeJuntoHash(new URL(value).hash)
        : parsePedeJuntoHash(`#pede-junto?${value.replace(/^.*\?/, "")}`);
      if (!parsed.code || !parsed.invitationToken) throw new Error();
      window.location.hash = `pede-junto?grupo=${encodeURIComponent(parsed.code)}&convite=${encodeURIComponent(parsed.invitationToken)}`;
      window.location.reload();
    } catch {
      setNotice("Cole o link completo que você recebeu pelo WhatsApp.");
    }
  };

  const saveSelection = async () => {
    if (!code || !access?.participantToken) return;
    setBusy(true);
    setNotice("");
    for (const flavor of flavors) {
      const selected = quantities[flavor.id] || 0;
      const viewerItem = room?.participants
        .find((participant) => participant.is_viewer)
        ?.items.find((item) => item.flavor_id === flavor.id);
      if (selected === (viewerItem?.quantity || 0)) continue;
      const { data, error } = await requireSupabase().rpc(
        "set_pede_junto_selection",
        {
          group_code: code,
          participant_token: access.participantToken,
          selected_flavor_id: flavor.id,
          selected_quantity: selected,
        },
      );
      if (error) {
        setBusy(false);
        setNotice(error.message);
        return;
      }
      setRoom(data as PedeJuntoRoom);
    }
    setBusy(false);
    setSelectionOpen(false);
    setNotice("Sua escolha entrou no grupo. Você ainda pode adicionar mais fatias.");
    await loadRoom();
  };

  const submitGroup = async () => {
    if (!room || !access?.organizerToken) return;
    if (!window.confirm(`Encerrar o grupo com ${room.total_slices} fatias e enviar para a Adoce?`)) return;
    setBusy(true);
    setNotice("");
    const { data, error } = await requireSupabase().rpc("submit_pede_junto_group", {
      group_code: room.public_code,
      organizer_token: access.organizerToken,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = data as {
      submitted: boolean;
      conflicts: Array<{ flavor_name: string; requested: number; available: number }>;
      room?: PedeJuntoRoom;
    };
    if (!result.submitted) {
      setNotice(
        `Precisamos ajustar o estoque: ${result.conflicts
          .map((item) => `${item.flavor_name} (${item.available} ${item.available === 1 ? "disponível" : "disponíveis"})`)
          .join(", ")}. O restante do grupo continua salvo.`,
      );
      return;
    }
    if (result.room) setRoom(result.room);
    setNotice("Pedido enviado! Agora a Adoce vai conferir, separar e liberar os pagamentos individuais.");
  };

  const inviteUrl = room && invitationToken
    ? pedeJuntoInviteUrl(room.public_code, invitationToken)
    : "";
  const whatsappShare = room
    ? `https://wa.me/?text=${encodeURIComponent(buildPedeJuntoWhatsAppMessage(room, inviteUrl))}`
    : "";
  const progress = room
    ? roomProgressCopy(room)
    : { title: "0 de 5 fatias", message: "Faltam 5 para liberar a entrega grátis.", tone: "building" as const };
  const viewer = room?.participants.find((participant) => participant.is_viewer);
  const isOrganizer = Boolean(access?.organizerToken);
  const canEdit = room?.status === "open" && Boolean(access?.participantToken);
  const groupIsOpen = room?.status === "open";
  const canStartAnotherOrder = room
    ? ["completed", "cancelled", "expired"].includes(room.status)
    : false;
  const availableTotal = flavors.reduce((sum, flavor) => {
    if (flavor.quantity_available === null) return sum;
    return sum + Math.max(flavor.quantity_available - flavor.quantity_reserved, 0);
  }, 0);

  const openCreateDialog = (reuseCurrentGroup = false) => {
    setNotice("");
    setCreatingAnotherOrder(reuseCurrentGroup);
    if (reuseCurrentGroup && room) {
      setCreateForm((current) => ({
        groupName: `Novo pedido · ${room.name}`.slice(0, 60),
        name: viewer?.name || room.organizer_name,
        phone: current.phone,
        address: room.delivery_address,
        reference: room.delivery_reference || "",
      }));
    }
    setDialog("create");
  };

  const closeDialog = () => {
    setDialog(null);
    setCreatingAnotherOrder(false);
  };

  return (
    <main className="public-site pede-junto-page">
      <PublicHeader />

      <section className="pede-junto-hero" id="inicio-pede-junto">
        <div className="pede-junto-hero-copy">
          <a className="public-back on-dark" href="/#inicio"><ArrowLeft /> Voltar à Adoce</a>
          <p className="pede-junto-kicker">Pede Junto Adoce</p>
          <h1>Uma fatia custa R$ 16. <em>A entrega pode custar R$ 0.</em></h1>
          <p>Você escolhe só a sua. Junte cinco fatias ou mais no mesmo endereço e a entrega fica por conta da Adoce.</p>
          <strong className="pede-junto-unlock"><PartyPopper /> 5 fatias = entrega grátis</strong>
          <div className="pede-junto-hero-actions">
            <button onClick={() => openCreateDialog()}>Começar com a minha fatia <ArrowRight /></button>
            <button className="secondary" onClick={() => setDialog("enter")}>Entrar pelo convite <Link2 /></button>
          </div>
        </div>
        <figure>
          <img src="/adoce-hoje/trufado-ninho-morango.webp" alt="Fatia real Adoce de chocolate trufado com Ninho e morangos" />
        </figure>
      </section>

      <section className="pede-junto-invite-band">
        <div>
          <h2>{room && !groupIsOpen ? "Bora de novo?" : "Bora de fatia?"}</h2>
          <p>{room && !groupIsOpen ? <>Um novo pedido merece um <em>novo grupo.</em></> : <>Falta pouco pra nossa entrega ficar <em>grátis.</em></>}</p>
        </div>
        <div>
          <strong>{room && !groupIsOpen ? "Outro pedido começa limpo, sem misturar o que já foi entregue." : "Cada um escolhe. Cada um paga o seu."}</strong>
          <p>{room && !groupIsOpen ? "Você pode aproveitar o nome e o endereço anteriores, mas cada participante fará uma nova escolha." : "Sem vaquinha e sem uma pessoa pagar pelo grupo inteiro. Todo mundo recebe junto."}</p>
          <button onClick={() => room && groupIsOpen ? window.open(whatsappShare, "_blank") : openCreateDialog(Boolean(room))}>
            {room && !groupIsOpen ? <Plus /> : <MessageCircle />} {room && groupIsOpen ? "Convidar no WhatsApp" : room ? "Abrir novo grupo" : "Criar e convidar"}
          </button>
        </div>
      </section>

      <section className="pede-junto-experience" id="sala-pede-junto">
        {room ? (
          <div className="pede-junto-room-shell">
            <aside className="pede-junto-room-story">
              <p>{room.status === "completed" ? <>Pedido entregue,<br />do jeitinho<br />Adoce.</> : <>Seu grupo,<br />tudo junto<br />num só lugar.</>}</p>
              <Heart />
              <small>{room.status === "open" ? "Ao chegar a cinco, a entrega é grátis. Depois disso, o grupo continua aberto." : room.status === "completed" ? "Este pedido terminou, mas o histórico continua aqui para você conferir." : "Este grupo já foi encerrado e não recebe novos participantes ou fatias."}</small>
            </aside>
            <article className={`pede-junto-room ${progress.tone}`}>
              <header>
                <div>
                  <small>{pedeJuntoStatuses[room.status]}</small>
                  <h2>{room.name}</h2>
                  <p><MapPin /> {room.delivery_address}</p>
                </div>
                <span className="pede-junto-code">#{room.public_code}</span>
              </header>
              <div className="pede-junto-progress-copy">
                <strong>{progress.title}</strong>
                <span>{progress.message}</span>
              </div>
              <div className="pede-junto-progress" aria-label={`${room.total_slices} fatias no grupo`}>
                {Array.from({ length: Math.max(5, Math.min(room.total_slices, 10)) }, (_, index) => (
                  <span key={index} className={index < room.total_slices ? "filled" : ""}>
                    {index + 1}
                  </span>
                ))}
                {room.total_slices >= 5 ? <span className="more"><InfinityIcon /></span> : null}
              </div>
              {room.free_delivery ? (
                <div className="pede-junto-free"><PartyPopper /><span><strong>{room.status === "completed" ? "Entrega grátis aproveitada!" : "Entrega grátis liberada!"}</strong><small>{room.status === "open" ? "Continue chamando: quanto mais fatias, mais doce fica." : room.status === "completed" ? "Pedido entregue e benefício concluído com sucesso." : "Benefício garantido neste pedido."}</small></span></div>
              ) : null}
              <div className="pede-junto-participants">
                {room.participants.map((participant) => {
                  const amount = participant.items.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <div key={participant.id} className={participant.is_viewer ? "viewer" : ""}>
                      <span className="pede-junto-avatar">{participant.name.slice(0, 1).toUpperCase()}</span>
                      <span>
                        <strong>{participant.name}{participant.is_viewer ? " (você)" : ""}</strong>
                        <small>{participant.items.length ? participant.items.map((item) => `${item.quantity}× ${item.flavor_name}`).join(" · ") : "Ainda escolhendo"}</small>
                      </span>
                      <b>{amount ? `${amount} fatia${amount > 1 ? "s" : ""}` : "—"}</b>
                      {participant.status === "paid" ? <Check className="paid" /> : <CakeSlice />}
                    </div>
                  );
                })}
              </div>

              {!access?.participantToken && room.status === "open" ? (
                <button className="pede-junto-primary" onClick={() => setDialog("join")}><Plus /> Entrar e escolher minha fatia</button>
              ) : null}
              {canEdit ? (
                <button className="pede-junto-primary" onClick={() => setSelectionOpen(true)}><Plus /> Adicionar mais uma fatia</button>
              ) : null}
              {isOrganizer && room.status === "open" ? (
                <button className="pede-junto-submit" disabled={room.total_slices < room.minimum_slices || busy} onClick={() => void submitGroup()}>
                  <PackageCheck /> Encerrar grupo e enviar para a Adoce
                </button>
              ) : null}
              {viewer?.payment_url ? (
                <a className="pede-junto-payment" href={viewer.payment_url} target="_blank" rel="noreferrer"><WalletCards /> Pagar somente as minhas fatias <ArrowRight /></a>
              ) : null}
              {groupIsOpen ? (
                <footer>
                  <button onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => setNotice("Link copiado."))}><Copy /> Copiar convite</button>
                  <a href={whatsappShare} target="_blank" rel="noreferrer"><MessageCircle /> Chamar mais alguém</a>
                </footer>
              ) : canStartAnotherOrder ? (
                <footer className="pede-junto-closed-actions">
                  <button className="pede-junto-restart" onClick={() => openCreateDialog(true)}><Plus /> Abrir novo grupo para outro pedido <ArrowRight /></button>
                  <small>O novo grupo começa do zero. Este pedido continua salvo no histórico.</small>
                </footer>
              ) : null}
            </article>
            <aside className="pede-junto-room-rules">
              <Heart />
              <strong>Regra da entrega grátis</strong>
              <p>Mínimo de cinco fatias no mesmo endereço. O grupo pode continuar crescendo sem limite.</p>
              {availableTotal > 0 ? <small>{availableTotal} {availableTotal === 1 ? "fatia cadastrada" : "fatias cadastradas"} hoje.</small> : null}
            </aside>
          </div>
        ) : (
          <div className="pede-junto-room-preview">
            <div>
              <small>Sala compartilhada</small>
              <h2>O grupo cresce até vocês decidirem encerrar.</h2>
              <p>Na quinta fatia, a entrega grátis é desbloqueada. A sexta, a décima e todas as próximas continuam entrando normalmente.</p>
              <button onClick={() => openCreateDialog()}>Abrir meu Pede Junto <ArrowRight /></button>
            </div>
            <div className="pede-junto-milestones">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <span className={item <= 5 ? "filled" : ""} key={item}>{item}</span>)}
              <span className="more"><InfinityIcon /></span>
            </div>
            <strong><PartyPopper /> A quinta libera. As próximas deixam o grupo ainda melhor.</strong>
          </div>
        )}
        {notice ? <div className="pede-junto-notice" role="status">{notice}</div> : null}
      </section>

      <section className="pede-junto-how" id="como-funciona">
        <header><small>O básico feliz</small><h2>Como funciona</h2></header>
        <ol>
          <li><MapPin /><strong>Escolha sua fatia</strong><p>Comece com uma ou mais. Você escolhe o sabor e a quantidade.</p></li>
          <li><Link2 /><strong>Compartilhe o convite</strong><p>O link abre a mesma sala para todo mundo no WhatsApp.</p></li>
          <li><ShoppingBag /><strong>Cada pessoa escolhe</strong><p>As escolhas ficam separadas pelo nome de cada participante.</p></li>
          <li><WalletCards /><strong>Cada um paga o seu</strong><p>Ninguém precisa adiantar ou cobrar o pagamento do grupo.</p></li>
          <li><PartyPopper /><strong>Com cinco, é grátis</strong><p>A meta libera a entrega e o grupo segue aberto para receber mais.</p></li>
        </ol>
      </section>

      <section className="pede-junto-places">
        <header><Building2 /><h2>Cabe em todo lugar <span>(e todo grupo).</span></h2></header>
        <div>
          {places.map((place) => (
            <figure key={place.label}><img src={place.image} alt={`${place.label}, pessoas que podem usar o Pede Junto Adoce`} /><figcaption>{place.label}</figcaption></figure>
          ))}
        </div>
      </section>

      <section className="pede-junto-proof">
        <div><small>Carinho em cada pacote</small><h2>Na Adoce, cada pacote vai <em>identificado.</em></h2><p>Cada pessoa recebe exatamente o que escolheu, com o carinho escrito em cada pacote.</p></div>
        <img src="/site/pede-junto-pacotes.webp" alt="Oito pacotes reais Adoce identificados com os nomes dos participantes de um pedido coletivo" />
      </section>

      <section className="pede-junto-final">
        <div><Sparkles /><h2>Quem vai entrar na próxima fatia?</h2></div>
        <strong>Chama +1.<br />Adoça +1.<br /><em>Entrega grátis.</em></strong>
        <button onClick={() => openCreateDialog()}>Abrir meu Pede Junto <ArrowRight /></button>
      </section>

      {dialog ? (
        <div className="pede-junto-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <section className="pede-junto-dialog" role="dialog" aria-modal="true" aria-labelledby="pede-junto-dialog-title">
            <button className="pede-junto-dialog-close" onClick={closeDialog} aria-label="Fechar"><X /></button>
            {dialog === "create" ? (
              <form onSubmit={createGroup}>
                <small>{creatingAnotherOrder ? "Novo pedido · novo grupo" : "Pede Junto Adoce"}</small>
                <h2 id="pede-junto-dialog-title">{creatingAnotherOrder ? "Vamos adoçar de novo?" : "Comece com a sua fatia."}</h2>
                <p>{creatingAnotherOrder ? "Aproveitamos o nome e o endereço para facilitar. Participantes e fatias começam do zero." : "Você cria a sala, compartilha o link e decide quando encerrar."}</p>
                <label>Nome do grupo<input required minLength={3} maxLength={60} value={createForm.groupName} onChange={(event) => setCreateForm({ ...createForm, groupName: event.target.value })} placeholder="Ex.: Intervalo da firma" /></label>
                <div><label>Seu nome<input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></label><label>Seu WhatsApp<input required inputMode="tel" value={createForm.phone} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} placeholder="(85) 99999-9999" /></label></div>
                <label>Endereço único da entrega<input required minLength={8} value={createForm.address} onChange={(event) => setCreateForm({ ...createForm, address: event.target.value })} placeholder="Rua, número, bairro e Fortaleza" /></label>
                <label>Referência ou bloco <span>(opcional)</span><input value={createForm.reference} onChange={(event) => setCreateForm({ ...createForm, reference: event.target.value })} /></label>
                <button disabled={busy}>{busy ? "Criando..." : "Criar minha sala"}<ArrowRight /></button>
              </form>
            ) : dialog === "enter" ? (
              <form onSubmit={openInvitation}>
                <small>Recebeu um convite?</small>
                <h2 id="pede-junto-dialog-title">Entre no mesmo grupo.</h2>
                <p>Cole o link enviado pelo organizador no WhatsApp.</p>
                <label>Link do convite<input required value={inviteInput} onChange={(event) => setInviteInput(event.target.value)} placeholder="https://adocebrigaderia.com.br/#pede-junto?..." /></label>
                <button>Abrir o grupo <ArrowRight /></button>
              </form>
            ) : (
              <form onSubmit={joinGroup}>
                <small>{room?.name}</small>
                <h2 id="pede-junto-dialog-title">Agora escolha a sua.</h2>
                <p>Cada pessoa entra com o próprio nome e paga apenas suas fatias.</p>
                <label>Seu nome<input required value={joinForm.name} onChange={(event) => setJoinForm({ ...joinForm, name: event.target.value })} /></label>
                <label>Seu WhatsApp<input required inputMode="tel" value={joinForm.phone} onChange={(event) => setJoinForm({ ...joinForm, phone: event.target.value })} placeholder="(85) 99999-9999" /></label>
                <button disabled={busy}>{busy ? "Entrando..." : "Entrar e escolher"}<ArrowRight /></button>
              </form>
            )}
            {notice ? <div className="pede-junto-dialog-notice">{notice}</div> : null}
          </section>
        </div>
      ) : null}

      {selectionOpen && access?.participantToken ? (
        <div className="pede-junto-selection-backdrop">
          <section className="pede-junto-selection" role="dialog" aria-modal="true" aria-labelledby="selection-title">
            <header><div><small>{room?.name}</small><h2 id="selection-title">Escolha suas fatias</h2><p>Você pode escolher uma, duas ou quantas quiser.</p></div><button onClick={() => setSelectionOpen(false)} aria-label="Fechar"><X /></button></header>
            <div className="pede-junto-flavors">
              {flavors.map((flavor) => {
                const free = flavor.quantity_available === null
                  ? null
                  : Math.max(flavor.quantity_available - flavor.quantity_reserved, 0);
                const quantity = quantities[flavor.id] || 0;
                return (
                  <article key={flavor.id}>
                    <img src={flavor.image_path || "/adoce-hoje/sabores-hoje.webp"} alt={flavor.name} />
                    <div><strong>{flavor.name}</strong><span>{money(flavor.base_price)}</span>{free !== null ? <small>{free} {free === 1 ? "disponível" : "disponíveis"} agora</small> : <small>Disponibilidade confirmada pela Adoce</small>}</div>
                    <div className="pede-junto-stepper"><button type="button" onClick={() => setQuantities({ ...quantities, [flavor.id]: Math.max(0, quantity - 1) })} disabled={!quantity}>−</button><b>{quantity}</b><button type="button" onClick={() => setQuantities({ ...quantities, [flavor.id]: quantity + 1 })} disabled={free !== null && quantity >= free}>+</button></div>
                  </article>
                );
              })}
              {!flavors.length ? <p className="pede-junto-empty">Os sabores do dia estão sendo atualizados. Tente novamente em alguns instantes.</p> : null}
            </div>
            <footer><span><strong>{Object.values(quantities).reduce((sum, value) => sum + value, 0)} fatias</strong><small>Você poderá voltar, adicionar mais ou retirar suas escolhas enquanto o grupo estiver aberto.</small></span><button disabled={busy} onClick={() => void saveSelection()}>{busy ? "Salvando..." : "Salvar minhas escolhas"}<ArrowRight /></button></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
