"use client";
import { useEffect, useState } from "react";

export default function Kpis() {
  const [data, setData] = useState<{total:number; open:number; nextDate:string|null}>({total:0, open:0, nextDate:null});

  async function load() {
    const res = await fetch("/api/kpis", { cache: "no-store" });
    setData(await res.json());
  }
  useEffect(()=>{ load(); const t = setInterval(load, 5000); return ()=>clearInterval(t); }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="kpi"><div className="text-sm text-gray-600">Einträge gesamt</div><div className="text-3xl font-semibold">{data.total}</div></div>
      <div className="kpi"><div className="text-sm text-gray-600">Offen (nicht abgegeben)</div><div className="text-3xl font-semibold">{data.open}</div></div>
      <div className="kpi"><div className="text-sm text-gray-600">Nächste Frist</div><div className="text-2xl">{data.nextDate ?? "—"}</div></div>
    </div>
  );
}
