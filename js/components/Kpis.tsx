"use client";
import { useEffect, useState } from "react";

export default function Kpis() {
  const [data, setData] = useState<{ total: number; open: number; nextDate: string | null; nextName: string | null }>({ total: 0, open: 0, nextDate: null, nextName: null });

  async function load() {
    try {
      const res = await fetch("/api/kpis", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.error("KPI fetch failed", err);
      setData({ total: 0, open: 0, nextDate: null, nextName: null });
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const formatDate = (value: string | null): string => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="kpi"><div className="text-sm text-gray-600">Einträge gesamt</div><div className="text-1xl font-semibold">{data.total}</div></div>
      <div className="kpi"><div className="text-sm text-gray-600">Offen (nicht abgegeben)</div><div className="text-1xl font-semibold">{data.open}</div></div>
      <div className="kpi"><div className="text-sm text-gray-600">Nächste Frist</div><div className="text-1xl font-semibold">{[formatDate(data.nextDate), data.nextName?.trim()].filter(Boolean).join(" - ")}</div></div>
      
    </div>
  );
}
