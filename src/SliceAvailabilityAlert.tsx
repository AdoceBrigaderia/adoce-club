import { FormEvent, useMemo, useState } from "react";
import { BellRing, Check, X } from "lucide-react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import "./slice-availability-alert.css";

type Result = { accepted: boolean; subscription_id: string; cancel_token: string; flavor_name: string };
type SavedAlert = { subscriptionId: string; cancelToken: string; flavorName: string };

export default function SliceAvailabilityAlert({ flavorId, flavorName, onClose }: { flavorId: string; flavorName: string; onClose: () => void }) {
  const storageKey = `adoce-slice-alert-${flavorId}`;
  const savedAlert = useMemo<SavedAlert | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) as SavedAlert : null;
    } catch {
      return null;
    }
  }, [storageKey]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (firstName.trim().length < 2 || lastName.trim().length < 2 || phone.replace(/\D/g, "").length < 10) {
      setNotice("Informe nome, sobrenome e WhatsApp com DDD.");
      return;
    }
    if (!isSupabaseConfigured) { setNotice("O aviso ainda não está disponível neste ambiente."); return; }
    setBusy(true); setNotice("");
    const { data, error } = await requireSupabase().rpc("subscribe_slice_availability_alert", {
      requested_flavor_id: flavorId,
      requested_first_name: firstName,
      requested_last_name: lastName,
      requested_phone: phone,
    });
    setBusy(false);
    if (error) { setNotice(error.message || "Não foi possível registrar o aviso."); return; }
    const result = data as Result;
    localStorage.setItem(storageKey, JSON.stringify({
      subscriptionId: result.subscription_id,
      cancelToken: result.cancel_token,
      flavorName: result.flavor_name,
    } satisfies SavedAlert));
    setDone(true);
  };
  const cancel = async () => {
    if (!savedAlert || !isSupabaseConfigured) return;
    setBusy(true); setNotice("");
    const { data, error } = await requireSupabase().rpc("cancel_slice_availability_alert", {
      cancel_token: savedAlert.cancelToken,
    });
    setBusy(false);
    if (error || data !== true) {
      setNotice("Não foi possível cancelar o aviso agora.");
      return;
    }
    localStorage.removeItem(storageKey);
    setCancelled(true);
  };
  return <div className="slice-alert-modal" role="dialog" aria-modal="true" aria-label={`Aviso de disponibilidade de ${flavorName}`} onClick={onClose}>
    <section onClick={(event) => event.stopPropagation()}>
      <button className="slice-alert-close" type="button" onClick={onClose} aria-label="Fechar"><X /></button>
      {cancelled ? <div className="slice-alert-success"><Check /><p>Aviso cancelado</p><h2>Você não receberá mais este aviso.</h2><button type="button" onClick={onClose}>Continuar vendo as fatias</button></div> : done ? <div className="slice-alert-success"><Check /><p>Aviso registrado</p><h2>Vamos avisar quando {flavorName} voltar.</h2><span>Você receberá a mensagem no WhatsApp informado.</span><button type="button" onClick={onClose}>Continuar vendo as fatias</button></div> : savedAlert ? <div className="slice-alert-success slice-alert-existing"><BellRing /><p>Aviso já solicitado</p><h2>Você já pediu para avisarmos quando {flavorName} voltar.</h2><span>Se mudou de ideia, pode cancelar este aviso agora.</span>{notice ? <small role="alert">{notice}</small> : null}<button className="slice-alert-cancel" type="button" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelando..." : "Cancelar este aviso"}</button><button className="slice-alert-secondary" type="button" onClick={onClose}>Manter aviso</button></div> : <>
        <BellRing />
        <p>Fatia indisponível no momento</p>
        <h2>Quer saber quando {flavorName} voltar?</h2>
        <span>Deixe seu contato. Quando a fatia estiver disponível, você receberá o link para escolher a calda e montar o pedido.</span>
        <form onSubmit={submit}>
          <label>Primeiro nome<input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" /></label>
          <label>Sobrenome<input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" /></label>
          <label className="wide">WhatsApp com DDD<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" /></label>
          {notice ? <small className="wide" role="alert">{notice}</small> : null}
          <button className="wide" disabled={busy}>{busy ? "Registrando..." : "Sim, quero receber o aviso"}</button>
        </form>
      </>}
    </section>
  </div>;
}
