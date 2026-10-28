import { BotEditor } from "@/components/BotEditor";

export const metadata = { title: "Bot — Tavarez Promos" };

export default function Page() {
  return (
    <>
      <div className="page-head"><h1 className="page-title">Bot</h1></div>
      <BotEditor />
    </>
  );
}
