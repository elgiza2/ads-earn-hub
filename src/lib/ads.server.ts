import { createHmac } from "crypto";

export type TgUser = { id: number; first_name?: string; username?: string; photo_url?: string; language_code?: string };

export function verifyInitData(initData: string): { user: TgUser; startParam: string | undefined } {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Bot token missing");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Unauthorized");
  params.delete("hash");
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const calc = createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc !== hash) throw new Error("Unauthorized");
  const authDate = Number(params.get("auth_date") || 0);
  if (Date.now() / 1000 - authDate > 60 * 60 * 24 * 2) throw new Error("Session expired");
  const user = JSON.parse(params.get("user") || "{}") as TgUser;
  if (!user.id) throw new Error("Unauthorized");
  return { user, startParam: params.get("start_param") || undefined };
}

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export function activeMult(u: { booster_mult: number; booster_until: string | null }) {
  if (u.booster_until && new Date(u.booster_until).getTime() > Date.now()) return Number(u.booster_mult) || 1;
  return 1;
}
