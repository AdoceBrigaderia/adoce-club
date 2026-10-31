import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareApology, type ApologyRecipient } from "./duplicate-stamps-apology";

export async function loadApology(admin: SupabaseClient) {
  const reversals = await admin.from("ledger_entries")
    .select("track_id,subject_profile_id,stamps_delta", { count: "exact" })
    .like("idempotency_key", "dup-reversal:%").limit(1000);
  if (reversals.error || reversals.count !== 144 || reversals.data?.length !== 144
    || reversals.data.reduce((sum, row) => sum - row.stamps_delta, 0) !== 233) throw new Error("incident_scope_mismatch");
  const trackIds = [...new Set(reversals.data.map(row => row.track_id))];
  const profileIds = [...new Set(reversals.data.map(row => row.subject_profile_id))];
  if (trackIds.length !== 100 || profileIds.length !== 100 || profileIds.includes(null)) throw new Error("incident_scope_mismatch");
  const [tracks, profiles, rewards, audit] = await Promise.all([
    admin.from("loyalty_tracks").select("id,current_progress").in("id", trackIds),
    admin.from("profiles").select("id,full_name,phone_e164").in("id", profileIds),
    admin.from("rewards").select("track_id").in("track_id", trackIds).eq("status", "reversed"),
    admin.from("audit_events").select("entity_id,action,payload", { count: "exact" })
      .eq("entity_type", "loyalty_track").in("entity_id", trackIds)
      .in("action", ["stamps.duplicate_apology_claimed", "stamps.duplicate_apology_sent", "stamps.duplicate_apology_failed"]).limit(1000),
  ]);
  if ([tracks, profiles, rewards, audit].some(result => result.error) || audit.data?.length !== audit.count) throw new Error("recipient_read_failed");
  const reversedTracks = new Set(rewards.data!.map(row => row.track_id));
  if (reversedTracks.size !== 8) throw new Error("incident_reward_mismatch");
  const rows: ApologyRecipient[] = reversals.data.map(row => {
    const profile = profiles.data!.find(profile => profile.id === row.subject_profile_id);
    const track = tracks.data!.find(track => track.id === row.track_id);
    return { track_id: row.track_id, profile_id: row.subject_profile_id,
      full_name: profile?.full_name, phone_e164: profile?.phone_e164,
      current_progress: track?.current_progress, reversed_reward: reversedTracks.has(row.track_id) };
  });
  const plan = prepareApology(rows, new Set(audit.data!.map(row => row.entity_id)));
  const sentIds = new Set(audit.data!.filter(row => row.action === "stamps.duplicate_apology_sent").map(row => row.entity_id));
  const failedIds = new Set(audit.data!.filter(row => row.action === "stamps.duplicate_apology_failed").map(row => row.entity_id));
  return { ...plan, sent: sentIds.size, failed: failedIds.size,
    uncertain: [...new Set(audit.data!.filter(row => row.action === "stamps.duplicate_apology_claimed").map(row => row.entity_id))]
      .filter(id => !sentIds.has(id) && !failedIds.has(id)).length };
}
