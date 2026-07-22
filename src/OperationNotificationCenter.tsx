import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bell, BellRing, CheckCheck, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-notifications.css";

type OperationNotification = {
  id: string;
  event_type: string;
  priority: "urgent" | "important" | "informational";
  title: string;
  message: string;
  action_url: string;
  created_at: string;
};

const publicPushKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || "";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export default function OperationNotificationCenter({
  session,
  onNavigate,
}: {
  session: Session;
  onNavigate: (actionUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OperationNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const [deviceEnabled, setDeviceEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const centerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = requireSupabase();
    const [{ data: notifications, error }, { data: reads }] = await Promise.all([
      supabase
        .from("operation_notifications")
        .select("id,event_type,priority,title,message,action_url,created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("operation_notification_reads")
        .select("notification_id")
        .eq("user_id", session.user.id),
    ]);
    if (error) {
      setNotice("Os alertas ainda não puderam ser carregados.");
      return;
    }
    setItems((notifications || []) as OperationNotification[]);
    setReadIds(new Set((reads || []).map((read) => read.notification_id)));
  }, [session.user.id]);

  useEffect(() => {
    void load();
    const supabase = requireSupabase();
    const channel = supabase
      .channel(`operation-notifications-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "operation_notifications" },
        (payload) => {
          const notification = payload.new as OperationNotification;
          setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 60));
          if (
            document.visibilityState !== "visible" &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(notification.title, {
              body: "Abra a Operação Adoce para conferir com segurança.",
              icon: "/pwa/operacao/icon-192.png",
              tag: notification.id,
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, session.user.id]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!centerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  const unread = useMemo(() => items.filter((item) => !readIds.has(item.id)).length, [items, readIds]);

  const markRead = useCallback(async (notificationId: string) => {
    setReadIds((current) => new Set(current).add(notificationId));
    const { error } = await requireSupabase().from("operation_notification_reads").upsert({
      notification_id: notificationId,
      user_id: session.user.id,
      read_at: new Date().toISOString(),
    });
    if (error) {
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
      setNotice("Não foi possível marcar o alerta como lido.");
    }
  }, [session.user.id]);

  const markAllRead = useCallback(async () => {
    const pending = items.filter((item) => !readIds.has(item.id));
    if (!pending.length) return;
    const previous = readIds;
    setReadIds(new Set(items.map((item) => item.id)));
    const { error } = await requireSupabase().from("operation_notification_reads").upsert(
      pending.map((item) => ({
        notification_id: item.id,
        user_id: session.user.id,
        read_at: new Date().toISOString(),
      })),
    );
    if (error) {
      setReadIds(previous);
      setNotice("Não foi possível concluir esta ação.");
    }
  }, [items, readIds, session.user.id]);

  const enableDeviceNotifications = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotice("Este navegador não oferece notificações instaláveis.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotice("As notificações continuam bloqueadas neste aparelho.");
      return;
    }
    setDeviceEnabled(true);
    if (!publicPushKey || !("PushManager" in window)) {
      setNotice("Alertas ativados enquanto a Operação estiver aberta.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicPushKey),
      });
      const serialized = subscription.toJSON();
      const { error } = await requireSupabase().from("operation_push_subscriptions").upsert(
        {
          user_id: session.user.id,
          endpoint: serialized.endpoint,
          p256dh: serialized.keys?.p256dh,
          auth: serialized.keys?.auth,
          user_agent: navigator.userAgent,
          active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      setNotice("Notificações ativadas neste aparelho.");
    } catch {
      setNotice("O aparelho autorizou os alertas, mas a instalação precisa ser concluída.");
    }
  }, [session.user.id]);

  return (
    <div className="operation-notification-center" ref={centerRef}>
      <button
        className="operation-notification-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="operation-notification-panel"
        aria-label={unread ? `Abrir alertas: ${unread} não lidos` : "Abrir alertas"}
      >
        {unread ? <BellRing /> : <Bell />}
        <span>Alertas</span>
        {unread ? <strong>{unread > 99 ? "99+" : unread}</strong> : null}
      </button>
      {open ? (
        <section className="operation-notification-panel" id="operation-notification-panel">
          <header>
            <div><span>Operação em tempo real</span><h2>Alertas</h2></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar alertas"><X /></button>
          </header>
          <div className="operation-notification-actions">
            <button type="button" onClick={() => void enableDeviceNotifications()} disabled={deviceEnabled}>
              <Bell /> {deviceEnabled ? "Ativos neste aparelho" : "Ativar neste aparelho"}
            </button>
            {unread ? <button type="button" onClick={() => void markAllRead()}><CheckCheck /> Marcar todos como lidos</button> : null}
          </div>
          {notice ? <p className="operation-notification-notice" role="status">{notice}</p> : null}
          <div className="operation-notification-list">
            {items.length ? items.map((item) => (
              <button
                type="button"
                className={`${item.priority} ${readIds.has(item.id) ? "read" : "unread"}`}
                key={item.id}
                onClick={() => {
                  void markRead(item.id);
                  onNavigate(item.action_url);
                  setOpen(false);
                }}
              >
                <span className="operation-notification-dot" aria-hidden="true" />
                <span><strong>{item.title}</strong><small>{item.message}</small></span>
                <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
              </button>
            )) : <p className="operation-notification-empty">Tudo tranquilo por aqui. Os novos pedidos e ações importantes aparecerão neste espaço.</p>}
          </div>
        </section>
      ) : null}
    </div>
  );
}
