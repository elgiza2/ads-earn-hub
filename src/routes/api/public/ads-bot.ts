import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function secretFor(token: string) {
  return createHash("sha256").update(`ads-bot-webhook:${token}`).digest("hex");
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

        const update = await request.json().catch(() => null);
        const msg = update?.message;
        const text: string = msg?.text ?? "";
        if (msg?.chat?.id && text.startsWith("/start")) {
          const appUrl = process.env["ADS_APP_URL"] || new URL(request.url).origin;
          const param = text.split(" ")[1];
          const url = param ? `${appUrl}/?tgWebAppStartParam=${encodeURIComponent(param)}` : appUrl;
          const name = msg.from?.first_name ?? "";
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: `👋 ${name}\n\n<b>ADS</b> — Watch ads and earn USDT, GRAM & ADS.\n🎟 Every ad gives you a roulette ticket.\n👥 Invite friends for more tickets.\n\n📢 @adsgrq`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "▶️ Open ADS", web_app: { url } }],
                  [{ text: "📢 Channel", url: "https://t.me/adsgrq" }],
                ],
              },
            }),
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
