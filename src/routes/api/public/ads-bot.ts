import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function secretFor(token: string) {
  return createHash("sha256").update(`ads-bot-webhook:${token}`).digest("hex");
}

const DEFAULT_ADMINS = "6657246146";
const TASK_REWARD = 0.0005;

type BotState = { step: "name" } | { step: "link"; name: string } | { step: "image"; name: string; link: string };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/api/public/ads-bot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return new Response("not configured", { status: 500 });
        const got = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
        const exp = Buffer.from(secretFor(token));
        if (got.length !== exp.length || !timingSafeEqual(got, exp)) return new Response("unauthorized", { status: 401 });

        const api = async (method: string, body: Record<string, unknown>) => {
          const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          return r.json() as Promise<any>;
        };
        const send = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
          api("sendMessage", { chat_id, text, parse_mode: "HTML", ...extra });

        const admins = new Set((process.env["ADS_ADMIN_IDS"] || DEFAULT_ADMINS).split(",").map((x) => x.trim()));
        const update = await request.json().catch(() => null);
        const { db, TASK_BUCKET } = await import("@/lib/ads.server");

        const stateKey = (chat: number) => `bot:${chat}`;
        const getState = async (chat: number): Promise<BotState | null> => {
          const s = await db();
          const { data } = await s.from("ads_translations").select("data").eq("lang", stateKey(chat)).maybeSingle();
          return (data?.data as BotState) ?? null;
        };
        const setState = async (chat: number, st: BotState | null) => {
          const s = await db();
          if (!st) await s.from("ads_translations").delete().eq("lang", stateKey(chat));
          else await s.from("ads_translations").upsert({ lang: stateKey(chat), version: 0, data: st });
        };

        const adminMenu = (chat: number) =>
          send(chat, "<b>Task manager</b>\n\n<b>Choose what you want to do.</b>", {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Add task", callback_data: "t:add" }],
                [{ text: "Delete task", callback_data: "t:list" }],
              ],
            },
          });

        // ---------- Inline button presses ----------
        const cb = update?.callback_query;
        if (cb) {
          const chat: number = cb.message?.chat?.id;
          const from = String(cb.from?.id ?? "");
          await api("answerCallbackQuery", { callback_query_id: cb.id });
          if (!admins.has(from) || !chat) return Response.json({ ok: true });
          const data: string = cb.data || "";
          const s = await db();
          if (data === "t:add") {
            await setState(chat, { step: "name" });
            await send(chat, "<b>Send the task name.</b>\n\n<b>Send /cancel to stop.</b>");
          } else if (data === "t:list") {
            const { data: tasks } = await s.from("ads_tasks").select("key,title").order("sort_order");
            if (!tasks?.length) await send(chat, "<b>There are no tasks.</b>");
            else
              await send(chat, "<b>Tap a task to delete it.</b>", {
                reply_markup: {
                  inline_keyboard: [
                    ...tasks.map((t: any) => [{ text: String(t.title).slice(0, 60), callback_data: `t:del:${t.key}` }]),
                    [{ text: "Back", callback_data: "t:menu" }],
                  ],
                },
              });
          } else if (data === "t:menu") {
            await adminMenu(chat);
          } else if (data.startsWith("t:del:")) {
            const key = data.slice(6);
            const { data: t } = await s.from("ads_tasks").select("title").eq("key", key).maybeSingle();
            await s.from("ads_tasks").delete().eq("key", key);
            await s.from("ads_user_tasks").delete().eq("task_key", key);
            await s.storage.from(TASK_BUCKET).remove([`${key}.jpg`]).catch(() => null);
            await send(chat, t ? `<b>Deleted: ${esc(t.title)}</b>` : "<b>Task not found.</b>", {
              reply_markup: { inline_keyboard: [[{ text: "Delete another", callback_data: "t:list" }], [{ text: "Back", callback_data: "t:menu" }]] },
            });
          }
          return Response.json({ ok: true });
        }

        const msg = update?.message;
        const chat: number | undefined = msg?.chat?.id;
        if (!chat) return Response.json({ ok: true });
        const text: string = (msg.text ?? "").trim();
        const isAdmin = admins.has(String(msg.from?.id ?? "")) && msg.chat.type === "private";

        // ---------- /start ----------
        if (text.startsWith("/start")) {
          const appUrl = process.env["ADS_APP_URL"] || new URL(request.url).origin;
          const param = text.split(" ")[1];
          const url = param ? `${appUrl}/?tgWebAppStartParam=${encodeURIComponent(param)}` : appUrl;
          const caption = [
            "<b>Welcome to ADS</b>",
            "",
            "<b>Watch ads and earn USDT, GRAM and ADS.</b>",
            "<b>Every ad gives you a roulette ticket.</b>",
            "<b>Invite friends to get more tickets.</b>",
            "",
            "<b>Channel: @adsgrq</b>",
          ].join("\n");
          await api("sendPhoto", {
            chat_id: chat,
            photo: `${appUrl}/start.jpg`,
            caption,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Open ADS", web_app: { url } }],
                [{ text: "Join Channel", url: "https://t.me/adsgrq" }],
              ],
            },
          });
          return Response.json({ ok: true });
        }

        if (!isAdmin) return Response.json({ ok: true });

        // ---------- Admin task manager ----------
        if (text === "/1010") {
          await setState(chat, null);
          await adminMenu(chat);
          return Response.json({ ok: true });
        }
        if (text === "/cancel") {
          await setState(chat, null);
          await send(chat, "<b>Cancelled.</b>");
          return Response.json({ ok: true });
        }

        const st = await getState(chat);
        if (!st) return Response.json({ ok: true });

        if (st.step === "name") {
          if (!text || text.startsWith("/") || text.length > 120) {
            await send(chat, "<b>Send a task name (up to 120 characters).</b>");
          } else {
            await setState(chat, { step: "link", name: text });
            await send(chat, `<b>Name: ${esc(text)}</b>\n\n<b>Now send the task link.</b>`);
          }
        } else if (st.step === "link") {
          let ok = false;
          try { ok = /^https?:$/.test(new URL(text).protocol); } catch { ok = false; }
          if (!ok) {
            await send(chat, "<b>Send a valid link that starts with https://</b>");
          } else {
            await setState(chat, { step: "image", name: st.name, link: text });
            await send(chat, "<b>Now send the task picture.</b>");
          }
        } else if (st.step === "image") {
          const photo = msg.photo?.[msg.photo.length - 1];
          const doc = msg.document?.mime_type?.startsWith("image/") ? msg.document : null;
          const fileId: string | undefined = photo?.file_id ?? doc?.file_id;
          if (!fileId) {
            await send(chat, "<b>Send a picture for the task.</b>");
            return Response.json({ ok: true });
          }
          const f = await api("getFile", { file_id: fileId });
          const path = f?.result?.file_path;
          if (!path) {
            await send(chat, "<b>Could not read the picture. Send it again.</b>");
            return Response.json({ ok: true });
          }
          const bytes = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${token}/${path}`)).arrayBuffer());
          const key = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          const s = await db();
          const up = await s.storage.from(TASK_BUCKET).upload(`${key}.jpg`, bytes, { contentType: doc?.mime_type || "image/jpeg", upsert: true });
          if (up.error) {
            await send(chat, `<b>Upload failed: ${esc(up.error.message)}</b>`);
            return Response.json({ ok: true });
          }
          const { error } = await s.from("ads_tasks").insert({
            key, title: st.name, kind: "link", target: 0, link: st.link,
            reward_currency: "GRAM", reward_amount: TASK_REWARD, sort_order: 0,
          });
          await setState(chat, null);
          if (error) await send(chat, `<b>Could not save: ${esc(error.message)}</b>`);
          else
            await api("sendPhoto", {
              chat_id: chat,
              photo: fileId,
              caption: `<b>Task added</b>\n\n<b>${esc(st.name)}</b>\n<b>${esc(st.link)}</b>\n<b>Reward: ${TASK_REWARD} GRAM</b>`,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: [[{ text: "Add another", callback_data: "t:add" }], [{ text: "Back", callback_data: "t:menu" }]] },
            });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
