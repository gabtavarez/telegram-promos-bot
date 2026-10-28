import { AdsEditor } from "@/components/AdsEditor";

export const metadata = { title: "Anúncios — Tavarez Promos" };

export default function Page() {
  return (
    <>
      <div className="page-head"><h1 className="page-title">Anúncios</h1></div>
      <AdsEditor />
    </>
  );
}
