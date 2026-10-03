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
          const caption = [
            "<b>Welcome to ADS</b>",
            "",
            "<b>Watch ads and earn USDT, GRAM and ADS.</b>",
            "<b>Every ad gives you a roulette ticket.</b>",
            "<b>Invite friends to get more tickets.</b>",
            "",
            "<b>Channel: @adsgrq</b>",
          ].join("\n");
          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              photo: `${appUrl}/start.jpg`,
              caption,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Open ADS", web_app: { url } }],
                  [{ text: "Join Channel", url: "https://t.me/adsgrq" }],
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
