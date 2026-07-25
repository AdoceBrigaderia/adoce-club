import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import QRCode from "qrcode";
import {
  ArrowRight,
  Archive,
  CakeSlice,
  CalendarDays,
  Camera,
  Check,
  ClipboardCheck,
  CircleDollarSign,
  CircleHelp,
  Copy,
  Download,
  Gift,
  Heart,
  History,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Mail,
  KeyRound,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Settings2,
  ShoppingCart,
  Share2,
  ShieldCheck,
  SquarePlus,
  Smartphone,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-print.css";
import { printOperation } from "./lib/operation-print";
import {
  beginWhatsAppVerification,
  getWhatsAppVerificationStatus,
  registerCustomerPasskey,
  requestEmailCode,
  signInWithPhonePassword,
  signInWithStaffPhonePassword,
  resetUserPasswordByManager,
  signOut,
  upgradeCustomerSecurity,
  verifyEmailCode,
  whatsappVerificationLink,
  type WhatsAppChallenge,
} from "./services/auth";
import { matchesCustomerSearch } from "./customer-search";
import {
  applyCustomerAccountAction,
  customerAccountReasons,
  type CustomerAccountAction,
  type CustomerAccountReason,
} from "./customer-account-actions";
import {
  generateStaffAccessCode,
  staffAccessMessage,
  staffAccessWhatsAppUrl,
  type StaffAccessCode,
} from "./staff-access-code";
import ProductionRollbackPanel from "./ProductionRollbackPanel";
import {
  currentConsent,
  isCustomerOnboardingComplete,
  isRealCustomerName,
  type ConsentEvent,
} from "./customer-onboarding";
import { updateCustomerName } from "./customer-profile-admin";
import "./access-app.css";
import "./operation-dashboard.css";
import "./referral.css";

const OperationContentAdmin = lazy(() => import("./OperationContentAdmin"));
const OperationCommercialAdmin = lazy(() => import("./OperationCommercialAdmin"));
const OperationArchive = lazy(() => import("./OperationArchive"));
const OperationDashboard = lazy(() => import("./OperationDashboard"));
const OperationNotificationCenter = lazy(() => import("./OperationNotificationCenter"));
const OperationNotificationPreview = lazy(() =>
  import("./OperationNotificationCenter").then((module) => ({
    default: module.OperationNotificationPreview,
  })),
);
const DirectorPlanChecklist = lazy(() => import("./DirectorPlanChecklist"));
const metaWhatsAppEnabled =
  import.meta.env.VITE_META_WHATSAPP_ENABLED === "true";
const passkeysEnabled = import.meta.env.VITE_ENABLE_PASSKEYS === "true";
const passwordRecoveryStorageKey = "adoce-password-recovery";
const clubOrderInviteDraftKey = "adoce-club-order-invite";

function readClubOrderInviteDraft() {
  try {
    const raw = sessionStorage.getItem(clubOrderInviteDraftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { name?: string; phone?: string };
    return { name: parsed.name?.trim() || "", phone: parsed.phone?.trim() || "" };
  } catch {
    return null;
  }
}

type Surface = "client" | "operation";
type AuthStage = "identify" | "code" | "whatsapp";
type ClubView = "card" | "qr" | "share" | "group" | "help" | "install" | "profile";
type OperationView = "dashboard" | "attend" | "movements" | "orders" | "catalog" | "archive" | "team" | "content" | "director-plan" | "security";
type OperationCommercialTab = "agenda" | "sales" | "requests" | "pede_junto" | "catalog" | "crm" | "feedback" | "finance" | "settings";
type OperationContentTab =
  | "catalog"
  | "today"
  | "operation"
  | "promotions"
  | "notifications";
type MemberCounts = { total: number; active: number; deactivated: number; pending: number };

type NotificationPreferences = {
  flavors: boolean;
  festival: boolean;
  promotions: boolean;
  club_news: boolean;
  rewards: boolean;
  birthday: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  flavors: true,
  festival: true,
  promotions: true,
  club_news: true,
  rewards: true,
  birthday: false,
  email_enabled: true,
  push_enabled: false,
  whatsapp_enabled: false,
};

function NotificationPreferencesFields({
  value,
  onChange,
  compact = false,
}: {
  value: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
  compact?: boolean;
}) {
  const topics: Array<[keyof NotificationPreferences, string]> = [
    ["flavors", "Sabores disponíveis no dia"],
    ["festival", "Festivais e horários especiais"],
    ["promotions", "Promoções e Pede Junto Adoce"],
    ["club_news", "Novidades do Clube Adoce"],
    ["rewards", "Fatia grátis, carimbos e indicações"],
    ["birthday", "Mimos e ações de aniversário"],
  ];
  return (
    <div className={`notification-preferences ${compact ? "compact" : ""}`}>
      <strong>O que você gostaria de receber?</strong>
      <div className="notification-topics">
        {topics.map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={Boolean(value[key])}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.checked })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <strong>Como prefere receber?</strong>
      <div className="notification-channels">
        <label>
          <input
            type="checkbox"
            checked={value.email_enabled}
            onChange={(event) =>
              onChange({ ...value, email_enabled: event.target.checked })
            }
          />
          <span>E-mail</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.push_enabled}
            onChange={(event) =>
              onChange({ ...value, push_enabled: event.target.checked })
            }
          />
          <span>Notificação no celular</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.whatsapp_enabled}
            onChange={(event) =>
              onChange({ ...value, whatsapp_enabled: event.target.checked })
            }
          />
          <span>WhatsApp</span>
        </label>
      </div>
      <small>
        Você pode mudar estas escolhas quando quiser. Avisos essenciais sobre
        sua conta continuam separados de publicidade.
      </small>
    </div>
  );
}

type CustomerSnapshot = {
  profile_id: string;
  account_id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  member_code: string;
  account_status: string;
  current_progress: number;
  completed_cards: number;
  available_rewards: number;
  available_reward_id: string | null;
};

type CustomerSearchResult = Pick<
  CustomerSnapshot,
  "profile_id" | "full_name" | "phone_e164" | "email" | "member_code" | "account_status"
>;

type ClubSnapshot = {
  name: string;
  memberCode: string;
  progress: number;
  completed: number;
  rewards: number;
  referralProgress: number;
  referralRewards: number;
  referralCode: string;
  pendingReferrals: number;
  acceptedInvites: ReferralInvite[];
};

type ReferralInvite = {
  first_name: string;
  status: "pending" | "confirmed" | "reversed" | "rejected";
  created_at: string;
};

type ReferralOverview = {
  pending_count: number;
  confirmed_count: number;
  accepted: ReferralInvite[];
};

type GroupOverview = {
  account_id?: string;
  kind?: "individual" | "group";
  name?: string;
  is_owner?: boolean;
  members?: Array<{
    profile_id: string;
    full_name: string;
    member_code: string;
    role: "owner" | "member";
    joined_at: string;
  }>;
};

const referralStorageKey = "adoce-referral-invite";
const referralCodeFromUrl = () =>
  new URLSearchParams(location.search).get("indicacao")?.trim().toUpperCase() ||
  "";

function rememberReferralInvite() {
  const code = referralCodeFromUrl();
  if (code) sessionStorage.setItem(referralStorageKey, code);
  return code || sessionStorage.getItem(referralStorageKey) || "";
}

async function acceptRememberedReferral() {
  const code = rememberReferralInvite();
  if (!code) return false;
  const { error } = await requireSupabase().rpc("accept_referral_invite", {
    invite_code: code,
  });
  if (error) throw error;
  sessionStorage.removeItem(referralStorageKey);
  return true;
}

type Movement = {
  id: string;
  reason: string;
  stamps_delta: number;
  created_at: string;
  subject_profile_id: string | null;
  customer_first_name?: string;
};

type StaffMember = {
  user_id: string;
  role: string;
  active: boolean;
  must_change_password?: boolean;
  display_name?: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallPlatform = "ios" | "android" | "desktop";

function detectInstallContext() {
  const userAgent = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(userAgent);
  const iosSafari =
    ios &&
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return {
    platform: ios ? "ios" : android ? "android" : "desktop",
    iosSafari,
    standalone,
  } as const;
}

function useInstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [context, setContext] = useState<{
    platform: InstallPlatform;
    iosSafari: boolean;
    standalone: boolean;
  }>(() => detectInstallContext());
  useEffect(() => {
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const rememberInstallation = () =>
      setContext((current) => ({ ...current, standalone: true }));
    window.addEventListener("beforeinstallprompt", rememberPrompt);
    window.addEventListener("appinstalled", rememberInstallation);
    return () => {
      window.removeEventListener("beforeinstallprompt", rememberPrompt);
      window.removeEventListener("appinstalled", rememberInstallation);
    };
  }, []);
  const install = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
    return choice.outcome === "accepted";
  }, [promptEvent]);
  return {
    canInstall: Boolean(promptEvent),
    install,
    platform: context.platform,
    iosSafari: context.iosSafari,
    isInstalled: context.standalone,
  };
}

function InstallGuide({
  onClose,
  onInstall,
  canInstall,
  platform,
  iosSafari,
  isInstalled,
  appName,
}: {
  onClose?: () => void;
  onInstall: () => Promise<boolean>;
  canInstall: boolean;
  platform: InstallPlatform;
  iosSafari: boolean;
  isInstalled: boolean;
  appName: string;
}) {
  const [addressCopied, setAddressCopied] = useState(false);
  const copyAddressForSafari = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAddressCopied(true);
    } catch {
      setAddressCopied(false);
    }
  }, []);

  return (
    <div className="install-guide">
      <div className="install-guide-head">
        <div>
          <Smartphone />
          <span>
            <strong>Instale {appName}</strong>
            <small>Abra com um toque e use em tela cheia, como um aplicativo.</small>
          </span>
        </div>
        {onClose && (
          <button aria-label="Fechar instruções" onClick={onClose}>
            <X />
          </button>
        )}
      </div>
      {isInstalled ? (
        <div className="install-success">
          <Check /> Este aplicativo já está instalado neste aparelho.
        </div>
      ) : canInstall ? (
        <button className="access-primary" onClick={() => void onInstall()}>
          <Download /> Instalar agora
        </button>
      ) : null}
      <div className="install-platforms">
        {(platform === "android" || platform === "desktop") && (
          <article className={platform === "android" ? "recommended" : ""}>
            <strong>Android · Google Chrome</strong>
            <ol>
              <li>Abra o menu de três pontos.</li>
              <li>Toque em “Instalar app” ou “Adicionar à tela inicial”.</li>
              <li>Confirme em “Instalar”.</li>
            </ol>
          </article>
        )}
        {(platform === "ios" || platform === "desktop") && (
          <article className={platform === "ios" ? "recommended" : ""}>
            <strong>iPhone · Safari</strong>
            <p className="install-ios-note">
              No iPhone, a Apple não abre uma janela automática de instalação.
              O aplicativo é adicionado pelo menu do Safari.
            </p>
            {platform === "ios" && !iosSafari && (
              <div className="install-browser-warning">
                <strong>Você não está usando o Safari.</strong>
                <p>Copie o endereço, abra o Safari, cole na barra e acesse.</p>
                <button type="button" onClick={() => void copyAddressForSafari()}>
                  <Copy /> {addressCopied ? "Endereço copiado" : "Copiar endereço do Clube"}
                </button>
              </div>
            )}
            <ol className="install-ios-steps">
              <li>
                <span><MoreHorizontal /></span>
                <div>
                  <b>Abra o menu do Safari</b>
                  <small>Toque em Mais (…) e depois em Compartilhar. Se o botão de compartilhar já estiver visível, toque diretamente nele.</small>
                </div>
              </li>
              <li>
                <span><Share2 /></span>
                <div>
                  <b>Role a lista de opções</b>
                  <small>Procure e toque em “Adicionar à Tela de Início”.</small>
                </div>
              </li>
              <li>
                <span><SquarePlus /></span>
                <div>
                  <b>Se a opção não aparecer</b>
                  <small>Vá até o fim da lista, toque em “Editar Ações” e adicione “Adicionar à Tela de Início”.</small>
                </div>
              </li>
              <li>
                <span><Check /></span>
                <div>
                  <b>Finalize</b>
                  <small>Ative “Abrir como App da Web”, quando essa opção aparecer, e toque em “Adicionar”.</small>
                </div>
              </li>
            </ol>
            <a
              className="install-apple-help"
              href="https://support.apple.com/pt-br/guide/iphone/iph42ab2f3a7/ios"
              target="_blank"
              rel="noreferrer"
            >
              Ver instrução oficial da Apple <ArrowRight />
            </a>
          </article>
        )}
      </div>
      <small>
        Clube Adoce e Adoce Operação têm ícones próprios e podem ser instalados separadamente.
      </small>
    </div>
  );
}

function Brand({ label }: { label: string }) {
  const homeHref = label === "Adoce Operação" ? "/#operacao" : "/";
  return (
    <a className="access-brand" href={homeHref}>
      <img src="/site/logo.webp" alt="Adoce Brigaderia" />
      <span>
        <strong>{label}</strong>
        <small>Adoce Brigaderia</small>
      </span>
    </a>
  );
}

const groupStorageKey = "adoce-group-invite";
function rememberGroupInvite() {
  const token = new URLSearchParams(location.search).get("grupo")?.trim() || "";
  if (token) sessionStorage.setItem(groupStorageKey, token);
  return token || sessionStorage.getItem(groupStorageKey) || "";
}

function MemberLoyaltyCard({ snapshot }: { snapshot: ClubSnapshot }) {
  const stamps = Array.from({ length: 14 }, (_, index) => index < snapshot.progress);
  return (
    <article className="club-card-main">
      <div className="club-card-head">
        <div><small>CLUBE ADOCE</small><h2>Cartão do Membro</h2></div>
        <img src="/site/logo.webp" alt="" />
      </div>
      <div className="club-member-identity">
        <span>Código do Membro</span><strong>{snapshot.memberCode}</strong><small>{snapshot.name}</small>
      </div>
      <div className="club-stamp-title">
        <h3>Meus Carimbos</h3><strong>{snapshot.progress} de 14 carimbos</strong>
      </div>
      <div className="club-stamps">
        {stamps.map((filled, index) => <span className={filled ? "filled" : ""} key={index}><Heart /></span>)}
      </div>
      {snapshot.rewards > 0 ? (
        <div className="club-reward-ready"><Gift /><span><strong>Fatia grátis disponível</strong><small>Minha Fatia Grátis já pode ser resgatada.</small></span></div>
      ) : (
        <p>Você já possui {snapshot.progress} de 14 carimbos. Faltam apenas {14 - snapshot.progress} fatias para ganhar sua próxima fatia grátis.</p>
      )}
      <div className="club-card-foot">
        <span><History /> {snapshot.completed} cartões preenchidos</span>
        <span><Gift /> {snapshot.rewards} fatia(s) grátis disponível(is)</span>
      </div>
    </article>
  );
}

export function MemberDemo() {
  const snapshot: ClubSnapshot = {
    name: "Rubens Bezerra",
    memberCode: "ADOC 2026 0000 0123",
    progress: 8,
    completed: 0,
    rewards: 0,
    referralProgress: 2,
    referralRewards: 0,
    referralCode: "ADOCE-DEMO",
    pendingReferrals: 0,
    acceptedInvites: [],
  };
  return (
    <main className="club-home">
      <header>
        <Brand label="Clube Adoce" />
        <div className="club-header-actions">
          <a href="/#adoce-hoje"><CakeSlice /> Adoce Hoje</a>
          <a href="/#entrar"><LogOut /> Entrar no Clube</a>
        </div>
      </header>
      <section className="club-welcome">
        <div>
          <span>Área do Membro · Prévia local</span>
          <h1>Olá, Rubens!</h1>
          <p>Você já possui 8 de 14 carimbos. Faltam apenas 6 fatias para ganhar sua próxima fatia grátis.</p>
        </div>
        <div className="club-mini-stat"><Gift /><strong>0</strong><span>fatias grátis disponíveis</span></div>
      </section>
      <section className="club-grid">
        <MemberLoyaltyCard snapshot={snapshot} />
        <aside className="club-side">
          <article><QrCode /><small>QR Code do Membro</small><h3>Código do Membro</h3><p>{snapshot.memberCode}</p></article>
          <article><CircleHelp /><h3>Como funciona</h3><p>A cada fatia comprada, você recebe um carimbo no seu Cartão Clube Adoce. Complete 14 carimbos e ganhe uma fatia grátis. O cartão é pessoal e está vinculado ao cadastro do membro.</p></article>
        </aside>
      </section>
    </main>
  );
}

export function OperationDemo() {
  const [demoView, setDemoView] = useState<"dashboard" | "attend" | "products">(
    "dashboard",
  );
  const demoMembers = [
    { name: "Ana Clara", contact: "(85) 9••••-1024", code: "ADOC 2026 0000 0002" },
    { name: "Bruna Lima", contact: "bruna@exemplo.com", code: "ADOC 2026 0000 0007" },
    { name: "Carlos Eduardo", contact: "(85) 9••••-7731", code: "ADOC 2026 0000 0011" },
  ];
  return (
    <main className="operation-home">
      <header>
        <Brand label="Adoce Operação" />
        <div>
          <span>Proprietário · Prévia local</span>
          <Suspense fallback={null}>
            <OperationNotificationPreview initialOpen={location.hash.includes("alertas")} />
          </Suspense>
          <a href="/#adoce-hoje"><CakeSlice /> Adoce Hoje</a>
        </div>
      </header>
      <div className="operation-shell">
        <aside>
          <small className="operation-nav-group">Visão geral</small>
          <button className={demoView === "dashboard" ? "active" : ""} onClick={() => setDemoView("dashboard")}><LayoutDashboard /> Início da operação</button>
          <small className="operation-nav-group">Clientes e fidelidade</small>
          <button
            className={demoView === "attend" ? "active" : ""}
            onClick={() => setDemoView("attend")}
          >
            <Search /> Clientes & Clube
          </button>
          <button
            className={demoView === "products" ? "active" : ""}
            onClick={() => setDemoView("products")}
          >
            <Settings2 /> Produtos e disponibilidade
          </button>
        </aside>
        <section className="operation-work">
          {demoView === "dashboard" && (
            <section className="operation-dashboard">
              <header className="operation-dashboard-heading"><div><span>Visão do dia</span><h1>Central da operação</h1><p>Comece pelo que precisa de atenção e chegue a cada tarefa sem procurar em vários menus.</p></div><button><RotateCcw /> Atualizar</button></header>
              <div className="operation-dashboard-priority"><div><CircleHelp /><span><small>Precisa de atenção</small><strong>3</strong></span></div><p>Confira pagamentos, retiradas e itens com poucas unidades.</p></div>
              <div className="operation-dashboard-metrics">
                <button><ShoppingCart /><span><strong>4</strong><small>vendas em andamento</small></span><ArrowRight /></button>
                <button><CircleDollarSign /><span><strong>2</strong><small>aguardando pagamento</small></span><ArrowRight /></button>
                <button><CakeSlice /><span><strong>1</strong><small>pronta para retirada</small></span><ArrowRight /></button>
                <button><CalendarDays /><span><strong>3</strong><small>encomendas ativas</small></span><ArrowRight /></button>
                <button><Users /><span><strong>128</strong><small>clientes cadastrados</small></span><ArrowRight /></button>
                <button><CircleHelp /><span><strong>0</strong><small>itens com estoque baixo</small></span><ArrowRight /></button>
              </div>
            </section>
          )}
          {demoView === "attend" && (
            <>
              <div className="operation-title">
                <div>
                  <span>Clientes e fidelidade</span>
                  <h1>Clientes & Clube Adoce</h1>
                  <p>
                    Localize um cliente, leia o QR do cartão ou consulte a lista completa em um só lugar.
                  </p>
                </div>
                <div className="operation-role"><Check /> Acesso verificado</div>
              </div>
              <div className="operation-search-row">
                <div className="operation-search">
                  <Search />
                  <input placeholder="Nome, telefone ou código" />
                  <button>Buscar</button>
                </div>
                <button className="operation-scan-button"><Camera /> Ler QR do membro</button>
              </div>
              <div className="operation-results">
                {demoMembers.map((member) => (
                  <button key={member.code}>
                    <span className="avatar">{member.name[0]}</span>
                    <span><strong>{member.name}</strong><small>{member.contact}</small></span>
                    <span><small>{member.code}</small></span>
                    <ArrowRight />
                  </button>
                ))}
              </div>
            </>
          )}
          {demoView === "products" && (
            <>
              <div className="operation-title">
                <div>
                  <span>Administrar Adoce</span>
                  <h1>Cadastro de produtos</h1>
                  <p>
                    Fatia e torta inteira G têm fotos e valores próprios. Nada
                    é publicado com preço de reserva.
                  </p>
                </div>
              </div>
              <div className="operation-actions operation-product-demo">
                <article>
                  <CakeSlice />
                  <h3>Dados da fatia</h3>
                  <label>Nome do produto<input value="Trufado de morango" readOnly /></label>
                  <label>Preço da fatia<input value="R$ 16,00" readOnly /></label>
                  <button className="access-secondary"><ImagePlus /> Foto da fatia</button>
                </article>
                <article>
                  <Gift />
                  <h3>Torta inteira G</h3>
                  <label>Preço da torta G<input placeholder="Informe o valor correto" /></label>
                  <button className="access-secondary"><ImagePlus /> Foto da torta inteira G</button>
                  <small>
                    A seção de tortas só aparece ao cliente depois que foto,
                    preço e disponibilidade forem confirmados aqui.
                  </small>
                </article>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function AuthScreen({ surface }: { surface: Surface }) {
  const clubOrderDraft = useMemo(() => readClubOrderInviteDraft(), []);
  const directParams = useMemo(() => {
    if (!location.hash.startsWith("#acesso-direto?")) return null;
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const directEmail = params.get("email")?.trim() || "";
    const directCode = params.get("code")?.replace(/\D/g, "").slice(0, 6) || "";
    return directEmail && directCode.length === 6
      ? { email: directEmail, code: directCode }
      : null;
  }, []);
  const directAttempted = useRef(false);
  const [stage, setStage] = useState<AuthStage>(directParams ? "code" : "identify");
  const registrationRoute = location.hash.startsWith("#cadastro");
  const [registering, setRegistering] = useState(
    () =>
      registrationRoute ||
      Boolean(rememberReferralInvite()) ||
      Boolean(rememberGroupInvite()),
  );
  const invited =
    surface === "client" &&
    Boolean(rememberReferralInvite() || rememberGroupInvite());
  const [name, setName] = useState(clubOrderDraft?.name || "");
  const [email, setEmail] = useState(directParams?.email || "");
  const [phone, setPhone] = useState(clubOrderDraft?.phone || "");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(true);
  const [loginMode, setLoginMode] = useState<"password" | "email">(
    "password",
  );
  const [code, setCode] = useState(directParams?.code || "");
  const [whatsAppChallenge, setWhatsAppChallenge] =
    useState<WhatsAppChallenge | null>(null);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    ...defaultNotificationPreferences,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (surface === "client") {
      setLoginMode("password");
      setRegistering(
        registrationRoute ||
          Boolean(rememberReferralInvite()) ||
          Boolean(rememberGroupInvite()),
      );
      setStage("identify");
      setMessage("");
    } else {
      setLoginMode("password");
      setRegistering(false);
      setStage("identify");
      setMessage("");
    }
  }, [registrationRoute, surface]);

  useEffect(() => {
    if (surface !== "client" || !directParams || directAttempted.current) return;
    directAttempted.current = true;
    sessionStorage.setItem(passwordRecoveryStorageKey, "true");
    setBusy(true);
    setMessage("Validando o acesso seguro gerado pela Adoce...");
    void verifyEmailCode(directParams.email, directParams.code)
      .then(() => {
        location.hash = "minha-conta";
      })
      .catch((error) => {
        setStage("code");
        const technicalMessage = error instanceof Error ? error.message : "";
        const safeMessage = /fetch|network|expired|invalid|token/i.test(
          technicalMessage,
        )
          ? "O link não pôde ser validado automaticamente."
          : technicalMessage || "O link não pôde ser validado.";
        setMessage(
          `${safeMessage} Você ainda pode conferir ou digitar outro código abaixo.`,
        );
      })
      .finally(() => setBusy(false));
  }, [directParams, surface]);

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (registering && (!name.trim() || phone.replace(/\D/g, "").length < 10 || !terms || !privacy)) {
      setMessage(
        "Informe seu nome e WhatsApp com DDD, e aceite os termos e a política de privacidade.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await requestEmailCode(
        email,
        registering ? name : undefined,
        registering,
      );
      if (surface === "client" && !registering) {
        sessionStorage.setItem(passwordRecoveryStorageKey, "true");
      }
      setStage("code");
      setMessage("Código enviado. Ele vale por 10 minutos.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o código.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (surface === "operation") {
        await signInWithStaffPhonePassword(phone, password, rememberLogin);
        location.hash = "operacao";
      } else {
        await signInWithPhonePassword(phone, password, rememberLogin);
        location.hash = "minha-conta";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar agora.");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (registering && !isRealCustomerName(name)) {
      setMessage("Informe seu nome e sobrenome para concluir o cadastro.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await verifyEmailCode(email, code);
      if (registering && result.user) {
        const supabase = requireSupabase();
        const cleanName = name.trim();
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { full_name: cleanName },
        });
        if (metadataError) throw metadataError;
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: cleanName })
          .eq("id", result.user.id);
        if (profileError) throw profileError;
        const { error: consentError } = await supabase
          .from("consent_events")
          .insert([
            {
              profile_id: result.user.id,
              consent_type: "club_terms",
              granted: true,
              document_version: "1.0",
              source: "web",
            },
            {
              profile_id: result.user.id,
              consent_type: "privacy",
              granted: true,
              document_version: "1.0",
              source: "web",
            },
            {
              profile_id: result.user.id,
              consent_type: "marketing",
              granted: marketing,
              document_version: "1.0",
              source: "web",
            },
          ]);
        if (consentError) throw consentError;
        const { error: preferenceError } = await supabase
          .from("notification_preferences")
          .upsert({
            profile_id: result.user.id,
            ...notificationPreferences,
            flavors: marketing && notificationPreferences.flavors,
            festival: marketing && notificationPreferences.festival,
            promotions: marketing && notificationPreferences.promotions,
            club_news: marketing && notificationPreferences.club_news,
            rewards: marketing && notificationPreferences.rewards,
            birthday: marketing && notificationPreferences.birthday,
            email_enabled: marketing && notificationPreferences.email_enabled,
            push_enabled: marketing && notificationPreferences.push_enabled,
            whatsapp_enabled:
              marketing && notificationPreferences.whatsapp_enabled,
          });
        if (preferenceError) throw preferenceError;
        if (metaWhatsAppEnabled) {
          const challenge = await beginWhatsAppVerification(phone);
          setWhatsAppChallenge(challenge);
          setStage("whatsapp");
          setMessage(
            "Envie a mensagem pronta pelo WhatsApp e volte para confirmar.",
          );
          return;
        }
        await acceptRememberedReferral();
        sessionStorage.removeItem(clubOrderInviteDraftKey);
        window.dispatchEvent(new Event("adoce-profile-ready"));
        location.hash = "minha-conta";
        return;
      }
      location.hash = surface === "operation" ? "operacao" : "minha-conta";
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Código inválido ou expirado.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmWhatsApp = async () => {
    setBusy(true);
    setMessage("");
    try {
      const status = await getWhatsAppVerificationStatus();
      if (!status.verified) {
        setMessage(
          "Ainda não recebemos a confirmação. Envie a mensagem pelo WhatsApp e tente novamente em alguns segundos.",
        );
        return;
      }
      await acceptRememberedReferral();
      sessionStorage.removeItem(clubOrderInviteDraftKey);
      window.dispatchEvent(new Event("adoce-profile-ready"));
      location.hash = "minha-conta";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar seu WhatsApp.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`access-page ${surface}`}>
      <header>
        <Brand
          label={surface === "operation" ? "Adoce Operação" : "Clube Adoce"}
        />
        {surface === "operation" && <a href="/#entrar">Sou membro</a>}
      </header>
      <section className="access-auth-shell">
        <div className="access-auth-copy">
          <span>
            {surface === "operation"
              ? "Operação segura"
              : invited
                ? "Você recebeu um convite"
                : "Faça parte do Clube Adoce"}
          </span>
          <h1>
            {surface === "operation"
                ? "Cuidar de cada membro ficou mais simples."
              : invited
                ? "Você já começa mais perto da sua fatia premiada."
                : "A cada fatia comprada, você recebe um carimbo."}
          </h1>
          <p>
            {surface === "operation"
              ? "Acesse para localizar membros, registrar compras e resgatar benefícios com histórico completo."
              : invited
                ? "Aceite o convite, faça parte do Clube e ganhe 1 carimbo extra quando fizer sua primeira compra."
                : "Complete 14 carimbos e ganhe uma fatia grátis."}
          </p>
          <div className="access-promise">
            <Heart />
            <strong>1 fatia = 1 carimbo</strong>
            <small>Tradicional ou premium</small>
          </div>
        </div>
        <div className="access-auth-card">
          <img src="/site/logo.webp" alt="" />
          <h2>
            {stage === "code"
              ? directParams ? "Acesso direto ao Clube" : "Confira seu e-mail"
              : stage === "whatsapp"
                ? "Confirme seu WhatsApp"
              : invited
                ? "Aceitar convite e reservar meu carimbo"
                : registering
                  ? "Quero fazer parte"
                  : loginMode === "password"
                    ? surface === "operation" ? "Entrar com senha" : "Entrar com celular"
                    : surface === "operation"
                      ? "Entrar na operação"
                      : "Entrar no Clube"}
          </h2>
          <p>
            {stage === "code"
              ? directParams
                ? `Estamos validando o código seguro gerado para ${email}.`
                : `Digite o código de 6 números enviado para ${email}.`
              : stage === "whatsapp"
                ? "Esta confirmação impede cadastros duplicados e protege os benefícios do Clube."
              : loginMode === "password" && !registering
                ? surface === "operation"
                  ? "Use seu celular com DDD e a senha da operação."
                  : "Use seu celular com DDD e a senha criada no primeiro acesso."
                : surface === "operation"
                  ? "Rubens ou Beth podem redefinir a senha da equipe quando necessário."
                  : "O código por e-mail será usado no primeiro acesso ou na recuperação da conta."}
          </p>
          {stage === "identify" ? (
            !registering && loginMode === "password" ? (
              <form onSubmit={submitPassword}>
                <label>
                  Celular com DDD
                  <div className="input-icon">
                    <Smartphone />
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      inputMode="tel"
                      type="tel"
                      autoComplete="username"
                      placeholder="(85) 99999-9999"
                      required
                    />
                  </div>
                </label>
                <label>
                  Sua senha
                  <div className="input-icon">
                    <KeyRound />
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </label>
                <label className="access-remember-login">
                  <input
                    type="checkbox"
                    checked={rememberLogin}
                    onChange={(event) => setRememberLogin(event.target.checked)}
                  />
                  <span>Continuar conectado neste aparelho</span>
                </label>
                <button className="access-primary" disabled={busy}>
                  {busy ? "Entrando..." : surface === "operation" ? "Entrar na operação" : "Entrar no Clube"}
                  <ArrowRight />
                </button>
                {surface === "client" && (
                  <button
                    className="access-link"
                    type="button"
                    onClick={() => {
                      setLoginMode("email");
                      setMessage("");
                    }}
                  >
                    Primeiro acesso, criar senha ou recuperar conta
                  </button>
                )}
              </form>
            ) : (
            <form onSubmit={submitEmail}>
              {registering && (
                <label>
                  Como podemos chamar você?
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Seu nome completo"
                  />
                </label>
              )}
              <label>
                Seu e-mail
                <div className="input-icon">
                  <Mail />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    required
                  />
                </div>
              </label>
              {registering && (
                <label>
                  Seu WhatsApp com DDD
                  <div className="input-icon">
                    <Smartphone />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(85) 99999-9999"
                      required
                    />
                  </div>
                </label>
              )}
              {registering && (
                <div className="access-consents">
                  <label>
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                    />
                    <span>Aceito os <a href="/#termos" target="_blank" rel="noreferrer">Termos do Clube Adoce</a>.</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={privacy}
                      onChange={(e) => setPrivacy(e.target.checked)}
                    />
                    <span>Li e aceito a <a href="/#privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                    />
                    <span>
                      Quero receber sabores e novidades. <em>Opcional</em>
                    </span>
                  </label>
                  {marketing && (
                    <NotificationPreferencesFields
                      compact
                      value={notificationPreferences}
                      onChange={setNotificationPreferences}
                    />
                  )}
                </div>
              )}
              <button className="access-primary" disabled={busy}>
                {busy
                  ? "Enviando..."
                  : registering
                    ? "Validar meu primeiro acesso"
                    : surface === "operation"
                      ? "Receber código de acesso"
                      : "Receber código de segurança"}
                <ArrowRight />
              </button>
            </form>
            )
          ) : stage === "code" ? (
            <form onSubmit={submitCode}>
              <label>
                Código de acesso
                <input
                  className="access-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </label>
              <button
                className="access-primary"
                disabled={busy || code.length !== 6}
              >
                {busy ? "Confirmando..." : surface === "operation" ? "Entrar na operação" : "Entrar no Clube"}
                <ArrowRight />
              </button>
              <button
                className="access-link"
                type="button"
                onClick={() => {
                  setStage("identify");
                  setCode("");
                  setMessage("");
                }}
              >
                Usar outro e-mail
              </button>
            </form>
          ) : (
            <div className="access-whatsapp-confirmation">
              {whatsAppChallenge && (
                <a
                  className="access-primary"
                  href={whatsappVerificationLink(whatsAppChallenge)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Confirmar meu WhatsApp <ArrowRight />
                </a>
              )}
              <button
                className="access-primary"
                type="button"
                disabled={busy}
                onClick={() => void confirmWhatsApp()}
              >
                {busy ? "Verificando..." : "Já enviei, verificar agora"}
                <Check />
              </button>
              <button
                className="access-link"
                type="button"
                onClick={() => {
                  setStage("identify");
                  setWhatsAppChallenge(null);
                  setMessage("");
                }}
              >
                Corrigir meus dados
              </button>
            </div>
          )}
          {message && (
            <div className="access-message" role="status">
              {message}
            </div>
          )}
          {stage === "identify" && (
            <button
              className="access-switch"
              type="button"
              onClick={() => {
                if (surface === "operation") {
                  setLoginMode(loginMode === "password" ? "email" : "password");
                } else if (!registering && loginMode === "email") {
                  setLoginMode("password");
                } else {
                  setRegistering(!registering);
                  setLoginMode("email");
                }
                setMessage("");
              }}
            >
              {surface === "operation"
                ? loginMode === "email"
                  ? "Entrar com e-mail e senha"
                  : "Entrar com código enviado por e-mail"
                : registering
                ? "Entrar no Clube"
                : loginMode === "email"
                  ? "Entrar com celular e senha"
                  : "Quero fazer parte"}
            </button>
          )}
          <small className="access-privacy">
            <ShieldCheck /> Seus dados são protegidos e usados conforme suas
            escolhas.
          </small>
          {surface === "client" && <a className="access-feedback-link" href="/#fale-com-a-adoce">Encontrou um problema? Envie uma reclamação ou sugestão</a>}
        </div>
      </section>
    </main>
  );
}

function CustomerHome({ session }: { session: Session }) {
  const [snapshot, setSnapshot] = useState<ClubSnapshot | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState<boolean | null>(
    null,
  );
  const [error, setError] = useState("");
  const [view, setView] = useState<ClubView>("card");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileWhatsAppVerified, setProfileWhatsAppVerified] = useState(false);
  const [securityUpgradeRequired, setSecurityUpgradeRequired] = useState<boolean | null>(null);
  const [forcedPasswordChange, setForcedPasswordChange] = useState(false);
  const [passwordRecoveryRequested, setPasswordRecoveryRequested] = useState(
    () => sessionStorage.getItem(passwordRecoveryStorageKey) === "true",
  );
  const [accountStatus, setAccountStatus] = useState("active");
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityPasswordConfirm, setSecurityPasswordConfirm] = useState("");
  const [profileWhatsAppChallenge, setProfileWhatsAppChallenge] =
    useState<WhatsAppChallenge | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    ...defaultNotificationPreferences,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState("");
  const [group, setGroup] = useState<GroupOverview>({});
  const [groupName, setGroupName] = useState("");
  const [groupInvite, setGroupInvite] = useState(
    () => rememberGroupInvite(),
  );
  const [groupShareUrl, setGroupShareUrl] = useState("");
  const installApp = useInstallApp();
  const loadSnapshot = useCallback(async () => {
    const supabase = requireSupabase();
    setError("");
    const [
      { data: profile, error: profileError },
      { data: consentRows, error: consentError },
      { data: savedPreferences, error: preferencesError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,member_code,phone_e164,whatsapp_verified_at,auth_upgraded_at,account_status,must_change_password")
        .eq("id", session.user.id)
        .single(),
      supabase
        .from("consent_events")
        .select("consent_type,granted,created_at")
        .eq("profile_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("notification_preferences")
        .select(
          "flavors,festival,promotions,club_news,rewards,birthday,email_enabled,push_enabled,whatsapp_enabled",
        )
        .eq("profile_id", session.user.id)
        .maybeSingle(),
    ]);
    if (profileError || consentError || preferencesError)
      throw profileError || consentError || preferencesError;

    const consents = (consentRows || []) as ConsentEvent[];
    const metadataName =
      typeof session.user.user_metadata?.full_name === "string"
        ? session.user.user_metadata.full_name.trim()
        : "";
    const databaseName = profile?.full_name?.trim() || "";
    setProfilePhone(profile?.phone_e164 || "");
    setProfileWhatsAppVerified(Boolean(profile?.whatsapp_verified_at));
    setSecurityUpgradeRequired(!profile?.auth_upgraded_at);
    setForcedPasswordChange(Boolean(profile?.must_change_password));
    setAccountStatus(profile?.account_status || "active");
    const nameForForm =
      databaseName && databaseName !== "Cliente Adoce"
        ? databaseName
        : metadataName;
    setProfileName(nameForForm);
    setTermsAccepted(currentConsent(consents, "club_terms"));
    setPrivacyAccepted(currentConsent(consents, "privacy"));
    const marketingAllowed = currentConsent(consents, "marketing");
    setMarketingAccepted(marketingAllowed);
    if (savedPreferences)
      setNotificationPreferences(
        savedPreferences as NotificationPreferences,
      );
    else if (!marketingAllowed)
      setNotificationPreferences({
        ...defaultNotificationPreferences,
        flavors: false,
        festival: false,
        promotions: false,
        club_news: false,
        rewards: false,
        birthday: false,
        email_enabled: false,
      });

    if (!isCustomerOnboardingComplete(databaseName, consents)) {
      setSnapshot(null);
      setOnboardingRequired(true);
      return;
    }

    setOnboardingRequired(false);
    if (metaWhatsAppEnabled && rememberGroupInvite()) {
      setGroupInvite(rememberGroupInvite());
      setView("group");
      const { data: groupData } = await supabase.rpc("customer_group_overview");
      setGroup((groupData || {}) as GroupOverview);
      setMessage(
        "Seu convite de cartão em grupo está pronto. Confirme abaixo para entrar.",
      );
    }
    if (rememberReferralInvite()) {
      try {
        await acceptRememberedReferral();
        setMessage(
          "Convite aceito. Seu carimbo extra está reservado para a primeira compra.",
        );
      } catch (inviteError) {
        setMessage(
          inviteError instanceof Error
            ? inviteError.message
            : "Não foi possível vincular o convite.",
        );
      }
    }
    const [
      { data: memberships, error: membershipError },
      { data: referral, error: referralError },
      { data: overview, error: overviewError },
    ] = await Promise.all([
      supabase
        .from("account_memberships")
        .select("account_id,is_primary")
        .eq("profile_id", session.user.id)
        .eq("active", true),
      supabase
        .from("referral_codes")
        .select("code")
        .eq("profile_id", session.user.id)
        .maybeSingle(),
      supabase.rpc("customer_referral_overview"),
    ]);
    if (membershipError || referralError || overviewError)
      throw membershipError || referralError || overviewError;
    const accountId =
      memberships?.find((m) => m.is_primary)?.account_id ||
      memberships?.[0]?.account_id;
    if (!accountId) {
      setError("Sua conta está sendo preparada. Atualize em alguns instantes.");
      return;
    }
    const [
      { data: tracks, error: tracksError },
      { data: rewards, error: rewardsError },
    ] = await Promise.all([
      supabase
        .from("loyalty_tracks")
        .select("id,kind,current_progress,completed_cards")
        .eq("account_id", accountId),
      supabase
        .from("rewards")
        .select("id,status,track_id")
        .eq("status", "available"),
    ]);
    if (tracksError || rewardsError) throw tracksError || rewardsError;
    const main = tracks?.find((t) => t.kind === "main");
    const ref = tracks?.find((t) => t.kind === "referral");
    const resolvedName = databaseName;
    setProfileName(resolvedName);
    const referralOverview = (overview || {
      pending_count: 0,
      confirmed_count: 0,
      accepted: [],
    }) as ReferralOverview;
    setSnapshot({
      name: resolvedName,
      memberCode: profile?.member_code || "—",
      progress: main?.current_progress || 0,
      completed: main?.completed_cards || 0,
      rewards: rewards?.filter((r) => r.track_id === main?.id).length || 0,
      referralProgress: ref?.current_progress || 0,
      referralRewards:
        rewards?.filter((r) => r.track_id === ref?.id).length || 0,
      referralCode: referral?.code || "—",
      pendingReferrals: Number(referralOverview.pending_count || 0),
      acceptedInvites: referralOverview.accepted || [],
    });
  }, [session.user.id, session.user.user_metadata]);
  useEffect(() => {
    void loadSnapshot().catch((e) =>
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir sua conta.",
      ),
    );
  }, [loadSnapshot]);
  useEffect(() => {
    const reloadCompletedProfile = () => {
      void loadSnapshot().catch((e) =>
        setError(
          e instanceof Error ? e.message : "Não foi possível abrir sua conta.",
        ),
      );
    };
    window.addEventListener("adoce-profile-ready", reloadCompletedProfile);
    return () =>
      window.removeEventListener("adoce-profile-ready", reloadCompletedProfile);
  }, [loadSnapshot]);
  const completeOnboarding = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = profileName.trim();
    if (!isRealCustomerName(cleanName)) {
      setMessage("Informe seu nome e sobrenome para fazer parte do Clube.");
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setMessage(
        "Aceite os termos do Clube e a política de privacidade para continuar.",
      );
      return;
    }

    setBusy(true);
    setMessage("");
    const supabase = requireSupabase();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: cleanName })
      .eq("id", session.user.id);
    if (profileError) {
      setBusy(false);
      setMessage(profileError.message);
      return;
    }
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name: cleanName },
    });
    if (metadataError) {
      setBusy(false);
      setMessage(metadataError.message);
      return;
    }
    const { error: consentError } = await supabase
      .from("consent_events")
      .insert([
        {
          profile_id: session.user.id,
          consent_type: "club_terms",
          granted: true,
          document_version: "1.0",
          source: "web_onboarding",
        },
        {
          profile_id: session.user.id,
          consent_type: "privacy",
          granted: true,
          document_version: "1.0",
          source: "web_onboarding",
        },
        {
          profile_id: session.user.id,
          consent_type: "marketing",
          granted: marketingAccepted,
          document_version: "1.0",
          source: "web_onboarding",
        },
      ]);
    if (consentError) {
      setBusy(false);
      setMessage(consentError.message);
      return;
    }
    const { error: preferenceError } = await supabase
      .from("notification_preferences")
      .upsert({
        profile_id: session.user.id,
        ...notificationPreferences,
        flavors: marketingAccepted && notificationPreferences.flavors,
        festival: marketingAccepted && notificationPreferences.festival,
        promotions: marketingAccepted && notificationPreferences.promotions,
        club_news: marketingAccepted && notificationPreferences.club_news,
        rewards: marketingAccepted && notificationPreferences.rewards,
        birthday: marketingAccepted && notificationPreferences.birthday,
        email_enabled:
          marketingAccepted && notificationPreferences.email_enabled,
        push_enabled:
          marketingAccepted && notificationPreferences.push_enabled,
        whatsapp_enabled:
          marketingAccepted && notificationPreferences.whatsapp_enabled,
      });
    if (preferenceError) {
      setBusy(false);
      setMessage(preferenceError.message);
      return;
    }

    setOnboardingRequired(null);
    try {
      await loadSnapshot();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível abrir sua conta.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = profileName.trim();
    if (!cleanName) return;
    setBusy(true);
    setMessage("");
    const supabase = requireSupabase();
    const [
      { error: profileError },
      { error: metadataError },
      { error: preferenceError },
      { error: consentError },
    ] =
      await Promise.all([
        supabase
          .from("profiles")
          .update({ full_name: cleanName })
          .eq("id", session.user.id),
        supabase.auth.updateUser({ data: { full_name: cleanName } }),
        supabase.from("notification_preferences").upsert({
          profile_id: session.user.id,
          ...notificationPreferences,
        }),
        supabase.from("consent_events").insert({
          profile_id: session.user.id,
          consent_type: "marketing",
          granted:
            [
              notificationPreferences.flavors,
              notificationPreferences.festival,
              notificationPreferences.promotions,
              notificationPreferences.club_news,
              notificationPreferences.rewards,
              notificationPreferences.birthday,
            ].some(Boolean) &&
            [
              notificationPreferences.email_enabled,
              notificationPreferences.push_enabled,
              notificationPreferences.whatsapp_enabled,
            ].some(Boolean),
          document_version: "1.0",
          source: "web_profile",
        }),
      ]);
    setBusy(false);
    if (profileError || metadataError || preferenceError || consentError) {
      setMessage(
        profileError?.message ||
          metadataError?.message ||
          preferenceError?.message ||
          consentError?.message ||
          "Não foi possível salvar seu nome.",
      );
      return;
    }
    setMessage("Perfil atualizado com sucesso.");
    await loadSnapshot();
  };
  const shareClub = async () => {
    const code = snapshot?.referralCode || "";
    const url = `${location.origin}/?indicacao=${encodeURIComponent(code)}#cadastro`;
    const text =
      "Oi! Vem para o Clube Adoce comigo 🍰💗 Cadastre-se pelo meu link e, na sua primeira compra, você ganha 1 carimbo extra. Eu também ganho quando você experimentar!";
    if (navigator.share)
      await navigator.share({ title: "Convite para o Clube Adoce", text, url });
    else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setMessage("Convite com seu link pessoal copiado. Agora é só enviar.");
    }
  };
  const startProfileWhatsAppVerification = async () => {
    setBusy(true);
    setMessage("");
    try {
      const challenge = await beginWhatsAppVerification(profilePhone);
      setProfileWhatsAppChallenge(challenge);
      setMessage("Abra o WhatsApp e envie a mensagem pronta para confirmar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a confirmação.");
    } finally {
      setBusy(false);
    }
  };
  const confirmProfileWhatsApp = async () => {
    setBusy(true);
    try {
      const status = await getWhatsAppVerificationStatus();
      if (!status.verified) return setMessage("A confirmação ainda não chegou. Tente novamente em alguns segundos.");
      setProfileWhatsAppVerified(true);
      setProfileWhatsAppChallenge(null);
      setMessage("WhatsApp confirmado com segurança.");
      await loadSnapshot();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o WhatsApp.");
    } finally {
      setBusy(false);
    }
  };
  const completeSecurityUpgrade = async (event: React.FormEvent) => {
    event.preventDefault();
    if (securityPassword !== securityPasswordConfirm) {
      setMessage("As duas senhas precisam ser iguais.");
      return;
    }
    if (
      securityPassword.length < 10 ||
      !/[a-z]/.test(securityPassword) ||
      !/[A-Z]/.test(securityPassword) ||
      !/\d/.test(securityPassword)
    ) {
      setMessage("Use no mínimo 10 caracteres, com maiúscula, minúscula e número.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (securityUpgradeRequired && !forcedPasswordChange) {
        await upgradeCustomerSecurity(session.access_token, profilePhone, securityPassword);
        await requireSupabase().auth.refreshSession();
      } else {
        const { error: passwordError } = await requireSupabase().auth.updateUser({
          password: securityPassword,
        });
        if (passwordError) throw passwordError;
      }
      const { error: completionError } = await requireSupabase().rpc(
        "complete_forced_password_change",
      );
      if (completionError) throw completionError;
      setSecurityUpgradeRequired(false);
      setForcedPasswordChange(false);
      setPasswordRecoveryRequested(false);
      sessionStorage.removeItem(passwordRecoveryStorageKey);
      setSecurityPassword("");
      setSecurityPasswordConfirm("");
      setMessage(
        securityUpgradeRequired
          ? "Acesso seguro criado. Nos próximos acessos, use seu celular e sua senha."
          : "Senha atualizada com segurança. Nos próximos acessos, use a nova senha.",
      );
      await loadSnapshot();
    } catch (upgradeError) {
      setMessage(upgradeError instanceof Error ? upgradeError.message : "Não foi possível criar seu acesso seguro.");
    } finally {
      setBusy(false);
    }
  };
  const activatePasskey = async () => {
    setBusy(true);
    setMessage("");
    try {
      await registerCustomerPasskey();
      setMessage("Biometria ativada neste aparelho. A senha continua disponível como alternativa.");
    } catch (passkeyError) {
      setMessage(passkeyError instanceof Error ? passkeyError.message : "Este aparelho não permitiu ativar a biometria.");
    } finally {
      setBusy(false);
    }
  };
  const loadGroup = async () => {
    setBusy(true);
    const { data, error: groupError } = await requireSupabase().rpc(
      "customer_group_overview",
    );
    setBusy(false);
    if (groupError) return setMessage(groupError.message);
    const overview = (data || {}) as GroupOverview;
    setGroup(overview);
    setGroupName(overview.kind === "group" ? overview.name || "" : "");
  };
  const openGroup = () => {
    setView("group");
    void loadGroup();
  };
  const createGroupInvite = async () => {
    setBusy(true);
    setMessage("");
    const { data, error: inviteError } = await requireSupabase().rpc(
      "create_group_invite",
      { group_name: groupName.trim() || null },
    );
    setBusy(false);
    if (inviteError) return setMessage(inviteError.message);
    const result = data as { token: string };
    const url = `${location.origin}/?grupo=${encodeURIComponent(result.token)}#cadastro`;
    setGroupShareUrl(url);
    await loadGroup();
    if (navigator.share)
      await navigator.share({
        title: "Convite para meu Cartão Clube Adoce",
        text: "Quero dividir meu Cartão Clube Adoce com você. Cada pessoa mantém seu próprio acesso e QR.",
        url,
      });
    else {
      await navigator.clipboard.writeText(url);
      setMessage("Convite do cartão em grupo copiado.");
    }
  };
  const acceptGroupInvite = async () => {
    if (!groupInvite.trim()) return setMessage("Informe o código do convite.");
    setBusy(true);
    const { error: inviteError } = await requireSupabase().rpc(
      "accept_group_invite",
      { invite_token: groupInvite.trim() },
    );
    setBusy(false);
    if (inviteError) return setMessage(inviteError.message);
    sessionStorage.removeItem(groupStorageKey);
    setGroupInvite("");
    setMessage("Você entrou no cartão em grupo. Os próximos carimbos serão compartilhados.");
    await Promise.all([loadGroup(), loadSnapshot()]);
  };
  const removeGroupMember = async (profileId: string) => {
    if (!window.confirm("Remover este membro do cartão em grupo?")) return;
    setBusy(true);
    const { error: removeError } = await requireSupabase().rpc(
      "remove_group_member",
      { member_profile_id: profileId },
    );
    setBusy(false);
    if (removeError) return setMessage(removeError.message);
    setMessage("Membro removido. Ele recebeu um novo cartão individual vazio.");
    await loadGroup();
  };
  const openCustomerQr = async () => {
    setView("qr");
    setBusy(true);
    setMessage("");
    setQrImage("");
    const { data, error: qrError } =
      await requireSupabase().rpc("issue_customer_qr");
    if (qrError) {
      setBusy(false);
      setMessage(qrError.message);
      return;
    }
    const issued = Array.isArray(data) ? data[0] : data;
    if (!issued?.token) {
      setBusy(false);
      setMessage("Não foi possível gerar seu QR agora.");
      return;
    }
    const qrUrl = new URL("/", location.origin);
    qrUrl.searchParams.set("cartao", issued.token);
    qrUrl.hash = "cartao";
    const image = await QRCode.toDataURL(qrUrl.toString(), {
      width: 640,
      margin: 2,
      color: { dark: "#2b130d", light: "#fffaf4" },
      errorCorrectionLevel: "M",
    });
    setQrImage(image);
    setQrExpiresAt(issued.expires_at);
    setBusy(false);
  };
  if (onboardingRequired)
    return (
      <main className="club-onboarding">
        <header>
          <Brand label="Clube Adoce" />
          <button onClick={() => void signOut()}>
            <LogOut /> Sair
          </button>
        </header>
        <section className="club-onboarding-shell">
          <div className="club-onboarding-copy">
            <img src="/site/logo.webp" alt="Adoce Brigaderia" />
            <span>Último passo</span>
            <h1>Vamos concluir sua entrada no Clube.</h1>
            <p>
              Seu e-mail já foi confirmado. Agora precisamos saber seu nome e
              registrar suas escolhas antes de liberar o Cartão Clube Adoce.
            </p>
            <div>
              <ShieldCheck />
              <strong>Seus dados ficam protegidos</strong>
              <small>Você poderá revisar suas informações no perfil.</small>
            </div>
          </div>
          <form className="club-onboarding-form" onSubmit={completeOnboarding}>
            <h2>Como podemos chamar você?</h2>
            <p>
              Os campos marcados são necessários para participar do Clube Adoce.
            </p>
            <label>
              Nome completo *
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                autoComplete="name"
                placeholder="Seu nome completo"
                required
              />
            </label>
            <label>
              E-mail confirmado
              <input value={session.user.email || ""} readOnly />
            </label>
            <div className="access-consents">
              <label>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                <span>Aceito os <a href="/#termos" target="_blank" rel="noreferrer">Termos do Clube Adoce</a>. *</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                />
                <span>Li e aceito a <a href="/#privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>. *</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={marketingAccepted}
                  onChange={(event) =>
                    setMarketingAccepted(event.target.checked)
                  }
                />
                <span>
                  Quero receber sabores, promoções e novidades.{" "}
                  <em>Opcional</em>
                </span>
              </label>
              {marketingAccepted && (
                <NotificationPreferencesFields
                  value={notificationPreferences}
                  onChange={setNotificationPreferences}
                />
              )}
            </div>
            <button className="access-primary" disabled={busy}>
              {busy ? "Concluindo..." : "Quero fazer parte"}
              <ArrowRight />
            </button>
            {message && (
              <div className="access-message" role="status">
                {message}
              </div>
            )}
            <small>
              <ShieldCheck /> Você só verá o Cartão Clube Adoce depois que esta etapa for
              concluída.
            </small>
          </form>
        </section>
      </main>
    );
  if (accountStatus !== "active")
    return (
      <main className="club-onboarding">
        <header><Brand label="Clube Adoce" /><button onClick={() => void signOut()}><LogOut /> Sair</button></header>
        <section className="club-onboarding-shell">
          <div className="club-onboarding-copy">
            <ShieldCheck />
            <span>Acesso protegido</span>
            <h1>Este cadastro precisa de atendimento.</h1>
            <p>O acesso está temporariamente indisponível. Fale com a Adoce para revisar ou corrigir seu cadastro.</p>
          </div>
        </section>
      </main>
    );
  if (securityUpgradeRequired || forcedPasswordChange || passwordRecoveryRequested)
    return (
      <main className="club-onboarding">
        <header><Brand label="Clube Adoce" /><button onClick={() => void signOut()}><LogOut /> Sair</button></header>
        <section className="club-onboarding-shell">
          <div className="club-onboarding-copy">
            <KeyRound />
            <span>Proteção do seu cadastro</span>
            <h1>{forcedPasswordChange ? "Escolha uma senha só sua." : securityUpgradeRequired ? "Crie seu acesso definitivo." : "Crie uma nova senha."}</h1>
            <p>
              {forcedPasswordChange
                ? "A Adoce redefiniu seu acesso com uma senha temporária. Crie uma nova senha antes de continuar."
                : securityUpgradeRequired
                ? "Depois desta etapa, o código por e-mail fica reservado para recuperação. Seu acesso normal será pelo celular e senha."
                : "Seu e-mail já foi confirmado. Agora escolha uma nova senha para voltar a entrar pelo celular."}
            </p>
            <div><ShieldCheck /><strong>Um celular, um cadastro</strong><small>Isso protege seus carimbos e impede indicações duplicadas.</small></div>
          </div>
          <form className="club-onboarding-form" onSubmit={completeSecurityUpgrade}>
            <h2>Celular e senha</h2>
            <label>
              Celular com DDD
              <input
                value={profilePhone}
                onChange={(event) => setProfilePhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                readOnly={profileWhatsAppVerified}
                required
              />
            </label>
            {profileWhatsAppVerified ? (
              <div className="access-message"><Check /> WhatsApp confirmado</div>
            ) : metaWhatsAppEnabled ? (
              <div className="access-whatsapp-confirmation">
                {!profileWhatsAppChallenge ? (
                  <button type="button" className="access-secondary" onClick={() => void startProfileWhatsAppVerification()} disabled={busy}>
                    Confirmar meu WhatsApp
                  </button>
                ) : (
                  <>
                    <a className="access-primary" href={whatsappVerificationLink(profileWhatsAppChallenge)} target="_blank" rel="noreferrer">
                      Enviar confirmação pelo WhatsApp <ArrowRight />
                    </a>
                    <button type="button" className="access-secondary" onClick={() => void confirmProfileWhatsApp()} disabled={busy}>
                      Já enviei, verificar agora
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="access-message">
                Seu e-mail já foi confirmado. A confirmação do WhatsApp poderá ser feita depois, sem bloquear este acesso.
              </div>
            )}
            <label>
              Nova senha
              <input value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} type="password" autoComplete="new-password" minLength={10} required />
              <small>Mínimo de 10 caracteres, com maiúscula, minúscula e número.</small>
            </label>
            <label>
              Confirmar senha
              <input value={securityPasswordConfirm} onChange={(event) => setSecurityPasswordConfirm(event.target.value)} type="password" autoComplete="new-password" minLength={10} required />
            </label>
            <button className="access-primary" disabled={busy}>
              {busy
                ? "Protegendo cadastro..."
                : forcedPasswordChange
                  ? "Salvar minha nova senha"
                  : securityUpgradeRequired
                  ? "Criar meu acesso seguro"
                  : "Salvar nova senha"} <ArrowRight />
            </button>
            {message && <div className="access-message" role="status">{message}</div>}
          </form>
        </section>
      </main>
    );
  if (!snapshot)
    return (
      <main className="access-loading">
        <Brand label="Clube Adoce" />
        <p>
          {error ||
            (onboardingRequired === null
              ? "Verificando seus dados..."
              : "Preparando seu Clube Adoce...")}
        </p>
      </main>
    );
  return (
    <main className="club-home">
      <header>
        <Brand label="Clube Adoce" />
        <div className="club-header-actions">
          <a href="/#adoce-hoje">
            <CakeSlice /> Adoce Hoje
          </a>
          <button onClick={() => void openCustomerQr()}>
            <QrCode /> Meu QR
          </button>
          <button onClick={() => setView("help")}>
            <CircleHelp /> Como funciona
          </button>
          <button onClick={() => void signOut()}>
            <LogOut /> Sair
          </button>
        </div>
      </header>
      {view === "card" && (
        <>
          <section className="club-welcome">
            <div>
              <span>Área do Membro</span>
              <h1>Olá, {snapshot.name.split(" ")[0]}!</h1>
              {snapshot.rewards > 0 ? (
                <p>
                  Você completou seu cartão! Sua fatia grátis já está disponível
                  para resgate.
                </p>
              ) : (
                <p>
                  Você já possui {snapshot.progress} de 14 carimbos. Faltam apenas{" "}
                  {14 - snapshot.progress} fatias para ganhar sua próxima fatia
                  grátis.
                </p>
              )}
              <div className="club-quick-links">
                <a href="/#adoce-hoje">
                  <CakeSlice /> Ver sabores de hoje
                </a>
                <button onClick={() => setView("help")}>
                  <CircleHelp /> Aprender a usar o Clube
                </button>
                {metaWhatsAppEnabled && (
                  <button onClick={openGroup}>
                    <Users /> Cartão em grupo
                  </button>
                )}
                {!installApp.isInstalled && (
                  <button
                    className="club-install-shortcut"
                    onClick={() => setView("install")}
                  >
                    <Download /> Instalar Clube Adoce
                  </button>
                )}
              </div>
            </div>
            <div className="club-mini-stat">
              <Gift />
              <strong>{snapshot.rewards}</strong>
              <span>Minha Fatia Grátis</span>
            </div>
          </section>
          <section className="club-grid">
            <MemberLoyaltyCard snapshot={snapshot} />
            <aside className="club-side">
              <article>
                <Sparkles />
                <small>Espalhe Doçura</small>
                <h3>{snapshot.referralProgress} de 14 indicações</h3>
                {snapshot.pendingReferrals > 0 && (
                  <p className="referral-pending">
                    <Heart /> {snapshot.pendingReferrals} convite
                    {snapshot.pendingReferrals === 1 ? " aceito" : "s aceitos"}{" "}
                    aguardando primeira compra
                  </p>
                )}
                <p>Seu link pessoal já leva o convite junto.</p>
                <button onClick={() => setView("share")}>
                  Convidar alguém
                </button>
              </article>
              <article>
                <Smartphone />
                <h3>Levar para a carteira</h3>
                <p>
                  Apple Wallet e Google Wallet serão sugeridos assim que os
                  passes estiverem liberados.
                </p>
                <span>Próxima etapa</span>
              </article>
            </aside>
          </section>
        </>
      )}
      {view === "share" && (
        <section className="club-panel club-referral-guide">
          <Sparkles />
          <small>Espalhe Doçura</small>
          <h1>Convide com seu link. O bônus fica reservado automaticamente.</h1>
          <p>
            A pessoa abre seu convite, conclui o cadastro e você acompanha aqui
            enquanto ela ainda não fez a primeira compra.
          </p>
          <div className="referral-track">
            {Array.from({ length: 14 }, (_, index) => (
              <span
                key={index}
                className={
                  index < snapshot.referralProgress
                    ? "confirmed"
                    : index <
                        snapshot.referralProgress + snapshot.pendingReferrals
                      ? "pending"
                      : ""
                }
              >
                <Heart />
              </span>
            ))}
          </div>
          {snapshot.acceptedInvites.length > 0 && (
            <div className="referral-accepted-list">
              {snapshot.acceptedInvites.map((invite, index) => (
                <div key={`${invite.first_name}-${invite.created_at}-${index}`}>
                  <span>{invite.first_name[0]}</span>
                  <p>
                    <strong>{invite.first_name} aceitou seu convite</strong>
                    <small>
                      {invite.status === "confirmed"
                        ? "Primeira compra confirmada"
                        : "Aguardando a primeira compra"}
                    </small>
                  </p>
                </div>
              ))}
            </div>
          )}
          <ol>
            <li>
              <b>1</b>
              <span>
                <strong>Envie seu link pessoal</strong>
                <small>
                  O WhatsApp já abre com uma mensagem curta e amigável.
                </small>
              </span>
            </li>
            <li>
              <b>2</b>
              <span>
                <strong>A pessoa aceita e se cadastra</strong>
                <small>
                  O vínculo é feito automaticamente, sem digitar código na
                  venda.
                </small>
              </span>
            </li>
            <li>
              <b>3</b>
              <span>
                <strong>Acompanhe quem aceitou</strong>
                <small>
                  O convite fica reservado enquanto aguarda a primeira compra.
                </small>
              </span>
            </li>
            <li>
              <b>4</b>
              <span>
                <strong>Na primeira compra, os dois ganham</strong>
                <small>
                  O sistema confirma automaticamente os dois carimbos.
                </small>
              </span>
            </li>
          </ol>
          <button className="access-primary" onClick={() => void shareClub()}>
            <Users /> Compartilhar meu link no WhatsApp
          </button>
        </section>
      )}
      {view === "group" && (
        <section className="club-panel club-group-panel">
          <Users />
          <small>Família, amigos ou equipe</small>
          <h1>Cartão Clube Adoce em grupo</h1>
          <p>
            Cada pessoa mantém seu próprio acesso, Código do Membro e QR. Os
            carimbos e a Fatia Grátis são compartilhados por até 5 membros.
          </p>
          {group.kind === "group" && (
            <div className="group-member-list">
              <h2>{group.name}</h2>
              {(group.members || []).map((member) => (
                <article key={member.profile_id}>
                  <span>{member.full_name.slice(0, 1).toUpperCase()}</span>
                  <p>
                    <strong>{member.full_name}</strong>
                    <small>{member.member_code} · {member.role === "owner" ? "Proprietário" : "Membro"}</small>
                  </p>
                  {group.is_owner && member.role !== "owner" && (
                    <button onClick={() => void removeGroupMember(member.profile_id)}>
                      Remover
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
          {(!group.kind || group.is_owner) && (
            <div className="group-invite-box">
              <label>
                Nome do grupo
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Ex.: Família Bezerra"
                />
              </label>
              <button className="access-primary" disabled={busy} onClick={() => void createGroupInvite()}>
                <Users /> Convidar uma pessoa
              </button>
              {groupShareUrl && <small>O último convite está pronto para ser compartilhado.</small>}
            </div>
          )}
          {group.kind !== "group" && (
            <div className="group-invite-box">
              <label>
                Recebeu um convite?
                <input
                  value={groupInvite}
                  onChange={(event) => setGroupInvite(event.target.value)}
                  placeholder="Cole aqui o código do convite"
                />
              </label>
              <button className="access-secondary" disabled={busy} onClick={() => void acceptGroupInvite()}>
                Entrar no cartão em grupo
              </button>
            </div>
          )}
          <small>
            Entrar em um grupo transfere com segurança seus carimbos, recompensas
            e histórico para o cartão compartilhado. Sair do grupo não reinicia
            o saldo que pertence ao grupo.
          </small>
        </section>
      )}
      {view === "qr" && (
        <section className="club-panel club-qr">
          <QrCode />
          <small>Cartão Clube Adoce</small>
          <h1>QR Code do Membro</h1>
          <p>
            Este QR Code identifica seu Cartão Clube Adoce. Seu Código do Membro
            também pode ser usado para localizar você.
          </p>
          <div className="club-member-code">
            <span>Código do Membro</span>
            <strong>{snapshot.memberCode}</strong>
          </div>
          {busy && !qrImage ? (
            <div className="qr-loading">Gerando seu QR seguro...</div>
          ) : (
            qrImage && (
              <>
                <div className="club-qr-image">
                  <img src={qrImage} alt="QR do cartão Clube Adoce" />
                  <img src="/site/logo.webp" alt="" />
                </div>
                <strong>
                  Válido até{" "}
                  {new Date(qrExpiresAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                <button
                  className="access-secondary"
                  onClick={() => void openCustomerQr()}
                >
                  <QrCode /> Gerar um novo QR
                </button>
              </>
            )
          )}
        </section>
      )}
      {view === "help" && (
        <section className="club-panel club-help">
          <CircleHelp />
          <small>Cartão Clube Adoce</small>
          <h1>Como funciona</h1>
          <p>
            A cada fatia comprada, você recebe um carimbo no seu Cartão Clube
            Adoce. Complete 14 carimbos e ganhe uma fatia grátis. O cartão é
            pessoal e está vinculado ao cadastro do membro.
          </p>
          <div className="club-help-list">
            <article>
              <Heart />
              <span>
                <strong>Como ganho carimbos?</strong>
                <small>
                  Cada fatia comprada, tradicional ou premium, vale 1 carimbo.
                </small>
              </span>
            </article>
            <article>
              <QrCode />
              <span>
                <strong>Como meu Cartão Clube Adoce é localizado?</strong>
                <small>
                  Abra “Meu QR” e mostre o código. Se precisar, informe também
                  seu Código do Membro: {snapshot.memberCode}.
                </small>
                <button onClick={() => void openCustomerQr()}>
                  Abrir meu QR
                </button>
              </span>
            </article>
            <article>
              <Gift />
              <span>
                <strong>O que acontece ao completar 14?</strong>
                <small>
                  Sua Fatia Grátis fica disponível para resgate. Você pode
                  escolher uma fatia premium pagando somente a diferença.
                </small>
              </span>
            </article>
            <article>
              <Sparkles />
              <span>
                <strong>Como funciona minha indicação?</strong>
                <small>
                  Compartilhe seu link pessoal. O cadastro fica vinculado
                  automaticamente e, na primeira compra, os dois ganham 1
                  carimbo.
                </small>
                <button onClick={() => setView("share")}>
                  Ver e compartilhar meu link
                </button>
              </span>
            </article>
            <article>
              <CakeSlice />
              <span>
                <strong>Onde vejo os sabores disponíveis?</strong>
                <small>
                  Abra o Adoce Hoje para consultar sabores, atendimento e
                  informações atualizadas.
                </small>
                <a href="/#adoce-hoje">Abrir Adoce Hoje</a>
              </span>
            </article>
          </div>
          <InstallGuide
            {...installApp}
            appName="o Clube Adoce"
            onInstall={installApp.install}
          />
        </section>
      )}
      {view === "install" && (
        <section className="club-panel club-install-panel">
          <Download />
          <small>Atalho no celular</small>
          <h1>Leve o Clube Adoce com você.</h1>
          <p>
            Identificamos seu aparelho e mostramos abaixo o caminho certo para instalar.
          </p>
          <InstallGuide
            {...installApp}
            appName="o Clube Adoce"
            onInstall={installApp.install}
          />
        </section>
      )}
      {view === "profile" && (
        <section className="club-panel">
          <UserRound />
          <small>Meu perfil</small>
          <h1>Seus dados no Clube.</h1>
          <form onSubmit={saveProfile}>
            <label>
              Nome completo
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              E-mail
              <input value={session.user.email || ""} readOnly />
            </label>
            <label>
              WhatsApp com DDD
              <input
                value={profilePhone}
                readOnly={profileWhatsAppVerified}
                onChange={(event) => setProfilePhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            {metaWhatsAppEnabled && (profileWhatsAppVerified ? (
              <div className="access-message"><Check /> WhatsApp confirmado</div>
            ) : (
              <div className="access-whatsapp-confirmation">
                {!profileWhatsAppChallenge ? (
                  <button type="button" className="access-secondary" onClick={() => void startProfileWhatsAppVerification()}>
                    Confirmar meu WhatsApp
                  </button>
                ) : (
                  <>
                    <a className="access-primary" href={whatsappVerificationLink(profileWhatsAppChallenge)} target="_blank" rel="noreferrer">
                      Enviar confirmação pelo WhatsApp <ArrowRight />
                    </a>
                    <button type="button" className="access-secondary" onClick={() => void confirmProfileWhatsApp()}>
                      Já enviei, verificar agora
                    </button>
                  </>
                )}
              </div>
            ))}
            {passkeysEnabled && securityUpgradeRequired === false && (
              <button type="button" className="access-secondary" onClick={() => void activatePasskey()} disabled={busy}>
                <Smartphone /> Ativar biometria neste aparelho
              </button>
            )}
            <NotificationPreferencesFields
              value={notificationPreferences}
              onChange={setNotificationPreferences}
            />
            <button className="access-primary" disabled={busy}>
              {busy ? "Salvando..." : "Salvar perfil e preferências"}
            </button>
          </form>
        </section>
      )}
      {message && (
        <div className="operation-toast">
          <Check />
          {message}
        </div>
      )}
      <nav className="club-bottom">
        <button
          className={view === "card" ? "active" : ""}
          onClick={() => setView("card")}
        >
          <Heart /> Cartão
        </button>
        <button
          className={view === "qr" ? "active" : ""}
          onClick={() => void openCustomerQr()}
        >
          <QrCode /> Meu QR
        </button>
        <a href="/#adoce-hoje">
          <CakeSlice /> Hoje
        </a>
        <button
          className={view === "share" ? "active" : ""}
          onClick={() => setView("share")}
        >
          <Users /> Indicar
        </button>
        <button
          className={view === "profile" ? "active" : ""}
          onClick={() => setView("profile")}
        >
          <UserRound /> Perfil
        </button>
      </nav>
    </main>
  );
}

function OperationHome({ session }: { session: Session }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [role, setRole] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffPasswordConfirm, setNewStaffPasswordConfirm] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [selected, setSelected] = useState<CustomerSnapshot | null>(null);
  const [generatedAccess, setGeneratedAccess] =
    useState<StaffAccessCode | null>(null);
  const [passwordResetNotice, setPasswordResetNotice] = useState<{
    targetUserId: string;
    fullName: string;
    temporaryPassword: string;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [correctionQty, setCorrectionQty] = useState(1);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [accountAction, setAccountAction] = useState<CustomerAccountAction>("deactivate");
  const [accountReason, setAccountReason] = useState<CustomerAccountReason>("customer_request");
  const [accountReasonNote, setAccountReasonNote] = useState("");
  const [memberCounts, setMemberCounts] = useState<MemberCounts>({ total: 0, active: 0, deactivated: 0, pending: 0 });
  const [editingCustomerName, setEditingCustomerName] = useState(false);
  const [customerNameDraft, setCustomerNameDraft] = useState("");
  const [view, setView] = useState<OperationView>(() =>
    location.hash.includes("plano-diretor")
      ? "director-plan"
      : location.hash.includes("catalogo")
        ? "catalog"
        : location.hash.includes("historico")
          ? "archive"
        : location.hash.includes("vendas") || location.hash.includes("pedidos") || location.hash.includes("pede-junto") || location.hash.includes("reclamacoes") || location.hash.includes("agenda") || location.hash.includes("financeiro") || location.hash.includes("configuracoes") || location.hash.includes("operacao-clientes")
          ? "orders"
          : location.hash.includes("membros")
            ? "attend"
        : "dashboard",
  );
  const [commercialTab, setCommercialTab] = useState<OperationCommercialTab>(() =>
    location.hash.includes("vendas")
      ? "sales"
      : location.hash.includes("pede-junto")
      ? "pede_junto"
      : location.hash.includes("reclamacoes")
        ? "feedback"
        : location.hash.includes("operacao-clientes")
          ? "crm"
        : location.hash.includes("pedidos")
          ? "requests"
          : location.hash.includes("financeiro")
            ? "finance"
            : location.hash.includes("configuracoes")
              ? "settings"
              : "agenda",
  );
  const [contentTab, setContentTab] =
    useState<OperationContentTab>("catalog");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [team, setTeam] = useState<StaffMember[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [manualQr, setManualQr] = useState("");
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControls = useRef<IScannerControls | null>(null);
  const scanHandled = useRef(false);
  const installApp = useInstallApp();
  const search = useCallback(
    async (term = query) => {
      setBusy(true);
      setMessage("");
      setSelected(null);
      setGeneratedAccess(null);
      const supabase = requireSupabase();
      const loadAllProfiles = async () => {
        const rows: Array<{
          id: string;
          full_name: string;
          phone_e164: string | null;
          email: string | null;
          member_code: string | null;
          account_status: string;
          updated_at: string;
        }> = [];
        for (let from = 0; ; from += 1000) {
          const page = await supabase
            .from("profiles")
            .select("id,full_name,phone_e164,email,member_code,account_status,updated_at")
            .order("full_name", { ascending: true })
            .range(from, from + 999);
          if (page.error) return { data: rows, error: page.error };
          rows.push(...((page.data || []) as typeof rows));
          if ((page.data || []).length < 1000) return { data: rows, error: null };
        }
      };
      const [{ data: profiles, error: profilesError }, { data: staffRows }] = await Promise.all([
        loadAllProfiles(),
        supabase.from("staff_members").select("user_id"),
      ]);
      if (profilesError) {
        setBusy(false);
        setMessage(profilesError.message);
        return;
      }
      const staffIds = new Set((staffRows || []).map((staff) => staff.user_id));
      const customers = [...(profiles || [])]
        .filter((profile) => !staffIds.has(profile.id));
      setMemberCounts({
        total: customers.length,
        active: customers.filter((profile) => profile.account_status === "active").length,
        deactivated: customers.filter((profile) => ["deactivated", "merged"].includes(profile.account_status)).length,
        pending: customers.filter((profile) => profile.account_status === "pending_deletion").length,
      });
      const matched = customers
        .filter((profile) => ["active", "pending_deletion"].includes(profile.account_status))
        .filter((profile) => matchesCustomerSearch(profile, term))
        .sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "pt-BR", {
            sensitivity: "base",
          }),
        )
        .slice(0, 30);
      setResults(
        matched.map((profile) => ({
          profile_id: profile.id,
          full_name: profile.full_name,
          phone_e164: profile.phone_e164,
          email: profile.email,
          member_code: profile.member_code || "—",
          account_status: profile.account_status || "active",
        })),
      );
      setBusy(false);
    },
    [query],
  );
  const openCustomer = useCallback(async (customer: CustomerSearchResult) => {
    setBusy(true);
    setMessage("");
    setGeneratedAccess(null);
    setCorrectionQty(1);
    setCorrectionReason("");
    setEditingCustomerName(false);
    setCustomerNameDraft(customer.full_name);
    const supabase = requireSupabase();
    const [
      { data: memberships, error: membershipsError },
      { data: memberProfile, error: memberProfileError },
    ] = await Promise.all([
      supabase
        .from("account_memberships")
        .select("account_id,is_primary")
        .eq("profile_id", customer.profile_id)
        .eq("active", true),
      supabase
        .from("profiles")
        .select("member_code")
        .eq("id", customer.profile_id)
        .single(),
    ]);
    if (membershipsError || memberProfileError) {
      setBusy(false);
      setMessage((membershipsError || memberProfileError)?.message || "Não foi possível abrir o membro.");
      return;
    }
    const accountId =
      memberships?.find((item) => item.is_primary)?.account_id ||
      memberships?.[0]?.account_id;
    if (!accountId) {
      setBusy(false);
      setMessage("Este membro ainda não possui um Cartão Clube Adoce ativo.");
      return;
    }
    const { data: track, error: trackError } = await supabase
      .from("loyalty_tracks")
      .select("id,current_progress,completed_cards")
      .eq("account_id", accountId)
      .eq("kind", "main")
      .maybeSingle();
    if (trackError) {
      setBusy(false);
      setMessage(trackError.message);
      return;
    }
    const { data: rewards, error: rewardsError } = track
      ? await supabase
          .from("rewards")
          .select("id")
          .eq("track_id", track.id)
          .eq("status", "available")
          .order("issued_at", { ascending: true })
      : { data: [], error: null };
    if (rewardsError) {
      setBusy(false);
      setMessage(rewardsError.message);
      return;
    }
    setSelected({
      ...customer,
      member_code: memberProfile?.member_code || customer.member_code,
      account_id: accountId,
      current_progress: track?.current_progress || 0,
      completed_cards: track?.completed_cards || 0,
      available_rewards: rewards?.length || 0,
      available_reward_id: rewards?.[0]?.id || null,
    });
    setView("attend");
    setBusy(false);
  }, []);
  const issueAccessCode = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    setGeneratedAccess(null);
    try {
      const access = await generateStaffAccessCode(
        session.access_token,
        selected.profile_id,
      );
      setGeneratedAccess(access);
      setMessage("Código temporário gerado. Copie ou envie pelo WhatsApp.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o código de acesso.",
      );
    } finally {
      setBusy(false);
    }
  }, [selected, session.access_token]);
  const copyGeneratedAccess = useCallback(async () => {
    if (!generatedAccess) return;
    try {
      await navigator.clipboard.writeText(staffAccessMessage(generatedAccess));
      setMessage("Mensagem com o código copiada.");
    } catch {
      setMessage("Não foi possível copiar. Selecione o código exibido.");
    }
  }, [generatedAccess]);
  const changeCustomerAccount = useCallback(async () => {
    if (!selected) return;
    const actionLabel: Record<CustomerAccountAction, string> = {
      deactivate: "desativar este cadastro",
      reactivate: "reativar este cadastro",
      request_deletion: "registrar a solicitação de exclusão",
      delete_account: "excluir definitivamente o acesso e os dados pessoais deste cadastro",
      mark_duplicate: "marcar este cadastro como duplicado e desativá-lo",
      cancel_deletion: "cancelar a exclusão e reativar o cadastro",
    };
    if (!window.confirm(`Confirmar: ${actionLabel[accountAction]}?\n\nO motivo e a ação ficarão registrados na auditoria.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await applyCustomerAccountAction(session.access_token, {
        profileId: selected.profile_id,
        action: accountAction,
        reasonCode: accountReason,
        reasonNote: accountReasonNote,
      });
      const successMessage = result.resultingStatus === "anonymized"
        ? "Cadastro excluído. O acesso e os dados pessoais foram removidos; o histórico operacional foi preservado."
        : result.notificationStatus === "sent"
          ? "Cadastro atualizado e cliente avisado por e-mail."
          : "Cadastro atualizado. A notificação ficou pendente para envio.";
      await search(query);
      setMessage(successMessage);
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "Não foi possível atualizar o cadastro.");
    } finally {
      setBusy(false);
    }
  }, [accountAction, accountReason, accountReasonNote, query, search, selected, session.access_token]);
  useEffect(() => {
    if (selected?.account_status === "pending_deletion") setAccountAction("delete_account");
  }, [selected?.account_status, selected?.profile_id]);
  const saveCustomerName = useCallback(async () => {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const cleanName = await updateCustomerName(session.access_token, selected.profile_id, customerNameDraft);
      setEditingCustomerName(false);
      await search(query);
      setMessage(`Nome atualizado para ${cleanName} e registrado na auditoria.`);
    } catch (nameError) {
      setMessage(nameError instanceof Error ? nameError.message : "Não foi possível atualizar o nome.");
    } finally { setBusy(false); }
  }, [customerNameDraft, query, search, selected, session.access_token]);
  const stopScanner = useCallback(() => {
    scannerControls.current?.stop();
    scannerControls.current = null;
    setScannerOpen(false);
    setScannerStarting(false);
  }, []);
  const lookupCustomerQr = useCallback(
    async (qrValue: string) => {
      const cleanValue = qrValue.trim();
      if (!cleanValue) {
        setMessage("Aponte para um QR do Clube Adoce.");
        return;
      }
      setBusy(true);
      setMessage("");
      const { data, error: lookupError } = await requireSupabase().rpc(
        "staff_lookup_customer_by_qr",
        { qr_value: cleanValue },
      );
      if (lookupError) {
        setBusy(false);
        setMessage(lookupError.message);
        return;
      }
      const customer = (Array.isArray(data) ? data[0] : data) as
        | CustomerSearchResult
        | undefined;
      if (!customer) {
        setBusy(false);
        setMessage(
          "QR expirado ou membro não encontrado. Peça ao membro para gerar um novo código.",
        );
        return;
      }
      stopScanner();
      setManualQr("");
      setBusy(false);
      await openCustomer(customer);
    },
    [openCustomer, stopScanner],
  );
  const startScanner = useCallback(async () => {
    stopScanner();
    setScannerOpen(true);
    setScannerStarting(true);
    scanHandled.current = false;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    try {
      const reader = new BrowserQRCodeReader();
      scannerControls.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result && !scanHandled.current) {
            scanHandled.current = true;
            void lookupCustomerQr(result.getText());
          }
        },
      );
      setScannerStarting(false);
    } catch (cameraError) {
      setScannerStarting(false);
      setMessage(
        cameraError instanceof Error
          ? `Não foi possível abrir a câmera: ${cameraError.message}`
          : "Não foi possível abrir a câmera.",
      );
    }
  }, [lookupCustomerQr, stopScanner]);
  useEffect(() => () => stopScanner(), [stopScanner]);
  useEffect(() => {
    void (async () => {
      const { data } = await requireSupabase()
        .from("staff_members")
        .select("role,active,must_change_password")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setAuthorized(Boolean(data?.active));
      setRole(data?.role || "");
      setMustChangePassword(Boolean(data?.must_change_password));
      if (data?.active) await search("");
    })();
  }, [session.user.id]);
  const completeStaffPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newStaffPassword !== newStaffPasswordConfirm) {
      setMessage("As duas senhas precisam ser iguais.");
      return;
    }
    if (
      newStaffPassword.length < 10 ||
      !/[a-z]/.test(newStaffPassword) ||
      !/[A-Z]/.test(newStaffPassword) ||
      !/\d/.test(newStaffPassword)
    ) {
      setMessage(
        "Use no mínimo 10 caracteres, com maiúscula, minúscula e número.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const supabase = requireSupabase();
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newStaffPassword,
      });
      if (passwordError) throw passwordError;
      const { error: completionError } = await supabase.rpc(
        "complete_forced_password_change",
      );
      if (completionError) throw completionError;
      setMustChangePassword(false);
      setNewStaffPassword("");
      setNewStaffPasswordConfirm("");
      setMessage("Senha atualizada. Seu acesso à operação está liberado.");
    } catch (passwordChangeError) {
      setMessage(
        passwordChangeError instanceof Error
          ? passwordChangeError.message
          : "Não foi possível atualizar a senha.",
      );
    } finally {
      setBusy(false);
    }
  };
  const resetAccessPassword = async (
    targetUserId: string,
    targetKind: "staff" | "customer",
    fullName: string,
  ) => {
    if (!["owner", "manager"].includes(role)) return;
    const confirmed = window.confirm(
      `Redefinir a senha de ${fullName}?\n\nA senha temporária será 123456@adoce e a pessoa será obrigada a criar uma nova senha no próximo acesso.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    setPasswordResetNotice(null);
    try {
      const result = await resetUserPasswordByManager(
        session.access_token,
        targetUserId,
        targetKind,
      );
      const temporaryPassword =
        result.temporaryPassword || "123456@adoce";
      setPasswordResetNotice({
        targetUserId,
        fullName: result.fullName || fullName,
        temporaryPassword,
      });
      if (targetKind === "staff") {
        setTeam((currentTeam) =>
          currentTeam.map((member) =>
            member.user_id === targetUserId
              ? { ...member, must_change_password: true }
              : member,
          ),
        );
      }
      setMessage(
        `Senha temporária criada para ${result.fullName || fullName}. A troca será obrigatória no próximo acesso.`,
      );
    } catch (resetError) {
      setMessage(
        resetError instanceof Error
          ? resetError.message
          : "Não foi possível redefinir a senha.",
      );
    } finally {
      setBusy(false);
    }
  };
  const copyTemporaryPassword = async () => {
    if (!passwordResetNotice) return;
    await navigator.clipboard.writeText(
      `Acesso temporário Adoce\nUsuário: celular cadastrado\nSenha temporária: ${passwordResetNotice.temporaryPassword}\nAo entrar, crie uma nova senha.`,
    );
    setMessage("Acesso temporário copiado.");
  };
  const refreshSelected = async () => {
    if (selected) await openCustomer(selected);
  };
  const openView = async (next: OperationView) => {
    setMobileNavOpen(false);
    setView(next);
    window.history.replaceState(
      null,
      "",
      next === "catalog"
        ? "#operacao-catalogo"
        : next === "archive"
          ? "#operacao-historico"
        : next === "director-plan"
          ? "#operacao-plano-diretor"
          : "#operacao",
    );
    setSelected(null);
    setMessage("");
    if (next === "attend") await search("");
    if (next === "movements") {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id,reason,stamps_delta,created_at,subject_profile_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        setMessage(error.message);
        return;
      }
      const entries = (data || []) as Movement[];
      const profileIds = [
        ...new Set(
          entries
            .map((item) => item.subject_profile_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const { data: profiles, error: profilesError } = profileIds.length
        ? await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", profileIds)
        : { data: [], error: null };
      if (profilesError) {
        setMessage(profilesError.message);
        return;
      }
      const names = new Map(
        (profiles || []).map((profile) => [
          profile.id,
          profile.full_name?.trim().split(/\s+/)[0] || "Membro",
        ]),
      );
      setMovements(
        entries.map((item) => ({
          ...item,
          customer_first_name:
            (item.subject_profile_id && names.get(item.subject_profile_id)) ||
            "Membro",
        })),
      );
    }
    if (next === "team") {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("staff_members")
        .select("user_id,role,active,must_change_password")
        .order("created_at");
      if (error) {
        setMessage(error.message);
        return;
      }
      const ids = (data || []).map((item) => item.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,full_name").in("id", ids)
        : { data: [] };
      setTeam(
        (data || []).map((item) => ({
          ...item,
          display_name:
            profiles?.find((profile) => profile.id === item.user_id)
              ?.full_name || "Membro da equipe",
        })),
      );
    }
  };
  const openNotificationTarget = useCallback((actionUrl: string) => {
    if (actionUrl.includes("vendas")) {
      setCommercialTab("sales");
      setView("orders");
    } else if (actionUrl.includes("pede-junto")) {
      setCommercialTab("pede_junto");
      setView("orders");
    } else if (actionUrl.includes("reclamacoes")) {
      setCommercialTab("feedback");
      setView("orders");
    } else if (actionUrl.includes("pedidos")) {
      setCommercialTab("requests");
      setView("orders");
    } else if (actionUrl.includes("membros")) {
      setView("attend");
      void search("");
    }
    window.history.replaceState(null, "", actionUrl || "#operacao");
    setSelected(null);
    setMessage("");
  }, [search]);
  const openCommercial = useCallback((tab: OperationCommercialTab) => {
    setMobileNavOpen(false);
    setCommercialTab(tab);
    setView("orders");
    const hashes: Record<OperationCommercialTab, string> = {
      agenda: "#operacao-agenda",
      sales: "#operacao-vendas",
      requests: "#operacao-pedidos",
      pede_junto: "#operacao-pede-junto",
      catalog: "#operacao-catalogo-comercial",
      crm: "#operacao-clientes",
      feedback: "#operacao-reclamacoes",
      finance: "#operacao-financeiro",
      settings: "#operacao-configuracoes",
    };
    window.history.replaceState(null, "", hashes[tab]);
    setSelected(null);
    setMessage("");
  }, []);
  const purchase = async () => {
    if (!selected) return;
    const total = selected.current_progress + qty;
    const nextProgress = total % 14;
    const newRewards = Math.floor(total / 14);
    const confirmed = window.confirm(
      `Confirmar ${qty} carimbo(s) para ${selected.full_name}?\n\nAntes: ${selected.current_progress} de 14\nDepois: ${nextProgress} de 14${newRewards ? ` e ${newRewards} nova(s) fatia(s) grátis` : ""}`,
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await requireSupabase().rpc(
      "staff_record_purchase",
      {
        account_id: selected.account_id,
        participant_profile_id: selected.profile_id,
        quantity: qty,
        idempotency_key: crypto.randomUUID(),
        referral_code: null,
      },
    );
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(
        data?.referral_confirmed
          ? `${qty} carimbo(s) da compra registrados. A indicação vinculada também foi confirmada automaticamente.`
          : `${qty} carimbo(s) registrado(s) com sucesso.`,
      );
      setQty(1);
      await refreshSelected();
    }
  };
  const correctStamps = async () => {
    if (!selected || role !== "owner") return;
    const normalizedReason = correctionReason.trim();
    if (normalizedReason.length < 5) {
      setCorrectionError(
        "Explique o motivo com pelo menos 5 caracteres para manter o histórico claro.",
      );
      return;
    }
    setCorrectionError("");
    const confirmed = window.confirm(
      `Remover ${correctionQty} carimbo(s) de ${selected.full_name}?\n\nSaldo atual: ${selected.current_progress} de 14\nMotivo: ${normalizedReason}\n\nA correção ficará registrada no histórico.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    const { error } = await requireSupabase().rpc("owner_remove_stamps", {
      target_account_id: selected.account_id,
      target_profile_id: selected.profile_id,
      quantity_to_remove: correctionQty,
      adjustment_reason: normalizedReason,
      operation_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(
        `${correctionQty} carimbo(s) removido(s). A correção foi registrada no histórico.`,
      );
      setCorrectionQty(1);
      setCorrectionReason("");
      setCorrectionError("");
      await refreshSelected();
    }
  };
  const redeem = async () => {
    if (!selected?.available_reward_id) return;
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_redeem_group_reward", {
      reward_id: selected.available_reward_id,
      participant_profile_id: selected.profile_id,
      premium_upgrade: false,
      price_difference: 0,
      idempotency_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(
        "Fatia grátis resgatada. O Cartão Clube Adoce continua acumulando normalmente.",
      );
      await refreshSelected();
    }
  };
  if (authorized === null)
    return (
      <main className="access-loading">
        <Brand label="Adoce Operação" />
        <p>Validando seu acesso...</p>
      </main>
    );
  if (!authorized)
    return (
      <main className="access-loading">
        <Brand label="Adoce Operação" />
        <ShieldCheck />
        <h1>Acesso reservado à equipe</h1>
        <p>Este e-mail não possui uma função ativa na operação.</p>
        <button onClick={() => void signOut()}>Sair</button>
      </main>
    );
  if (mustChangePassword)
    return (
      <main className="club-onboarding">
        <header>
          <Brand label="Adoce Operação" />
          <button onClick={() => void signOut()}>
            <LogOut /> Sair
          </button>
        </header>
        <section className="club-onboarding-shell">
          <div className="club-onboarding-copy">
            <KeyRound />
            <span>Primeiro acesso após redefinição</span>
            <h1>Crie uma senha só sua.</h1>
            <p>
              A senha temporária serviu apenas para abrir este acesso. Ela deixa
              de funcionar assim que você salvar a nova senha.
            </p>
            <div>
              <ShieldCheck />
              <strong>Acesso protegido</strong>
              <small>Ninguém da equipe precisa conhecer sua nova senha.</small>
            </div>
          </div>
          <form
            className="club-onboarding-form"
            onSubmit={completeStaffPasswordChange}
          >
            <h2>Nova senha da operação</h2>
            <label>
              Nova senha
              <input
                value={newStaffPassword}
                onChange={(event) => setNewStaffPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
              <small>
                Mínimo de 10 caracteres, com maiúscula, minúscula e número.
              </small>
            </label>
            <label>
              Confirmar nova senha
              <input
                value={newStaffPasswordConfirm}
                onChange={(event) =>
                  setNewStaffPasswordConfirm(event.target.value)
                }
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            <button className="access-primary" disabled={busy}>
              {busy ? "Salvando..." : "Salvar e entrar na operação"}
              <ArrowRight />
            </button>
            {message && (
              <div className="access-message" role="status">
                {message}
              </div>
            )}
          </form>
        </section>
      </main>
    );
  const customerList = (
    <div className="operation-results">
      {results.map((customer) => (
        <button
          key={customer.profile_id}
          onClick={() => void openCustomer(customer)}
        >
          <span className="avatar">{customer.full_name[0]}</span>
          <span>
            <strong>{customer.full_name}</strong>
            <small>
              {customer.phone_e164 || customer.email || "Contato não informado"}
            </small>
          </span>
          <span>
            <small>Abrir membro</small>
          </span>
          <ArrowRight />
        </button>
      ))}
    </div>
  );
  return (
    <main className="operation-home">
      <header>
        <Brand label="Adoce Operação" />
        <div>
          <span>
            {role === "owner"
              ? "Proprietário"
              : role === "manager"
                ? "Gerente"
                : "Atendimento"}
          </span>
          <Suspense fallback={null}>
            <OperationNotificationCenter session={session} onNavigate={openNotificationTarget} />
          </Suspense>
          <button className="operation-mobile-nav-toggle" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Abrir menu da operação" aria-expanded={mobileNavOpen}>
            {mobileNavOpen ? <X /> : <MoreHorizontal />}
          </button>
          <button onClick={() => setInstallGuideOpen(true)}>
            <Download /> Instalar
          </button>
          <button onClick={() => void signOut()}>
            <LogOut /> Sair
          </button>
        </div>
      </header>
      <div className="operation-shell">
        <aside className={mobileNavOpen ? "is-open" : ""}>
          <small className="operation-nav-group">Visão geral</small>
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => void openView("dashboard")}
          >
            <LayoutDashboard /> Início da operação
          </button>
          <small className="operation-nav-group">Clientes e fidelidade</small>
          <button
            className={view === "attend" ? "active" : ""}
            onClick={() => void openView("attend")}
          >
            <Search /> Clientes & Clube
          </button>
          <button
            className={view === "movements" ? "active" : ""}
            onClick={() => void openView("movements")}
          >
            <History /> Histórico do Clube
          </button>
          <small className="operation-nav-group">Vendas</small>
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "orders" && commercialTab === "sales" ? "active" : ""}
              onClick={() => openCommercial("sales")}
            >
              <ShoppingCart /> Caixa e pedidos de fatias
            </button>
          )}
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "orders" && (commercialTab === "agenda" || commercialTab === "requests") ? "active" : ""}
              onClick={() => openCommercial("agenda")}
            >
              <CalendarDays /> Encomendas e agenda
            </button>
          )}
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "orders" && commercialTab === "pede_junto" ? "active" : ""}
              onClick={() => openCommercial("pede_junto")}
            >
              <Users /> Pede Junto Adoce
            </button>
          )}
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "orders" && commercialTab === "finance" ? "active" : ""}
              onClick={() => openCommercial("finance")}
            >
              <CircleDollarSign /> Financeiro
            </button>
          )}
          <small className="operation-nav-group">Produtos e disponibilidade</small>
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "catalog" ? "active" : ""}
              onClick={() => void openView("catalog")}
            >
              <Settings2 /> Produtos e serviços
            </button>
          )}
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "content" ? "active" : ""}
              onClick={() => {
                setContentTab("today");
                void openView("content");
              }}
            >
              <Settings2 /> Disponibilidade, horários e site
            </button>
          )}
          <small className="operation-nav-group">Administração</small>
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "orders" && commercialTab === "settings" ? "active" : ""}
              onClick={() => openCommercial("settings")}
            >
              <Settings2 /> Configurações globais
            </button>
          )}
          {(role === "owner" || role === "manager") && (
            <button
              className={view === "archive" ? "active" : ""}
              onClick={() => void openView("archive")}
            >
              <Archive /> Histórico e arquivados
            </button>
          )}
          <button
            className={view === "team" ? "active" : ""}
            onClick={() => void openView("team")}
          >
            <ShieldCheck /> Equipe
          </button>
          {role === "owner" && (
            <button
              className={view === "director-plan" ? "active" : ""}
              onClick={() => void openView("director-plan")}
            >
              <ClipboardCheck /> Plano Diretor
            </button>
          )}
          {role === "owner" && (
            <button
              className={view === "security" ? "active" : ""}
              onClick={() => void openView("security")}
            >
              <RotateCcw /> Restaurar produção
            </button>
          )}
        </aside>
        <section className="operation-work">
          {view === "dashboard" && (
            <Suspense fallback={<p>Carregando visão da operação…</p>}>
              <OperationDashboard
                onNavigate={(destination) => {
                  if (destination === "customers") {
                    void openView("attend");
                    return;
                  }
                  if (destination === "catalog") {
                    void openView("catalog");
                    return;
                  }
                  if (destination === "content") {
                    setContentTab("operation");
                    void openView("content");
                    return;
                  }
                  openCommercial(destination);
                }}
              />
            </Suspense>
          )}
          {view === "attend" && (
            <>
              <div className="operation-title">
                <div>
                  <span>Clientes e fidelidade</span>
                  <h1>Clientes & Clube Adoce</h1>
                  <p>
                    Localize um cliente, leia o QR do cartão ou consulte a lista completa em um só lugar.
                  </p>
                </div>
                <div className="operation-role">
                  <Check /> Acesso verificado
                </div>
              </div>
              <div className="operation-member-counts" aria-label="Quantidade de clientes cadastrados">
                <strong><b>{memberCounts.total}</b><span>clientes cadastrados</span></strong>
                <span><b>{memberCounts.active}</b> ativos</span>
                <span><b>{memberCounts.deactivated}</b> desativados</span>
                <span><b>{memberCounts.pending}</b> aguardando análise</span>
              </div>
              <div className="operation-search-row">
                <form
                  className="operation-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void search();
                  }}
                >
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome, telefone ou código"
                  />
                  <button disabled={busy}>
                    {busy ? "Buscando..." : "Buscar"}
                  </button>
                </form>
                <button
                  className="operation-scan-button"
                  onClick={() => void startScanner()}
                >
                  <Camera /> Ler QR do membro
                </button>
              </div>
              {!selected ? (
                customerList
              ) : (
                <div className="operation-customer print-scope">
                  <button
                    className="back"
                    onClick={() => {
                      setSelected(null);
                      setGeneratedAccess(null);
                    }}
                  >
                    ← Voltar à busca
                  </button>
                  <button type="button" className="drawer-print customer-print" onClick={() => printOperation("a4")}><Printer /> A4 ou salvar em PDF</button>
                  <div className="customer-top">
                    <span className="avatar">{selected.full_name[0]}</span>
                    <div>
                      <small>Membro do Clube Adoce</small>
                      {editingCustomerName ? <div className="customer-name-editor">
                        <input value={customerNameDraft} onChange={(event) => setCustomerNameDraft(event.target.value)} aria-label="Nome completo do cliente" />
                        <button type="button" onClick={() => void saveCustomerName()} disabled={busy || !isRealCustomerName(customerNameDraft)}><Check /> Salvar nome</button>
                        <button type="button" onClick={() => { setEditingCustomerName(false); setCustomerNameDraft(selected.full_name); }}>Cancelar</button>
                      </div> : <div className="customer-name-display">
                        <h2>{selected.full_name}</h2>
                        {["owner", "manager"].includes(role) ? <button type="button" onClick={() => setEditingCustomerName(true)}>Editar nome</button> : null}
                      </div>}
                      <p>{selected.phone_e164 || selected.email}</p>
                      <p className="customer-member-code">
                        Código do Membro: <strong>{selected.member_code}</strong>
                      </p>
                      <p className={`customer-account-status status-${selected.account_status}`}>
                        {selected.account_status === "active" ? "Cadastro ativo" : selected.account_status === "pending_deletion" ? "Aguardando decisão da Adoce: excluir ou reativar" : "Cadastro desativado"}
                      </p>
                    </div>
                    <div className="customer-progress">
                      <small>Meus Carimbos</small>
                      <strong>{selected.current_progress}</strong>
                      <span>de 14 carimbos</span>
                    </div>
                  </div>
                  <div className="customer-balance" aria-label="Resumo da fidelidade">
                    <span>
                      <strong>{selected.current_progress} de 14</strong>
                      <small>carimbos no Cartão Clube Adoce</small>
                    </span>
                    <span>
                      <strong>{selected.completed_cards}</strong>
                      <small>cartão(ões) preenchido(s)</small>
                    </span>
                    <span>
                      <strong>{selected.available_rewards}</strong>
                      <small>fatia(s) grátis disponível(is)</small>
                    </span>
                  </div>
                  {role !== "viewer" && (
                    <section
                      className="customer-access-help"
                      data-testid="customer-access-help"
                    >
                      <div className="customer-access-copy">
                        <KeyRound />
                        <span>
                          <small>Ajuda para entrar no Clube</small>
                          <strong>Gerar código de acesso temporário</strong>
                          <p>
                            Use quando o membro não conseguir receber o código
                            por e-mail. O link abre o Clube já autenticado e a
                            geração fica registrada na auditoria.
                          </p>
                        </span>
                      </div>
                      {!generatedAccess ? (
                        <button
                          className="access-secondary"
                          onClick={() => void issueAccessCode()}
                          disabled={busy || !selected.email}
                        >
                          <KeyRound />
                          {selected.email
                            ? "Gerar código de acesso"
                            : "Membro sem e-mail"}
                        </button>
                      ) : (
                        <div className="customer-access-result">
                          <span className="generated-access-code" aria-label="Código gerado">
                            {generatedAccess.code}
                          </span>
                          <button
                            className="access-secondary"
                            onClick={() => void copyGeneratedAccess()}
                          >
                            <Copy /> Copiar mensagem
                          </button>
                          <a
                            className="access-secondary"
                            href={generatedAccess.loginUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ArrowRight /> Testar link direto
                          </a>
                          {staffAccessWhatsAppUrl(generatedAccess) && (
                            <a
                              className="access-primary"
                              href={staffAccessWhatsAppUrl(generatedAccess) || undefined}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle /> Enviar pelo WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                  {["owner", "manager"].includes(role) && (
                    <section className="customer-account-admin">
                      <div>
                        <ShieldCheck />
                        <span>
                          <small>Segurança e privacidade</small>
                          <strong>Desativar, reativar ou excluir o cadastro</strong>
                          <p>Excluir remove definitivamente o acesso e os dados pessoais, mas preserva carimbos, pedidos e auditoria sem identificação pessoal.</p>
                        </span>
                      </div>
                      <div className="password-reset-row">
                        <span>
                          <small>Acesso do cliente</small>
                          <strong>Redefinir senha pelo celular</strong>
                          <p>
                            Cria a senha temporária 123456@adoce e exige que o
                            cliente escolha uma nova senha ao entrar.
                          </p>
                        </span>
                        <button
                          type="button"
                          className="access-secondary"
                          onClick={() =>
                            void resetAccessPassword(
                              selected.profile_id,
                              "customer",
                              selected.full_name,
                            )
                          }
                          disabled={busy}
                        >
                          <KeyRound /> Redefinir senha
                        </button>
                      </div>
                      {passwordResetNotice?.targetUserId ===
                        selected.profile_id && (
                        <div className="password-reset-result" role="status">
                          <strong>Senha temporária criada</strong>
                          <code>
                            {passwordResetNotice.temporaryPassword}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyTemporaryPassword()}
                          >
                            <Copy /> Copiar instruções
                          </button>
                        </div>
                      )}
                      <label>
                        Ação
                        <select value={accountAction} onChange={(event) => setAccountAction(event.target.value as CustomerAccountAction)}>
                          <option value="deactivate">Desativar acesso</option>
                          <option value="delete_account">Excluir cadastro agora</option>
                          <option value="request_deletion">Registrar pedido do cliente para decidir depois (não exclui agora)</option>
                          <option value="mark_duplicate">Marcar como cadastro duplicado</option>
                          <option value="reactivate">Reativar acesso</option>
                          <option value="cancel_deletion">Cancelar exclusão e reativar</option>
                        </select>
                      </label>
                      <label>
                        Motivo
                        <select value={accountReason} onChange={(event) => setAccountReason(event.target.value as CustomerAccountReason)}>
                          {customerAccountReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                        </select>
                      </label>
                      <label>
                        Observação interna
                        <textarea value={accountReasonNote} onChange={(event) => setAccountReasonNote(event.target.value)} placeholder="Explique o necessário sem incluir dados sensíveis desnecessários." />
                      </label>
                      <button className="access-secondary" onClick={() => void changeCustomerAccount()} disabled={busy || (accountReason === "other" && accountReasonNote.trim().length < 5)}>
                        <ShieldCheck /> Revisar e confirmar ação
                      </button>
                    </section>
                  )}
                  <div className="operation-actions">
                    <article>
                      <Plus />
                      <h3>Registrar compra</h3>
                      <p>
                        Cada fatia comprada vale um carimbo. Confira o saldo
                        antes de confirmar.
                      </p>
                      <div className="purchase-preview">
                        <span>
                          Antes <b>{selected.current_progress} de 14</b>
                        </span>
                        <ArrowRight />
                        <span>
                          Depois <b>{(selected.current_progress + qty) % 14} de 14</b>
                        </span>
                      </div>
                      <div className="stepper">
                        <button onClick={() => setQty(Math.max(1, qty - 1))}>
                          −
                        </button>
                        <strong>{qty}</strong>
                        <button onClick={() => setQty(Math.min(50, qty + 1))}>+</button>
                      </div>
                      <button
                        className="access-primary"
                        onClick={() => void purchase()}
                        disabled={busy}
                      >
                        Revisar e confirmar {qty} carimbo(s)
                      </button>
                    </article>
                    <article>
                      <Gift />
                      <h3>Resgatar fatia grátis</h3>
                      <p>
                        Fatia tradicional ou premium com pagamento da diferença.
                      </p>
                      <strong className="reward-total">
                        {selected.available_rewards} disponível(is)
                      </strong>
                      <button
                        className="access-secondary"
                        onClick={() => void redeem()}
                        disabled={busy || !selected.available_reward_id}
                      >
                        Confirmar fatia tradicional
                      </button>
                    </article>
                    {role === "owner" && (
                      <article className="owner-correction">
                        <RotateCcw />
                        <small>Ferramenta do proprietário</small>
                        <h3>Corrigir carimbos</h3>
                        <p>
                          Remova um lançamento incorreto sem apagar o histórico.
                        </p>
                        <div className="stepper">
                          <button
                            onClick={() =>
                              setCorrectionQty(Math.max(1, correctionQty - 1))
                            }
                          >
                            −
                          </button>
                          <strong>{correctionQty}</strong>
                          <button
                            onClick={() =>
                              setCorrectionQty(
                                Math.min(
                                  selected.completed_cards * 14 +
                                    selected.current_progress,
                                  correctionQty + 1,
                                ),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <label>
                          Motivo da correção
                          <input
                            value={correctionReason}
                            onChange={(event) => {
                              setCorrectionReason(event.target.value);
                              if (event.target.value.trim().length >= 5) {
                                setCorrectionError("");
                              }
                            }}
                            minLength={5}
                            required
                            aria-invalid={Boolean(correctionError)}
                            aria-describedby="correction-reason-help"
                            placeholder="Ex.: compra lançada em duplicidade"
                          />
                          <span
                            id="correction-reason-help"
                            className={correctionError ? "field-error" : "field-help"}
                            role={correctionError ? "alert" : undefined}
                          >
                            {correctionError ||
                              (correctionReason.trim().length > 0 &&
                              correctionReason.trim().length < 5
                                ? `Digite mais ${5 - correctionReason.trim().length} caractere(s).`
                                : "Informe um motivo claro com pelo menos 5 caracteres.")}
                          </span>
                        </label>
                        <button
                          className="access-secondary danger"
                          onClick={() => void correctStamps()}
                          disabled={
                            busy ||
                            selected.completed_cards * 14 +
                              selected.current_progress <
                              1
                          }
                        >
                          Remover {correctionQty} carimbo(s)
                        </button>
                      </article>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {view === "movements" && (
            <>
              <div className="operation-title">
                <div>
                  <span>Auditoria</span>
                  <h1>Movimentações</h1>
                  <p>Compras, indicações e ajustes mais recentes.</p>
                </div>
              </div>
              <div className="operation-simple-list">
                {movements.length ? (
                  movements.map((item) => (
                    <article key={item.id}>
                      <History />
                      <span>
                        <strong>
                          {{
                            purchase: "Compra registrada",
                            referral_referred: "Bônus para novo membro",
                            referral_referrer: "Bônus de indicação",
                            manual_adjustment: "Ajuste de carimbos",
                            reversal: "Correção de carimbos",
                            reward_redeemed: "Fatia grátis retirada",
                          }[item.reason] || "Movimentação do cartão"}
                        </strong>
                        <em>{item.customer_first_name}</em>
                        <small>
                          {new Date(item.created_at).toLocaleString("pt-BR")}
                        </small>
                      </span>
                      <b
                        className={
                          item.stamps_delta >= 0 ? "positive" : "negative"
                        }
                      >
                        {item.reason === "reward_redeemed"
                          ? "Fatia grátis entregue"
                          : `${item.stamps_delta > 0 ? "+" : ""}${item.stamps_delta} ${Math.abs(item.stamps_delta) === 1 ? "carimbo" : "carimbos"}`}
                      </b>
                    </article>
                  ))
                ) : (
                  <p>Nenhuma movimentação registrada ainda.</p>
                )}
              </div>
            </>
          )}
          {view === "team" && (
            <>
              <div className="operation-title">
                <div>
                  <span>Acessos</span>
                  <h1>Equipe</h1>
                  <p>Proprietários, gerentes e atendimento autorizados.</p>
                </div>
              </div>
              <div className="operation-simple-list">
                {team.map((member) => (
                  <article key={member.user_id}>
                    <ShieldCheck />
                    <span>
                      <strong>{member.display_name}</strong>
                      <small>
                        {member.role === "owner"
                          ? "Proprietário"
                          : member.role === "manager"
                            ? "Gerente"
                            : "Atendimento"}
                      </small>
                      {member.must_change_password && (
                        <small>Troca de senha obrigatória no próximo acesso</small>
                      )}
                    </span>
                    <div className="team-member-actions">
                      <b>{member.active ? "Ativo" : "Inativo"}</b>
                      {["owner", "manager"].includes(role) &&
                        member.active && (
                          <button
                            type="button"
                            className="access-secondary"
                            onClick={() =>
                              void resetAccessPassword(
                                member.user_id,
                                "staff",
                                member.display_name || "Membro da equipe",
                              )
                            }
                            disabled={busy}
                          >
                            <KeyRound /> Redefinir senha
                          </button>
                        )}
                    </div>
                  </article>
                ))}
              </div>
              {passwordResetNotice &&
                team.some(
                  (member) =>
                    member.user_id === passwordResetNotice.targetUserId,
                ) && (
                  <div className="password-reset-result" role="status">
                    <strong>
                      Acesso temporário de {passwordResetNotice.fullName}
                    </strong>
                    <code>{passwordResetNotice.temporaryPassword}</code>
                    <span>
                      A pessoa entrará com o celular cadastrado e deverá criar
                      uma nova senha.
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyTemporaryPassword()}
                    >
                      <Copy /> Copiar instruções
                    </button>
                  </div>
                )}
            </>
          )}
          {view === "content" && (
            <Suspense fallback={<p>Carregando administração...</p>}>
              <OperationContentAdmin
                key={contentTab}
                session={session}
                role={role}
                initialTab={contentTab}
              />
            </Suspense>
          )}
          {view === "orders" && (role === "owner" || role === "manager") && (
            <Suspense fallback={<p>Carregando agenda e CRM...</p>}>
              <OperationCommercialAdmin
                session={session}
                role={role}
                initialTab={commercialTab}
                onTabChange={setCommercialTab}
                onOpenContent={() => void openView("content")}
              />
            </Suspense>
          )}
          {view === "catalog" && (role === "owner" || role === "manager") && (
            <Suspense fallback={<p>Carregando catálogo e mídias...</p>}>
              <OperationCommercialAdmin
                session={session}
                role={role}
                initialTab="catalog"
                onOpenContent={() => void openView("content")}
              />
            </Suspense>
          )}
          {view === "archive" && (role === "owner" || role === "manager") && (
            <Suspense fallback={<p>Carregando histórico...</p>}>
              <OperationArchive />
            </Suspense>
          )}
          {view === "security" && role === "owner" && (
            <ProductionRollbackPanel accessToken={session.access_token} />
          )}
          {view === "director-plan" && role === "owner" && (
            <Suspense fallback={<p>Carregando validação do projeto...</p>}>
              <DirectorPlanChecklist session={session} />
            </Suspense>
          )}
          {scannerOpen && (
            <div
              className="operation-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Leitor de QR"
            >
              <div className="scanner-card">
                <button
                  className="modal-close"
                  onClick={stopScanner}
                  aria-label="Fechar leitor"
                >
                  <X />
                </button>
                <QrCode />
                <h2>Leia o QR do membro</h2>
                <p>
                  Centralize o código na câmera. O membro abrirá
                  automaticamente.
                </p>
                <div className="scanner-video">
                  <video ref={videoRef} muted playsInline />
                  {scannerStarting && <span>Abrindo a câmera...</span>}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void lookupCustomerQr(manualQr);
                  }}
                >
                  <label>
                    Ou cole o conteúdo do QR
                    <input
                      value={manualQr}
                      onChange={(event) => setManualQr(event.target.value)}
                      placeholder="Link ou código do cartão"
                    />
                  </label>
                  <button className="access-secondary" disabled={busy}>
                    Localizar
                  </button>
                </form>
              </div>
            </div>
          )}
          {installGuideOpen && (
            <div
              className="operation-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Como instalar o aplicativo"
            >
              <div className="install-modal">
                <InstallGuide
                  {...installApp}
                  appName="o Adoce Operação"
                  onInstall={installApp.install}
                  onClose={() => setInstallGuideOpen(false)}
                />
              </div>
            </div>
          )}
          {message && (
            <div className="operation-toast">
              <Check />
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AccessApp({ surface }: { surface: Surface }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const supabase = requireSupabase();
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const title = useMemo(
    () => (surface === "operation" ? "Adoce Operação" : "Clube Adoce"),
    [surface],
  );
  useEffect(() => {
    document.title = title;
    const manifest = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    if (manifest)
      manifest.href =
        surface === "operation"
          ? "/manifest-operacao.webmanifest"
          : "/manifest-clube.webmanifest";
    const iconHref =
      surface === "operation"
        ? "/pwa/operacao/icon-192.png"
        : "/pwa/clube/icon-192.png";
    const appleIconHref =
      surface === "operation"
        ? "/pwa/operacao/apple-touch-icon.png"
        : "/pwa/clube/apple-touch-icon.png";
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const appleIcon = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );
    const appleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (icon) icon.href = iconHref;
    if (appleIcon) appleIcon.href = appleIconHref;
    if (appleTitle) appleTitle.content = title;
  }, [surface, title]);
  if (session === undefined)
    return (
      <main className="access-loading">
        <Brand label={title} />
        <p>Abrindo com segurança...</p>
      </main>
    );
  if (!session) return <AuthScreen surface={surface} />;
  return surface === "operation" ? (
    <OperationHome session={session} />
  ) : (
    <CustomerHome session={session} />
  );
}
