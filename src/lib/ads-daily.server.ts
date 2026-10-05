import { randomUUID } from "crypto";
import { db, tg, TASK_BUCKET } from "./ads.server";
import { APP_URL, CHANNEL } from "./ads.config";
import { DAILY_JOB_KEY, DAILY_LATEST_KEY, dailyDate, dailyTopic, type DailyPhoto } from "./ads-daily";

type Job = {
  date: string; owner?: string; leaseUntil?: number;
  phase: "idle" | "generating" | "generated" | "sending" | "done" | "paused";
  pause?: string; reason?: string; retryAfter?: number; image?: string; messageId?: number;
};
export class DailyError extends Error {
  constructor(message: string, public status = 500, public pause = "configuration", public retryAfter = 0) { super(message); }
}
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function readJob(s: any) {
  const { data, error } = await s.from("ads_translations").select("version,data").eq("lang", DAILY_JOB_KEY).maybeSingle();
  if (error) throw new Error("Could not read daily publication state");
  return data as { version: number; data: Job } | null;
}

// A conditional version update is the database single-flight lock. An upsert alone is NOT a lock.
async function acquire(s: any, date: string) {
  const existing = await readJob(s);
  const old = existing?.data;
  const now = Date.now();
  if (old?.phase === "paused") return { skipped: true as const, reason: old.reason || "Daily publication is paused" };
  if (old?.retryAfter && old.retryAfter > now) return { skipped: true as const, reason: "Waiting before retry" };
  if (old?.date === date && old.phase === "done") return { skipped: true as const, reason: "Already published today" };
  if (old?.leaseUntil && old.leaseUntil > now) return { skipped: true as const, reason: "A publication is already running" };
  if (old?.phase === "sending" || old?.phase === "generating") {
    // A lost response could still have produced a billable image or a Telegram post. Never replay blindly.
    const { error } = await s.from("ads_translations").update({ version: (existing?.version ?? 0) + 1, data: { ...old, phase: "paused", pause: "uncertain", reason: "A previous run ended without confirmation. Review it before resuming." } }).eq("lang", DAILY_JOB_KEY).eq("version", existing?.version);
    if (error) throw new Error("Could not pause the interrupted daily run");
    return { skipped: true as const, reason: "Interrupted publication needs admin review" };
  }
  const job: Job = { date, owner: randomUUID(), leaseUntil: now + 30 * 60 * 1000, phase: old?.date === date && old.image ? "generated" : "idle", ...(old?.date === date && old.image ? { image: old.image } : {}) };
  const version = (existing?.version ?? 0) + 1;
  if (!existing) {
    const { error } = await s.from("ads_translations").insert({ lang: DAILY_JOB_KEY, version, data: job });
    if (error?.code === "23505") return { skipped: true as const, reason: "Another run acquired the lock" };
    if (error) throw new Error("Could not acquire daily publication lock");
  } else {
    const { data, error } = await s.from("ads_translations").update({ version, data: job }).eq("lang", DAILY_JOB_KEY).eq("version", existing.version).select("lang");
    if (error) throw new Error("Could not acquire daily publication lock");
    if (!data?.length) return { skipped: true as const, reason: "Another run acquired the lock" };
  }
  return { skipped: false as const, job, version };
}

function gatewayError(status: number, payload: any, headers: Headers) {
  const message = payload?.error?.message || payload?.message || "Daily image generation failed";
  const type = payload?.error?.type || payload?.type || "";
  const provider = /provider|refusal|content_policy|moderation/.test(type + " " + (payload?.error?.code || ""));
  const pause = provider ? "provider" : status === 402 || status === 403 ? "credits_policy" : status === 429 ? "rate_limit" : status >= 500 ? "transient" : "configuration";
  const retry = headers.get("retry-after");
  const retryAfter = retry ? (/^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)) : Date.now() + 60000 + Math.random() * 30000;
  return new DailyError(message, status, pause, retryAfter);
}

export async function generateDailyImage(date: string, reference: Blob) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new DailyError("Daily image generation is not configured");
  const topic = dailyTopic(date);
  const form = new FormData();
  form.set("model", "openai/gpt-image-2.5-sunburst");
  form.set("image", reference, "ads-start.jpg");
  form.set("size", "1280x768");
  form.set("quality", "medium");
  form.set("output_format", "jpeg");
  form.set("stream", "false");
  form.set("prompt", `Create a NEW daily ADS image for ${date}, using the input image as a style and brand reference, not a template to duplicate. Scene: ${topic.scene}. Keep original translucent icy-blue glass rocket identity, dark binary-pattern setting, luminous cyan and magenta highlights. Vary composition and viewpoint significantly. Preserve only the exact typography ADS once, bold white Helvetica style, inside generous margins. No other text, no emoji, no icons, no logos of other brands, no arrow or star symbols. Sharp polished landscape 3D illustration.`);
  const response = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const result = await response.json();
  if (!response.ok) throw gatewayError(response.status, result, response.headers);
  if (result.error) throw gatewayError(result.error.status || 400, result, response.headers);
  const image = result.data?.[0]?.b64_json;
  if (!image) throw new DailyError("Image generation ended without a completed image", 422, "refusal");
  return Buffer.from(image, "base64");
}

export async function runDailyPublication(now = new Date()) {
  const date = dailyDate(now);
  if (now.getUTCHours() < 12) return { skipped: true, reason: "Today's publication starts at 12:00 UTC" };
  const s = await db();
  const lock = await acquire(s, date);
  if (lock.skipped) return lock;
  let job = lock.job;
  let version = lock.version;
  const save = async (patch: Partial<Job>) => {
    const next = { ...job, ...patch };
    const { data, error } = await s.from("ads_translations").update({ version: version + 1, data: next }).eq("lang", DAILY_JOB_KEY).eq("version", version).select("lang");
    if (error || !data?.length) throw new Error("Daily publication lock was lost");
    job = next; version += 1;
  };
  try {
    // Check channel permissions before spending image credits.
    const me = await tg("getMe", {});
    if (!me.ok) throw new DailyError("The ADS bot could not be verified");
    const membership = await tg("getChatMember", { chat_id: `@${CHANNEL}`, user_id: me.result.id });
    if (!membership.ok || !["creator", "administrator"].includes(membership.result?.status) || (membership.result.status === "administrator" && !membership.result.can_post_messages)) throw new DailyError("Make the ADS bot a channel admin with permission to post messages", 403, "channel");
    if (!job.image) {
      const reference = await fetch(`${APP_URL}/start.jpg`);
      if (!reference.ok) throw new DailyError("The ADS reference image could not be loaded");
      await save({ phase: "generating" });
      // One image per invocation. Retryable failures are parked for a later scheduled run, not replayed immediately.
      const bytes = await generateDailyImage(date, await reference.blob());
      const object = `ads-daily/${date}-${job.owner}.jpg`;
      const { error } = await s.storage.from(TASK_BUCKET).upload(object, bytes, { contentType: "image/jpeg", upsert: false });
      if (error) throw new DailyError("Could not save today's image; review the run before resuming", 500, "uncertain");
      const image = s.storage.from(TASK_BUCKET).getPublicUrl(object).data.publicUrl;
      await save({ phase: "generated", image });
    }
    if (!job.image) throw new DailyError("Today's image is missing");
    const topic = dailyTopic(date);
    const photo: DailyPhoto = { date, image: job.image, title: topic.title, text: topic.text };
    const { error } = await s.from("ads_translations").upsert({ lang: DAILY_LATEST_KEY, version: 1, data: photo });
    if (error) throw new DailyError("Could not save the daily notification", 500, "uncertain");
    await save({ phase: "sending" });
    const sent = await tg("sendPhoto", { chat_id: `@${CHANNEL}`, photo: photo.image, caption: `<b>${escapeHtml(photo.title)}</b>\n\n<b>${escapeHtml(photo.text)}</b>`, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "Open ADS", url: `https://t.me/${me.result.username}?startapp` }]] } });
    if (!sent.ok) throw new DailyError(sent.description || "Channel publication failed", sent.error_code || 500, "channel");
    await save({ phase: "done", messageId: sent.result.message_id, leaseUntil: 0 });
    return { published: true, date, image: photo.image, messageId: sent.result.message_id };
  } catch (error) {
    const failure = error instanceof DailyError ? error : new DailyError("Publication ended without confirmation. Review it before resuming.", 500, "uncertain");
    const parked = failure.pause === "rate_limit" || failure.pause === "transient";
    await save({ phase: parked ? (job.image ? "generated" : "idle") : "paused", pause: failure.pause, reason: failure.message, retryAfter: parked ? failure.retryAfter : 0, leaseUntil: 0 });
    throw failure;
  }
}

export async function dailyStatus() {
  const s = await db();
  return (await readJob(s))?.data ?? null;
}

export async function resumeDaily() {
  const s = await db();
  const row = await readJob(s);
  if (!row || row.data.phase !== "paused") return "Daily publication is not paused.";
  const uncertain = ["provider", "refusal", "uncertain", "configuration"].includes(row.data.pause || "");
  const next: Job = { ...row.data, phase: uncertain ? "done" : row.data.image ? "generated" : "idle", pause: undefined, reason: undefined, leaseUntil: 0, retryAfter: 0 };
  const { data, error } = await s.from("ads_translations").update({ version: row.version + 1, data: next }).eq("lang", DAILY_JOB_KEY).eq("version", row.version).select("lang");
  if (error || !data?.length) throw new Error("Could not resume daily publication");
  return uncertain ? "Resumed for the next day. The interrupted day will not be replayed." : "Resumed. The next scheduled run can continue.";
}