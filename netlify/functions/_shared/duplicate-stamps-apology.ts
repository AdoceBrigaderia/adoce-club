export type ApologyRecipient = {
  track_id: string;
  profile_id: string;
  full_name: string;
  phone_e164: string;
  current_progress: number;
  reversed_reward: boolean;
};

export function apologyText(row: ApologyRecipient) {
  const name = row.full_name.trim().split(/\s+/u)[0];
  const start = `Olá, ${name}! Aqui é da Adoce 💕 Identificamos uma falha no nosso sistema que lançou carimbos em dobro em algumas compras feitas entre 13 e 30 de outubro`;
  const end = " Pedimos desculpas pelo transtorno. Qualquer dúvida, é só responder por aqui!";
  return row.reversed_reward
    ? `${start}, e isso liberou uma fatia grátis antes da hora no seu cartão. Já corrigimos: agora você está com ${row.current_progress} de 14 carimbos, faltando só ${14 - row.current_progress} para ganhar sua fatia!${end}`
    : `${start}. Já corrigimos: seu cartão do Clube Adoce agora mostra ${row.current_progress} de 14 carimbos, exatamente um carimbo por fatia comprada.${end}`;
}

export function prepareApology(rows: ApologyRecipient[], blocked = new Set<string>()) {
  const tracks = new Map<string, ApologyRecipient>();
  for (const row of rows) {
    if (!row.track_id || !row.profile_id || !row.full_name?.trim() || /[\r\n\t\u0000-\u001f]/u.test(row.full_name)
      || !/^\+[1-9]\d{7,14}$/.test(row.phone_e164 || "") || !Number.isInteger(row.current_progress)
      || row.current_progress < 0 || row.current_progress > 13) throw new Error("invalid_recipient");
    const previous = tracks.get(row.track_id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error("conflicting_track");
    tracks.set(row.track_id, row);
  }
  const recipients = [...tracks.values()].sort((a, b) => a.track_id.localeCompare(b.track_id));
  const pending = recipients.filter(row => !blocked.has(row.track_id));
  return {
    total: recipients.length,
    normal: recipients.filter(row => !row.reversed_reward).length,
    reversed: recipients.filter(row => row.reversed_reward).length,
    pending: pending.length,
    blocked: recipients.length - pending.length,
    examples: {
      normal: recipients.find(row => !row.reversed_reward) ? apologyText(recipients.find(row => !row.reversed_reward)!) : null,
      reversed: recipients.find(row => row.reversed_reward) ? apologyText(recipients.find(row => row.reversed_reward)!) : null,
    },
    recipients: pending,
  };
}

export type ApologyBatchDependencies = {
  claim(row: ApologyRecipient): Promise<boolean>;
  send(row: ApologyRecipient, text: string): Promise<string>;
  sent(row: ApologyRecipient, sid: string): Promise<void>;
  failed(row: ApologyRecipient, reason: string, sid: string | null): Promise<void>;
  now(): number;
};

export async function runApologyBatch(rows: ApologyRecipient[], deps: ApologyBatchDependencies) {
  const result = { attempted: 0, sent: 0, failed: 0, skipped: 0 };
  const started = deps.now();
  for (const row of prepareApology(rows).recipients) {
    if (result.attempted >= 20 || deps.now() - started >= 40_000) break;
    if (!await deps.claim(row)) { result.skipped++; continue; }
    result.attempted++;
    let sid: string | null = null;
    try {
      sid = await deps.send(row, apologyText(row));
      await deps.sent(row, sid);
      result.sent++;
    } catch {
      result.failed++;
      // A reserva fica para sempre: timeout pode significar aceite pela Twilio.
      // Se até esta escrita falhar, interromper; nunca prosseguir silenciosamente.
      await deps.failed(row, sid ? "sent_audit_failed" : "send_uncertain", sid);
    }
  }
  return result;
}
