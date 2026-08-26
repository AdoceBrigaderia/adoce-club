import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Filter,
  Home,
  LogOut,
  Menu,
  PackageCheck,
  PackageOpen,
  Phone,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import {
  formatOperationCurrency,
  INITIAL_OPERATION_TASKS,
  OPERATION_STATUS_LABELS,
  OPERATION_STATUS_ORDER,
  type OperationTask,
  type OperationTaskStatus,
} from "./operation-v2-data";
import "./operation-v2.css";

type OperationSection =
  | "today"
  | "sales"
  | "orders"
  | "customers"
  | "products"
  | "finance"
  | "management";

const NAVIGATION: Array<{
  id: OperationSection;
  label: string;
  icon: typeof Home;
}> = [
  { id: "today", label: "Hoje", icon: Home },
  { id: "sales", label: "Vendas", icon: ShoppingCart },
  { id: "orders", label: "Encomendas", icon: PackageCheck },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "products", label: "Produtos e estoque", icon: PackageOpen },
  { id: "finance", label: "Financeiro", icon: CircleDollarSign },
  { id: "management", label: "Gestão", icon: Settings },
];

const NEXT_STATUS: Partial<Record<OperationTaskStatus, OperationTaskStatus>> = {
  confirmation: "payment",
  payment: "separating",
  separating: "ready",
  ready: "scheduled",
};

const STATUS_ACTION: Record<OperationTaskStatus, string> = {
  confirmation: "Confirmar pedido",
  payment: "Enviar cobrança",
  separating: "Marcar como pronto",
  ready: "Confirmar retirada",
  scheduled: "Abrir encomenda",
};

function Brand() {
  return (
    <a className="opv2-brand" href="/#operacao-v2" aria-label="Início da Adoce Operação">
      <img src="/site/logo.webp" alt="" />
      <strong>Adoce Operação</strong>
    </a>
  );
}

function Sidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: OperationSection;
  onNavigate: (section: OperationSection) => void;
}) {
  return (
    <aside className="opv2-sidebar">
      <Brand />
      <nav aria-label="Navegação da operação">
        {NAVIGATION.map(({ id, label, icon: Icon }) => (
          <button
            className={activeSection === id ? "is-active" : ""}
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button className="opv2-owner" type="button" aria-label="Abrir perfil de Rubens">
        <span className="opv2-avatar">R</span>
        <span>
          <strong>Rubens</strong>
          <small>Proprietário</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
    </aside>
  );
}

function Topbar({
  unreadAlerts,
  onToggleAlerts,
}: {
  unreadAlerts: number;
  onToggleAlerts: () => void;
}) {
  return (
    <header className="opv2-topbar">
      <div className="opv2-mobile-brand">
        <Brand />
      </div>
      <h1>Hoje</h1>
      <div className="opv2-topbar-actions">
        <button
          className="opv2-alert-trigger"
          type="button"
          aria-label={`${unreadAlerts} alertas pendentes`}
          onClick={onToggleAlerts}
        >
          <Bell aria-hidden="true" />
          {unreadAlerts > 0 ? <span>{unreadAlerts}</span> : null}
        </button>
        <button className="opv2-profile" type="button">
          <span>
            <strong>Rubens</strong>
            <small>Proprietário</small>
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
        <button className="opv2-logout" type="button">
          <span>Sair</span>
          <LogOut aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function AttentionCards({
  confirmationCount,
  lowStockCount,
  onConfirmProduction,
  onNewSale,
}: {
  confirmationCount: number;
  lowStockCount: number;
  onConfirmProduction: () => void;
  onNewSale: () => void;
}) {
  return (
    <section className="opv2-attention" aria-labelledby="opv2-attention-title">
      <h2 id="opv2-attention-title">O que precisa da sua atenção</h2>
      <div>
        <button className="opv2-attention-card is-urgent" type="button">
          <Menu aria-hidden="true" />
          <span>
            <strong>Fila urgente</strong>
            <b>3</b>
            <small>pedidos atrasados</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button className="opv2-attention-card" type="button" onClick={onConfirmProduction}>
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>Confirmar produção</strong>
            <b>{confirmationCount}</b>
            <small>itens aguardando confirmação</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button className="opv2-attention-card" type="button">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>Estoque baixo</strong>
            <b>{lowStockCount}</b>
            <small>produtos com estoque baixo</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button className="opv2-new-sale" type="button" onClick={onNewSale}>
          <Plus aria-hidden="true" />
          <span>Nova venda</span>
        </button>
      </div>
    </section>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: OperationTask;
  selected?: boolean;
  onSelect: (taskId: string) => void;
}) {
  return (
    <button
      className={`opv2-task-row${selected ? " is-selected" : ""}`}
      type="button"
      onClick={() => onSelect(task.id)}
    >
      <span className="opv2-task-number">#{task.id}</span>
      <span className="opv2-task-person">
        <strong>{task.customer}</strong>
        <small>{task.product}</small>
      </span>
      <span className="opv2-task-meta">
        <small>{task.time}</small>
        <strong>{formatOperationCurrency(task.amount)}</strong>
      </span>
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

function DesktopBoard({
  tasks,
  onSelect,
}: {
  tasks: OperationTask[];
  onSelect: (taskId: string) => void;
}) {
  return (
    <section className="opv2-desktop-board" aria-label="Pedidos por etapa">
      {OPERATION_STATUS_ORDER.map((status) => {
        const grouped = tasks.filter((task) => task.status === status);
        return (
          <article key={status}>
            <header>
              <h3>{OPERATION_STATUS_LABELS[status]}</h3>
              <strong>{grouped.length}</strong>
            </header>
            <div>
              {grouped.length ? (
                grouped.map((task) => (
                  <TaskRow key={task.id} task={task} onSelect={onSelect} />
                ))
              ) : (
                <p className="opv2-empty-column">Nenhum pedido nesta etapa.</p>
              )}
            </div>
            <button className="opv2-view-all" type="button">
              Ver todos <ChevronRight aria-hidden="true" />
            </button>
          </article>
        );
      })}
    </section>
  );
}

function TaskDetail({
  task,
  onAdvance,
  onClose,
}: {
  task: OperationTask;
  onAdvance: (taskId: string) => void;
  onClose?: () => void;
}) {
  return (
    <article className="opv2-task-detail" aria-label={`Pedido ${task.id} de ${task.customer}`}>
      {onClose ? (
        <button className="opv2-detail-close" type="button" onClick={onClose} aria-label="Fechar detalhes">
          <X aria-hidden="true" />
        </button>
      ) : null}
      <header>
        <div>
          <span>
            #{task.id}
            <small>{OPERATION_STATUS_LABELS[task.status]}</small>
          </span>
          <h2>{task.customer}</h2>
          <p>Hoje, {task.time}</p>
        </div>
        <div>
          <strong>{formatOperationCurrency(task.amount)}</strong>
          <small>Total do pedido</small>
        </div>
      </header>
      <section className="opv2-detail-body">
        <div className="opv2-next-action">
          <h3>Próxima ação recomendada</h3>
          <button className="opv2-primary-action" type="button" onClick={() => onAdvance(task.id)}>
            <Check aria-hidden="true" />
            {STATUS_ACTION[task.status]}
            <ChevronRight aria-hidden="true" />
          </button>
          {task.status === "payment" ? (
            <button className="opv2-secondary-action" type="button" onClick={() => onAdvance(task.id)}>
              <CircleDollarSign aria-hidden="true" />
              Finalizar sem cobrança
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
          <a className="opv2-secondary-action" href={`https://wa.me/55${task.phone.replace(/\D/g, "")}`}>
            <Phone aria-hidden="true" />
            Falar com a cliente
            <ChevronRight aria-hidden="true" />
          </a>
        </div>
        <div className="opv2-history">
          <h3>Histórico</h3>
          {OPERATION_STATUS_ORDER.slice(0, 5).map((status, index) => {
            const currentIndex = OPERATION_STATUS_ORDER.indexOf(task.status);
            return (
              <div className={index <= currentIndex ? "is-complete" : ""} key={status}>
                <span>{index <= currentIndex ? <Check /> : <Clock3 />}</span>
                <p>
                  <strong>{OPERATION_STATUS_LABELS[status]}</strong>
                  <small>{index <= currentIndex ? task.time : "—"}</small>
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <footer>
        <div>
          <h3>Itens do pedido</h3>
          <p>
            <span>1× {task.product}</span>
            <strong>{formatOperationCurrency(task.amount)}</strong>
          </p>
        </div>
        <div>
          <h3>Cliente</h3>
          <p>{task.customer}</p>
          <p>{task.phone}</p>
          <p>Clube: {task.clubMember ? "Sim" : "Não"}</p>
        </div>
        <div>
          <h3>Informações</h3>
          <p>Retirada: hoje, {task.time}</p>
          <p>{task.note || "Sem observações no pedido."}</p>
        </div>
      </footer>
    </article>
  );
}

function TabletWorkbench({
  tasks,
  selectedTask,
  onSelect,
  onAdvance,
  onNewSale,
}: {
  tasks: OperationTask[];
  selectedTask: OperationTask;
  onSelect: (taskId: string) => void;
  onAdvance: (taskId: string) => void;
  onNewSale: () => void;
}) {
  const groupedTasks = useMemo(
    () =>
      OPERATION_STATUS_ORDER.map((status) => ({
        status,
        tasks: tasks.filter((task) => task.status === status),
      })),
    [tasks],
  );

  return (
    <section className="opv2-tablet-workbench">
      <div className="opv2-work-queue">
        <h2>Fila de trabalho</h2>
        <label>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Buscar pedido ou cliente" />
          <button type="button" aria-label="Filtrar fila">
            <Filter aria-hidden="true" />
          </button>
        </label>
        <button className="opv2-queue-alert" type="button">
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>Confirmar produção</strong>
            <small>2 itens aguardando confirmação</small>
          </span>
          <b>2</b>
          <ChevronRight aria-hidden="true" />
        </button>
        <button className="opv2-queue-alert" type="button">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>Estoque baixo</strong>
            <small>5 produtos com estoque baixo</small>
          </span>
          <b>5</b>
          <ChevronRight aria-hidden="true" />
        </button>
        {groupedTasks.map(({ status, tasks: statusTasks }) => (
          <section className="opv2-queue-group" key={status}>
            <header>
              <h3>{OPERATION_STATUS_LABELS[status]}</h3>
              <span>{statusTasks.length}</span>
              <ChevronDown aria-hidden="true" />
            </header>
            {statusTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={selectedTask.id === task.id}
                onSelect={onSelect}
              />
            ))}
          </section>
        ))}
      </div>
      <div className="opv2-tablet-detail">
        <button className="opv2-new-sale opv2-tablet-new-sale" type="button" onClick={onNewSale}>
          <Plus aria-hidden="true" /> Nova venda
        </button>
        <TaskDetail task={selectedTask} onAdvance={onAdvance} />
      </div>
      <div className="opv2-tablet-portrait-detail">
        <TaskDetail task={selectedTask} onAdvance={onAdvance} />
      </div>
    </section>
  );
}

function MobileAgenda({
  tasks,
  onSelect,
  onConfirmProduction,
  onNewSale,
}: {
  tasks: OperationTask[];
  onSelect: (taskId: string) => void;
  onConfirmProduction: () => void;
  onNewSale: () => void;
}) {
  const paymentCount = tasks.filter((task) => task.status === "payment").length;
  const separatingCount = tasks.filter((task) => task.status === "separating").length;
  const readyCount = tasks.filter((task) => task.status === "ready").length;
  const scheduledCount = tasks.filter((task) => task.status === "scheduled").length;
  return (
    <section className="opv2-mobile-agenda">
      <header>
        <h1>Hoje</h1>
        <p>O dia da Adoce em ordem</p>
      </header>
      <button className="opv2-new-sale" type="button" onClick={onNewSale}>
        <Plus aria-hidden="true" /> Nova venda
      </button>
      <section className="opv2-timeline">
        <h2>Agora</h2>
        <article className="opv2-mobile-priority">
          <time>09:45</time>
          <div>
            <header>
              <CalendarDays aria-hidden="true" />
              <span>
                <strong>Confirmar produção planejada</strong>
                <small>Torta Red Velvet e Brownies (caixa)</small>
              </span>
              <b>2 itens</b>
            </header>
            <button type="button" onClick={onConfirmProduction}>
              <Check aria-hidden="true" /> Confirmar produção <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </article>
        <button type="button" onClick={() => onSelect(tasks.find((task) => task.status === "payment")?.id || tasks[0].id)}>
          <time>09:45</time>
          <CircleDollarSign aria-hidden="true" />
          <span>Aguardando pagamento <small>{paymentCount} pedidos</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onSelect(tasks.find((task) => task.status === "separating")?.id || tasks[0].id)}>
          <time>09:30</time>
          <PackageOpen aria-hidden="true" />
          <span>Separar pedido <small>{separatingCount} pedidos</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onSelect(tasks.find((task) => task.status === "ready")?.id || tasks[0].id)}>
          <time>09:00</time>
          <PackageCheck aria-hidden="true" />
          <span>Pronto para retirada <small>{readyCount} pedido</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
      <section className="opv2-mobile-section">
        <h2>Próximas retiradas</h2>
        <button type="button">
          <Clock3 aria-hidden="true" />
          <span>Retirada: {readyCount} pedido</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
      <section className="opv2-mobile-section">
        <h2>Encomendas de hoje</h2>
        <button type="button">
          <CalendarDays aria-hidden="true" />
          <span>{scheduledCount} pedidos</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
      <section className="opv2-mobile-section">
        <h2>Pendências</h2>
        <button type="button">
          <AlertTriangle aria-hidden="true" />
          <span>Estoque baixo <small>5 produtos</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
    </section>
  );
}

function BottomNavigation({
  activeSection,
  onNavigate,
}: {
  activeSection: OperationSection;
  onNavigate: (section: OperationSection) => void;
}) {
  const items = NAVIGATION.slice(0, 4);
  return (
    <nav className="opv2-bottom-nav" aria-label="Navegação principal">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          className={activeSection === id ? "is-active" : ""}
          key={id}
          type="button"
          onClick={() => onNavigate(id)}
        >
          <Icon aria-hidden="true" />
          <span>{id === "orders" ? "Pedidos" : label}</span>
        </button>
      ))}
      <button type="button" onClick={() => onNavigate("management")}>
        <Menu aria-hidden="true" />
        <span>Mais</span>
      </button>
    </nav>
  );
}

export default function OperationV2Demo() {
  const [activeSection, setActiveSection] = useState<OperationSection>("today");
  const [tasks, setTasks] = useState(INITIAL_OPERATION_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState("1043");
  const [detailOpen, setDetailOpen] = useState(false);
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [productionConfirmed, setProductionConfirmed] = useState(false);

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) || tasks[0];
  const confirmationCount = productionConfirmed ? 0 : 2;

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailOpen(true);
  };

  const handleAdvance = (taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId && NEXT_STATUS[task.status]
          ? { ...task, status: NEXT_STATUS[task.status]! }
          : task,
      ),
    );
  };

  return (
    <main className="opv2-app">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
      <div className="opv2-main">
        <Topbar
          unreadAlerts={productionConfirmed ? 1 : 2}
          onToggleAlerts={() => setAlertsOpen((open) => !open)}
        />
        <div className="opv2-content">
          <AttentionCards
            confirmationCount={confirmationCount}
            lowStockCount={5}
            onConfirmProduction={() => setProductionConfirmed(true)}
            onNewSale={() => setNewSaleOpen(true)}
          />
          <DesktopBoard tasks={tasks} onSelect={handleSelectTask} />
          <TabletWorkbench
            tasks={tasks}
            selectedTask={selectedTask}
            onSelect={handleSelectTask}
            onAdvance={handleAdvance}
            onNewSale={() => setNewSaleOpen(true)}
          />
          <MobileAgenda
            tasks={tasks}
            onSelect={handleSelectTask}
            onConfirmProduction={() => setProductionConfirmed(true)}
            onNewSale={() => setNewSaleOpen(true)}
          />
        </div>
      </div>
      <BottomNavigation activeSection={activeSection} onNavigate={setActiveSection} />

      {alertsOpen ? (
        <aside className="opv2-alert-popover" aria-label="Alertas da operação">
          <header>
            <h2>Alertas</h2>
            <button type="button" onClick={() => setAlertsOpen(false)} aria-label="Fechar alertas">
              <X aria-hidden="true" />
            </button>
          </header>
          {!productionConfirmed ? (
            <button type="button" onClick={() => setProductionConfirmed(true)}>
              <CalendarDays aria-hidden="true" />
              <span>
                <strong>Confirmar produção planejada</strong>
                <small>2 itens precisam da sua confirmação.</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
          <button type="button">
            <AlertTriangle aria-hidden="true" />
            <span>
              <strong>Estoque baixo</strong>
              <small>5 produtos precisam de atenção.</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        </aside>
      ) : null}

      {detailOpen ? (
        <div className="opv2-detail-overlay" role="presentation">
          <TaskDetail
            task={selectedTask}
            onAdvance={handleAdvance}
            onClose={() => setDetailOpen(false)}
          />
        </div>
      ) : null}

      {newSaleOpen ? (
        <div className="opv2-modal-backdrop" role="presentation">
          <section className="opv2-new-sale-modal" role="dialog" aria-modal="true" aria-labelledby="opv2-new-sale-title">
            <header>
              <div>
                <h2 id="opv2-new-sale-title">Nova venda</h2>
                <p>Registre uma venda feita no atendimento.</p>
              </div>
              <button type="button" onClick={() => setNewSaleOpen(false)} aria-label="Fechar nova venda">
                <X aria-hidden="true" />
              </button>
            </header>
            <label>
              Cliente ou telefone
              <input autoFocus placeholder="Nome ou WhatsApp" />
            </label>
            <label>
              Produto
              <select defaultValue="">
                <option value="" disabled>Selecione um produto</option>
                <option>Fatia Chocolatudo Supremo</option>
                <option>Fatia Trufado de Ninho</option>
                <option>Encomenda</option>
              </select>
            </label>
            <button className="opv2-primary-action" type="button" onClick={() => setNewSaleOpen(false)}>
              Continuar venda <ChevronRight aria-hidden="true" />
            </button>
          </section>
        </div>
      ) : null}

      {productionConfirmed ? (
        <div className="opv2-toast" role="status">
          <Check aria-hidden="true" />
          Produção confirmada para conferência do estoque.
        </div>
      ) : null}
    </main>
  );
}
