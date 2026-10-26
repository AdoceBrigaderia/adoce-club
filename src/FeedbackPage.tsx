import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareText, Send } from "lucide-react";
import PublicFooter from "./PublicFooter";
import "./institutional-2026.css";

export default function FeedbackPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", category: "problem", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/site-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, page_url: document.referrer || location.href }),
    });
    const payload = (await response.json().catch(() => ({}))) as { protocol?: string; error?: string };
    setBusy(false);
    if (!response.ok || !payload.protocol) return setError(payload.error || "Não foi possível enviar agora.");
    setProtocol(payload.protocol);
  };

  return (
    <main className="institutional-2026">
      <section className="institutional-hero">
        <a className="institutional-back" href="/"><ArrowLeft /> Voltar ao site</a>
        <p className="institutional-kicker"><MessageSquareText style={{ display: "inline", width: 16, marginRight: 6 }} /> Escuta Adoce</p>
        <h1>Sua experiência ajuda a gente a cuidar melhor de cada detalhe.</h1>
        <p>Conte se encontrou um erro, teve uma dificuldade ou imaginou uma melhoria. Você recebe um protocolo para acompanhar a mensagem.</p>
      </section>

      <div className="institutional-body">
        <section className="institutional-card">
          {protocol ? (
            <div className="feedback-success">
              <CheckCircle2 />
              <h2>Recebemos sua mensagem.</h2>
              <p>Protocolo <strong>{protocol}</strong></p>
              <a href="/">Voltar ao site</a>
            </div>
          ) : (
            <form className="institutional-feedback-form" onSubmit={submit}>
              <h2>Reclamação ou sugestão</h2>
              <label>Como podemos te chamar?<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Tipo<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="problem">Encontrei um problema no site</option><option value="complaint">Quero fazer uma reclamação</option><option value="suggestion">Tenho uma sugestão</option><option value="compliment">Quero deixar um elogio</option></select></label>
              <div className="institutional-feedback-grid">
                <label>E-mail <small>(opcional)</small><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label>Celular <small>(opcional)</small><input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              </div>
              <label>Conte o que aconteceu<textarea required minLength={10} maxLength={3000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Diga em qual página estava, o que tentou fazer e o que apareceu." /></label>
              {error ? <p className="feedback-error" role="alert">{error}</p> : null}
              <button className="institutional-cta" disabled={busy}>{busy ? "Enviando..." : "Enviar para a Adoce"} <Send /></button>
              <small>Usaremos seus dados somente para entender e responder esta mensagem.</small>
            </form>
          )}
        </section>
      </div>

      <PublicFooter />
    </main>
  );
}
