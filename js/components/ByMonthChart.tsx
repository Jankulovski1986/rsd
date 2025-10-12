"use client";
import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

export default function ByMonthChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  async function loadAndRender() {
    const res = await fetch("/api/by_month", { cache: "no-store" });
    const rows: { monat: string; n: number }[] = await res.json();
    const labels = rows.map(r => r.monat.slice(0,10));
    const values = rows.map(r => r.n);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current!, {
      type: "line",
      data: { labels, datasets: [{ label: "Anzahl pro Monat", data: values }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  useEffect(()=>{ loadAndRender(); }, []);

  return <div className="h-80 bg-white rounded-2xl shadow p-4"><canvas ref={canvasRef} /></div>;
}
