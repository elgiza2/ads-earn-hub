export const DAILY_JOB_KEY = "ads:daily:job";
export const DAILY_LATEST_KEY = "ads:daily:latest";

export const DAILY_TOPICS = [
  { title: "Your next ADS session", text: "Watch ads in ADS to earn random USDT, GRAM or ADS rewards. Every completed ad also gives you a roulette ticket.", scene: "a glass rocket ascending diagonally, close side view with a cyan and pink exhaust trail" },
  { title: "Put your tickets to use", text: "Have roulette tickets ready? Open ADS and use them to spin for a random reward.", scene: "a glass rocket banking around a wide curved orbital path, three-quarter front view" },
  { title: "Check your available tasks", text: "Open the Tasks page in ADS to see available activities and the reward shown for each task.", scene: "a glass rocket hovering above a luminous cyan launch platform, low angle" },
  { title: "Invite a friend to ADS", text: "Share your personal invite link from the Friends page. Each friend who joins through your link gives you one roulette ticket.", scene: "two original glass rockets flying side by side with distinct cyan and magenta exhaust trails" },
  { title: "Your rewards in one place", text: "Check your USDT, GRAM and ADS balances in your wallet, then choose your next activity.", scene: "a glass rocket viewed from above over a subtle digital grid, dramatic reflected cyan light" },
  { title: "Make progress on your tasks", text: "Your completed ads count toward watch tasks. Open ADS to check your progress and the rewards available.", scene: "a glass rocket climbing through three luminous circular flight gates, wide composition" },
  { title: "A new day with ADS", text: "Your next ad, task or roulette spin is waiting. Open ADS and choose where to start.", scene: "a glass rocket just lifting off with long cyan exhaust curving through a magenta-lit digital landscape" },
] as const;

export function dailyDate(now = new Date()) { return now.toISOString().slice(0, 10); }
export function dailyTopic(date: string) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return DAILY_TOPICS[((day % DAILY_TOPICS.length) + DAILY_TOPICS.length) % DAILY_TOPICS.length] ?? DAILY_TOPICS[0];
}

export type DailyPhoto = { date: string; image: string; title: string; text: string };
export type DailyNotice = DailyPhoto & { message: string; destination: "/" | "/spin" | "/tasks"; cta: string };

export function activityNotice(photo: DailyPhoto, user: { first_name?: string; tickets: number; ads_watched: number }, availableTasks: number): DailyNotice {
  const name = (user.first_name || "ADS explorer").slice(0, 60);
  if (user.tickets > 0) return { ...photo, title: "Your tickets are ready", message: `${name}, you have ${user.tickets} roulette ticket${user.tickets === 1 ? "" : "s"} ready to use. You have completed ${user.ads_watched} ads so far.`, destination: "/spin", cta: "Open roulette" };
  if (availableTasks > 0) return { ...photo, title: "Your next task", message: `${name}, you have ${availableTasks} available task${availableTasks === 1 ? "" : "s"} to check. Open Tasks to see the requirements and rewards.`, destination: "/tasks", cta: "View tasks" };
  return { ...photo, title: "Your next ADS session", message: `${name}, you have completed ${user.ads_watched} ads. Watch your next ad to receive a random reward and a roulette ticket.`, destination: "/", cta: "Open ADS" };
}