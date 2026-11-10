export const SITE = {
  name: "Tavarez Promos",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://tavarez-promos.vercel.app").replace(/\/$/, ""),
  channelUrl: process.env.NEXT_PUBLIC_CHANNEL_URL || "",
  botUsername: (process.env.NEXT_PUBLIC_BOT_USERNAME || "").replace(/^@/, ""),
};

export const botUrl = (start?: string) =>
  SITE.botUsername ? `https://t.me/${SITE.botUsername}${start ? `?start=${encodeURIComponent(start)}` : ""}` : "";
