import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Camera, Check, MailPlus, MapPin, MessageCircle, Plus, Save, ShieldOff, Trash2, UserRound, X } from "lucide-react";
import ImageEditor, { type ImageEditorPreset } from "./ImageEditor";
import type { EditedProductImage } from "./admin-media";
import { requireSupabase } from "./lib/supabase";
import { formatarTelefoneBR } from "./lib/contato";
import { operationWhatsAppUrl } from "./operation-whatsapp";
import "./staff-profile-admin.css";

type StaffAccess = { user_id: string; role: string; active: boolean; display_name?: string };
type StaffProfile = {
  id: string;
  user_id: string | null;
  full_name: string;
  nickname: string;
  job_title: string;
  hired_on: string | null;
  active: boolean;
  mobile_phone: string;
  alternate_phone: string;
  postal_code: string;
  street: string;
  street_number: string;
  address_complement: string;
  neighborhood: string;
  city: string;
  state_code: string;
  notes: string;
  avatar_path: string | null;
};
type StaffEmail = { id?: string; email: string; is_primary: boolean };
type Draft = Omit<StaffProfile, "id"> & { id?: string; access_role: string };

const PHOTO_PRESET: ImageEditorPreset = {
  label: "Foto da equipe",
  description: "Recorte quadrado para avatar",
  aspectWidth: 1,
  aspectHeight: 1,
  outputWidth: 640,
};
const emptyDraft = (): Draft => ({
  user_id: null, full_name: "", nickname: "", job_title: "", hired_on: null,
  active: true, mobile_phone: "", alternate_phone: "", postal_code: "", street: "",
  street_number: "", address_complement: "", neighborhood: "", city: "", state_code: "",
  notes: "", avatar_path: null, access_role: "attendant",
});
const digits = (value: string) => value.replace(/\D/g, "");
const e164 = (value: string) => {
  const clean = digits(value);
  return clean.startsWith("55") ? clean : clean ? `55${clean}` : "";
};

export default function StaffProfileAdmin({ session, staff }: { session: Session; staff: StaffAccess[] }) {
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [emails, setEmails] = useState<StaffEmail[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await requireSupabase().from("staff_private_profiles").select("*").order("full_name");
    if (error) return setNotice(error.message);
    setProfiles((data || []) as StaffProfile[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const privateIds = new Set(profiles.map((profile) => profile.user_id).filter(Boolean));
    return [
      ...profiles.map((profile) => ({ key: profile.id, profile, access: staff.find((item) => item.user_id === profile.user_id) })),
      ...staff.filter((item) => !privateIds.has(item.user_id)).map((access) => ({ key: access.user_id, profile: null, access })),
    ];
  }, [profiles, staff]);

  const open = async (profile: StaffProfile | null, access?: StaffAccess) => {
    setNotice(""); setAvatarUrl(""); setEmails([]);
    setDraft(profile ? { ...profile, access_role: access?.role || "attendant" } : {
      ...emptyDraft(), user_id: access?.user_id || null, full_name: access?.display_name || "", access_role: access?.role || "attendant",
    });
    if (!profile) return;
    const [{ data: emailRows, error }, signed] = await Promise.all([
      requireSupabase().from("staff_private_emails").select("id,email,is_primary").eq("staff_profile_id", profile.id).order("is_primary", { ascending: false }),
      profile.avatar_path ? requireSupabase().storage.from("staff-profile-media").createSignedUrl(profile.avatar_path, 3600) : Promise.resolve({ data: null, error: null }),
    ]);
    if (error) setNotice(error.message); else setEmails((emailRows || []) as StaffEmail[]);
    if (signed.data?.signedUrl) setAvatarUrl(signed.data.signedUrl);
  };

  const persistProfile = async () => {
    if (!draft) throw new Error("Abra uma ficha.");
    if (draft.full_name.trim().split(/\s+/).length < 2) throw new Error("Informe nome e sobrenome separados por espaço.");
    const mobile = e164(draft.mobile_phone);
    if (!/^55[1-9][0-9]{9,10}$/.test(mobile)) throw new Error("Informe um celular válido com DDD.");
    const payload = {
      user_id: draft.user_id, full_name: draft.full_name.trim(), nickname: draft.nickname.trim(), job_title: draft.job_title.trim(),
      hired_on: draft.hired_on || null, active: draft.active, mobile_phone: mobile,
      alternate_phone: e164(draft.alternate_phone), postal_code: digits(draft.postal_code), street: draft.street.trim(),
      street_number: draft.street_number.trim(), address_complement: draft.address_complement.trim(), neighborhood: draft.neighborhood.trim(),
      city: draft.city.trim(), state_code: draft.state_code.trim().toUpperCase(), notes: draft.notes.trim(), avatar_path: draft.avatar_path,
      updated_by: session.user.id,
    };
    const query = draft.id
      ? requireSupabase().from("staff_private_profiles").update(payload).eq("id", draft.id)
      : requireSupabase().from("staff_private_profiles").insert({ ...payload, created_by: session.user.id });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    const saved = data as StaffProfile;
    setDraft((current) => current ? { ...current, ...saved } : current);
    await load();
    return saved;
  };

  const saveSection = async (message: string, extra?: (saved: StaffProfile) => Promise<void>) => {
    setBusy(true); setNotice("");
    try { const saved = await persistProfile(); if (extra) await extra(saved); setNotice(message); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };

  const saveEmails = async (saved: StaffProfile) => {
    const clean = emails.filter((item) => item.email.trim()).map((item) => ({ staff_profile_id: saved.id, email: item.email.trim().toLowerCase(), is_primary: item.is_primary }));
    if (clean.length && !clean.some((item) => item.is_primary)) clean[0].is_primary = true;
    const { error: deleteError } = await requireSupabase().from("staff_private_emails").delete().eq("staff_profile_id", saved.id);
    if (deleteError) throw deleteError;
    if (clean.length) { const { error } = await requireSupabase().from("staff_private_emails").insert(clean); if (error) throw error; }
  };

  const lookupPostalCode = async () => {
    if (!draft) return;
    const code = digits(draft.postal_code);
    if (code.length !== 8) return setNotice("Informe os 8 números do CEP.");
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${code}/json/`);
      const result = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!response.ok || result.erro) throw new Error("CEP não encontrado.");
      setDraft((current) => current ? { ...current, postal_code: code, street: result.logradouro || "", neighborhood: result.bairro || "", city: result.localidade || "", state_code: result.uf || "" } : current);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível buscar o CEP."); }
    finally { setBusy(false); }
  };

  const applyPhoto = async (edited: EditedProductImage) => {
    if (!draft) return;
    setBusy(true); setNotice("");
    try {
      const saved = await persistProfile();
      const path = `${saved.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`;
      const originalPath = `${saved.id}/originals/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${edited.sourceFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
      const bucket = requireSupabase().storage.from("staff-profile-media");
      const originalUpload = await bucket.upload(originalPath, edited.sourceFile, { contentType: edited.sourceFile.type, upsert: false });
      if (originalUpload.error) throw originalUpload.error;
      const { error } = await bucket.upload(path, edited.blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      const { error: updateError } = await requireSupabase().from("staff_private_profiles").update({ avatar_path: path, updated_by: session.user.id }).eq("id", saved.id);
      if (updateError) throw updateError;
      const signed = await bucket.createSignedUrl(path, 3600);
      setAvatarUrl(signed.data?.signedUrl || "");
      setDraft((current) => current ? { ...current, avatar_path: path } : current);
      setPendingPhoto(null); setNotice("Foto salva no perfil privado."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar a foto."); }
    finally { setBusy(false); }
  };

  const saveAccess = async (active: boolean) => {
    if (!draft?.user_id) return setNotice("Esta pessoa ainda não possui uma conta de acesso vinculada.");
    setBusy(true); setNotice("");
    const { error } = await requireSupabase().rpc("owner_set_staff_access", { target_user_id: draft.user_id, next_role: draft.access_role, next_active: active });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(active ? "Papel de acesso atualizado." : "Acesso removido sem apagar a pessoa do histórico.");
  };

  if (!draft) return <section className="staff-admin-list">
    <header><div><small>Cadastro privado</small><h2>Pessoas da equipe</h2><p>Somente proprietários veem contato, endereço, foto e anotações.</p></div><button type="button" onClick={() => void open(null)}><Plus /> Convidar alguém</button></header>
    <div>{list.map(({ key, profile, access }) => <button type="button" key={key} onClick={() => void open(profile, access)}>
      <span className="staff-avatar">{profile ? <UserRound /> : <ShieldOff />}</span><span><strong>{profile?.full_name || access?.display_name || "Membro da equipe"}</strong><small>{profile?.job_title || access?.role || "Cadastro incompleto"}</small></span><b>{profile?.active ?? access?.active ? "Ativo" : "Inativo"}</b>
    </button>)}</div>
    {notice ? <p role="status">{notice}</p> : null}
  </section>;

  return <section className="staff-profile-form">
    <header><button type="button" onClick={() => setDraft(null)}><X /> Voltar à equipe</button><div><small>Ficha privada</small><h2>{draft.full_name || "Nova pessoa"}</h2></div></header>
    {notice ? <p className="staff-profile-notice" role="status">{notice}</p> : null}
    <article><header><h3>Identificação</h3><button type="button" disabled={busy} onClick={() => void saveSection("Identificação salva.")}><Save /> Salvar identificação</button></header>
      <div className="staff-photo-row"><span className="staff-photo">{avatarUrl ? <img src={avatarUrl} alt={`Foto de ${draft.full_name}`} /> : <UserRound />}</span><label><Camera /> Enviar foto<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPendingPhoto(file); event.currentTarget.value = ""; }} /></label></div>
      <div className="staff-fields"><label>Nome completo *<input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></label><label>Apelido<input value={draft.nickname} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })} /></label><label>Cargo<input value={draft.job_title} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} /></label><label>Data de entrada<input type="date" value={draft.hired_on || ""} onChange={(e) => setDraft({ ...draft, hired_on: e.target.value || null })} /></label><label className="staff-check"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Pessoa ativa</label></div>
    </article>
    <article><header><h3>Contato</h3><button type="button" disabled={busy} onClick={() => void saveSection("Contato salvo.", saveEmails)}><Save /> Salvar contato</button></header>
      <div className="staff-fields"><label>Celular com WhatsApp *<input inputMode="tel" value={formatarTelefoneBR(draft.mobile_phone)} onChange={(e) => setDraft({ ...draft, mobile_phone: e.target.value })} /></label><label>Telefone alternativo<input inputMode="tel" value={formatarTelefoneBR(draft.alternate_phone)} onChange={(e) => setDraft({ ...draft, alternate_phone: e.target.value })} /></label></div>
      {draft.mobile_phone ? <a className="staff-whatsapp" href={operationWhatsAppUrl(draft.mobile_phone, "Olá!")} target="_blank" rel="noreferrer"><MessageCircle /> Abrir no WhatsApp</a> : null}
      <div className="staff-emails"><header><strong>E-mails</strong><button type="button" onClick={() => setEmails([...emails, { email: "", is_primary: emails.length === 0 }])}><MailPlus /> Acrescentar</button></header>{emails.map((item, index) => <div key={item.id || index}><input type="email" value={item.email} onChange={(e) => setEmails(emails.map((row, i) => i === index ? { ...row, email: e.target.value } : row))} placeholder="nome@exemplo.com" /><label><input type="radio" name="primary-email" checked={item.is_primary} onChange={() => setEmails(emails.map((row, i) => ({ ...row, is_primary: i === index })))} /> Principal</label><button type="button" aria-label="Remover e-mail" onClick={() => setEmails(emails.filter((_, i) => i !== index))}><Trash2 /></button></div>)}</div>
    </article>
    <article><header><h3>Endereço</h3><button type="button" disabled={busy} onClick={() => void saveSection("Endereço salvo.")}><Save /> Salvar endereço</button></header>
      <div className="staff-fields"><label>CEP<span><input inputMode="numeric" value={draft.postal_code} onChange={(e) => setDraft({ ...draft, postal_code: e.target.value })} /><button type="button" onClick={() => void lookupPostalCode()}><MapPin /> Buscar</button></span></label><label>Rua<input value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} /></label><label>Número<input value={draft.street_number} onChange={(e) => setDraft({ ...draft, street_number: e.target.value })} /></label><label>Complemento<input value={draft.address_complement} onChange={(e) => setDraft({ ...draft, address_complement: e.target.value })} /></label><label>Bairro<input value={draft.neighborhood} onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })} /></label><label>Cidade<input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></label><label>Estado<input maxLength={2} value={draft.state_code} onChange={(e) => setDraft({ ...draft, state_code: e.target.value.toUpperCase() })} /></label></div>
    </article>
    <article><header><h3>Acesso ao sistema</h3><button type="button" disabled={busy || !draft.user_id} onClick={() => void saveAccess(true)}><Check /> Salvar acesso</button></header><label>Papel<select value={draft.access_role} onChange={(e) => setDraft({ ...draft, access_role: e.target.value })}><option value="owner">Dona/Dono</option><option value="attendant">Atendente</option><option value="production">Produção</option>{draft.access_role === "manager" ? <option value="manager">Gerente (legado)</option> : null}</select></label><button className="staff-remove-access" type="button" disabled={busy || !draft.user_id} onClick={() => void saveAccess(false)}><ShieldOff /> Remover acesso agora</button>{!draft.user_id ? <small>A ficha pode ser salva agora; a conta de acesso será vinculada no convite.</small> : null}</article>
    <article><header><h3>Anotações</h3><button type="button" disabled={busy} onClick={() => void saveSection("Anotações salvas.")}><Save /> Salvar anotações</button></header><textarea rows={6} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></article>
    {pendingPhoto ? <ImageEditor file={pendingPhoto} title="Foto da equipe" preset={PHOTO_PRESET} onCancel={() => setPendingPhoto(null)} onApply={applyPhoto} /> : null}
  </section>;
}
