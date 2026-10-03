import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyInitData, db, tg, activeMult } from "./ads.server";
import { AD_COOLDOWN_SEC, BOOSTERS, CHANNEL, MIN_WITHDRAW, TICKET_PACKS, TON_WALLET, WHEEL } from "./ads.config";
import { BASE, I18N_VERSION } from "./i18n";

const Auth = z.object({ initData: z.string().min(10) });

async function getUser(initData: string) {
  const { user } = verifyInitData(initData);
  const s = await db();
  const { data } = await s.from("ads_users").select("*").eq("telegram_id", user.id).maybeSingle();
  if (!data) throw new Error("Not registered");
  return { s, u: data, tgUser: user };
}

async function loadState(s: any, telegramId: number) {
  const [{ data: u }, { data: tasks }, { data: done }, { data: wds }, { data: refs }] = await Promise.all([
    s.from("ads_users").select("*").eq("telegram_id", telegramId).single(),
    s.from("ads_tasks").select("*").eq("is_active", true).order("sort_order"),
    s.from("ads_user_tasks").select("task_key").eq("telegram_id", telegramId),
    s.from("ads_withdrawals").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(20),
    s.from("ads_users").select("first_name,username,created_at").eq("referred_by", telegramId).order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    user: { ...u, mult: activeMult(u) },
    tasks: tasks ?? [],
    done: (done ?? []).map((d: any) => d.task_key) as string[],
    withdrawals: wds ?? [],
    friends: refs ?? [],
  };
}

export const bootstrap = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.parse(d))
  .handler(async ({ data }) => {
    const { user, startParam } = verifyInitData(data.initData);
    const s = await db();
    const { data: existing } = await s.from("ads_users").select("id").eq("telegram_id", user.id).maybeSingle();
    const lang = (user.language_code || "en").split("-")[0].toLowerCase();
    if (!existing) {
      let referredBy: number | null = null;
      const m = startParam?.match(/^ref_?(\d+)$/);
      if (m && Number(m[1]) !== user.id) {
        const { data: ref } = await s.from("ads_users").select("telegram_id,tickets,referrals").eq("telegram_id", Number(m[1])).maybeSingle();
        if (ref) {
          referredBy = ref.telegram_id;
          await s.from("ads_users").update({ tickets: ref.tickets + 1, referrals: ref.referrals + 1 }).eq("telegram_id", ref.telegram_id);
        }
      }
      await s.from("ads_users").insert({
        telegram_id: user.id, first_name: user.first_name, username: user.username, photo_url: user.photo_url,
        language: lang, referred_by: referredBy,
      });
    } else {
      await s.from("ads_users").update({ first_name: user.first_name, username: user.username, photo_url: user.photo_url, language: lang }).eq("telegram_id", user.id);
    }
    const me = await tg("getMe", {}).catch(() => null);
    return { ...(await loadState(s, user.id)), bot: (me?.result?.username as string) || "" };
  });

export const refresh = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    return loadState(s, u.telegram_id);
  });

export const claimAd = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    if (u.last_ad_at && Date.now() - new Date(u.last_ad_at).getTime() < AD_COOLDOWN_SEC * 1000) {
      throw new Error("cooldown");
    }
    const mult = activeMult(u);
    const r = Math.random();
    let currency: "USDT" | "GRAM" | "ADS";
    let amount: number;
    if (r < 0.6) {
      currency = "ADS";
      amount = Math.round((20 + Math.random() * 80) * mult);
    } else {
      currency = r < 0.8 ? "USDT" : "GRAM";
      amount = Math.random() < Math.min(0.25 * mult, 0.7) ? 0.001 : 0.0005;
    }
    const col = currency.toLowerCase();
    await s.from("ads_users").update({
      [col]: Number(u[col]) + amount,
      tickets: u.tickets + 1,
      ads_watched: u.ads_watched + 1,
      last_ad_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("telegram_id", u.telegram_id);
    await s.from("ads_ad_views").insert({ telegram_id: u.telegram_id, currency, amount });
    return { currency, amount, state: await loadState(s, u.telegram_id) };
  });

export const spin = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    if (u.tickets < 1) throw new Error("no_tickets");
    const mult = activeMult(u);
    // weights for winnable segments
    const weights: Record<number, number> = { 0: 30, 1: 8, 2: 18, 4: 24, 5: 4, 6: 8, 8: 3, 9: 8, 10: 1, 11: 3 };
    const entries = Object.entries(weights).map(([i, w]) => [Number(i), w * (WHEEL[Number(i)]!.c === "ADS" && WHEEL[Number(i)]!.a >= 250 ? mult : 1)] as const);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let pick = Math.random() * total;
    let index = entries[0]![0];
    for (const [i, w] of entries) { if ((pick -= w) <= 0) { index = i; break; } }
    const seg = WHEEL[index]!;
    const amount = seg.c === "ADS" ? Math.round(seg.a * mult) : seg.a;
    const col = seg.c.toLowerCase();
    await s.from("ads_users").update({ [col]: Number(u[col]) + amount, tickets: u.tickets - 1 }).eq("telegram_id", u.telegram_id);
    await s.from("ads_spins").insert({ telegram_id: u.telegram_id, currency: seg.c, amount });
    return { index, currency: seg.c, amount, state: await loadState(s, u.telegram_id) };
  });

export const buyTickets = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.extend({ pack: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    const p = TICKET_PACKS.find((x) => x.key === data.pack);
    if (!p) throw new Error("invalid");
    if (Number(u.gram) < p.gram) throw new Error("insufficient");
    await s.from("ads_users").update({ gram: Number(u.gram) - p.gram, tickets: u.tickets + p.tickets }).eq("telegram_id", u.telegram_id);
    return loadState(s, u.telegram_id);
  });

export const createBoosterPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.extend({ booster: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    const b = BOOSTERS.find((x) => x.key === data.booster);
    if (!b) throw new Error("invalid");
    const memo = `ADS-${u.telegram_id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await s.from("ads_payments").insert({ telegram_id: u.telegram_id, product: b.key, amount_ton: b.ton, memo });
    const nano = Math.round(b.ton * 1e9);
    return { memo, amount: b.ton, link: `ton://transfer/${TON_WALLET}?amount=${nano}&text=${encodeURIComponent(memo)}` };
  });

export const checkPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.extend({ memo: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    const { data: p } = await s.from("ads_payments").select("*").eq("memo", data.memo).eq("telegram_id", u.telegram_id).maybeSingle();
    if (!p) throw new Error("invalid");
    if (p.status === "paid") return { paid: true, state: await loadState(s, u.telegram_id) };
    const r = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${TON_WALLET}&limit=60`);
    const j = await r.json();
    const tx = (j.result || []).find((t: any) => {
      const msg = t.in_msg?.message || "";
      return msg.trim() === p.memo && Number(t.in_msg?.value || 0) >= Math.round(Number(p.amount_ton) * 1e9) * 0.99;
    });
    if (!tx) return { paid: false, state: null };
    const b = BOOSTERS.find((x) => x.key === p.product)!;
    const base = u.booster_until && new Date(u.booster_until).getTime() > Date.now() && Number(u.booster_mult) === b.mult ? new Date(u.booster_until).getTime() : Date.now();
    await s.from("ads_payments").update({ status: "paid", paid_at: new Date().toISOString(), tx_hash: tx.transaction_id?.hash }).eq("id", p.id);
    await s.from("ads_users").update({
      booster: b.key, booster_mult: b.mult,
      booster_until: new Date(base + b.days * 86400000).toISOString(),
    }).eq("telegram_id", u.telegram_id);
    return { paid: true, state: await loadState(s, u.telegram_id) };
  });

export const completeTask = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.extend({ key: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    const { data: t } = await s.from("ads_tasks").select("*").eq("key", data.key).eq("is_active", true).maybeSingle();
    if (!t) throw new Error("invalid");
    const { data: already } = await s.from("ads_user_tasks").select("id").eq("telegram_id", u.telegram_id).eq("task_key", t.key).maybeSingle();
    if (already) throw new Error("done");
    if (t.kind === "watch" && u.ads_watched < t.target) throw new Error("not_ready");
    if (t.kind === "invite" && u.referrals < t.target) throw new Error("not_ready");
    if (t.kind === "channel") {
      const r = await tg("getChatMember", { chat_id: `@${CHANNEL}`, user_id: u.telegram_id });
      const st = r?.result?.status;
      if (!["member", "administrator", "creator", "restricted"].includes(st)) throw new Error("not_joined");
    }
    const { error } = await s.from("ads_user_tasks").insert({ telegram_id: u.telegram_id, task_key: t.key });
    if (error) throw new Error("done");
    const col = String(t.reward_currency).toLowerCase();
    await s.from("ads_users").update({ [col]: Number(u[col]) + Number(t.reward_amount) }).eq("telegram_id", u.telegram_id);
    return loadState(s, u.telegram_id);
  });

export const requestWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d) => Auth.extend({ currency: z.enum(["USDT", "GRAM", "ADS"]), amount: z.number().positive(), address: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { s, u } = await getUser(data.initData);
    const col = data.currency.toLowerCase();
    if (data.amount < MIN_WITHDRAW) throw new Error("min");
    if (Number(u[col]) < data.amount) throw new Error("insufficient");
    await s.from("ads_users").update({ [col]: Number(u[col]) - data.amount }).eq("telegram_id", u.telegram_id);
    await s.from("ads_withdrawals").insert({ telegram_id: u.telegram_id, currency: data.currency, amount: data.amount, address: data.address });
    return loadState(s, u.telegram_id);
  });

export const getTranslations = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ lang: z.string().min(2).max(10) }).parse(d))
  .handler(async ({ data }) => {
    const lang = data.lang.toLowerCase();
    if (lang === "en") return BASE;
    const s = await db();
    const { data: cached } = await s.from("ads_translations").select("*").eq("lang", lang).maybeSingle();
    if (cached && cached.version === I18N_VERSION) return { ...BASE, ...cached.data };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return BASE;
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You translate mobile app UI strings. Keep it short and natural. Keep placeholders like {n} and brand words ADS, USDT, GRAM, TON untouched. Return ONLY a JSON object with the same keys." },
            { role: "user", content: `Target language code: ${lang}\n${JSON.stringify(BASE)}` },
          ],
        }),
      });
      const j = await r.json();
      const parsed = JSON.parse(j.choices[0].message.content.replace(/^```json|```$/g, ""));
      await s.from("ads_translations").upsert({ lang, version: I18N_VERSION, data: parsed });
      return { ...BASE, ...parsed };
    } catch {
      return BASE;
    }
  });
