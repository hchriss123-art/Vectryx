import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AlertInput = {
  userId: string;
  product: "VECTRYX" | "MORPHEUS";
  eventType: string;
  title: string;
  body: string;
  ticker?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
  dedupeKey: string;
};

export async function enqueueAlert(input: AlertInput) {
  const { error } = await supabase.from("alert_event").insert({
    user_id: input.userId,
    product: input.product,
    event_type: input.eventType,
    title: input.title,
    body: input.body,
    ticker: input.ticker ?? null,
    severity: input.severity ?? "MEDIUM",
    occurred_at: new Date().toISOString(),
    dedupe_key: input.dedupeKey,
    notify_status: "PENDING",
  });

  if (error) {
    // Ignore duplicate insert errors safely
    if (error.code === "23505") return;
    throw error;
  }
}
