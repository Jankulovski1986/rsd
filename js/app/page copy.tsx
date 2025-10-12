"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import NewForm from "@/components/NewForm";
import Kpis from "@/components/Kpis";
import ByMonthChart from "@/components/ByMonthChart";

type Row = {
  id: number;
  abgabefrist: string | null;
  uhrzeit: string | null;
  ort: string | null;
  name: string;
  kurzbesch_auftrag: string | null;
  teilnahme: string | null;
  bearbeiter: string | null;
  abgegeben: boolean | null;
  vergabe_nr: string | null;
  link: string | null;
  created_at: string;
  updated_at: string;
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [limit, setLimit] = useState(500);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch(`/api/ausschreibungen?limit=${limit}`, { cache: "no-store" });
    setRows(await res.json());
  }

  useEffect(()=>{ load(); }, [limit]);
  // sanftes Polling wie reactivePoll
  useEffect(()=>{ const t = setInterval(load, 5000); return ()=>clearInterval(t); }, [limit]);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ausschreibungen</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm">Zeilen laden:</label>
          <input type="range" min={50} max={5000} step={50}
            value={limit} onChange={e=>setLimit(Number(e.target.value))} />
          <button className="btn-success" onClick={()=>setOpen(true)}>➕ Neu</button>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3"><Kpis /></div>
        <div className="lg:col-span-3 bg-white rounded-2xl shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                {["ID","Abgabefrist","Uhrzeit","Ort","Name","Kurzbesch.","Teilnahme","Bearbeiter","Abgegeben","Vergabe-Nr.","Link"].map(h=>(
                  <th key={h} className="table-cell text-left text-sm font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                  <td className="table-cell">{r.id}</td>
                  <td className="table-cell">{r.abgabefrist ?? ""}</td>
                  <td className="table-cell">{r.uhrzeit ?? ""}</td>
                  <td className="table-cell">{r.ort ?? ""}</td>
                  <td className="table-cell">{r.name}</td>
                  <td className="table-cell">{r.kurzbesch_auftrag ?? ""}</td>
                  <td className="table-cell">{r.teilnahme ?? ""}</td>
                  <td className="table-cell">{r.bearbeiter ?? ""}</td>
                  <td className="table-cell">{r.abgegeben ? "Ja" : "Nein"}</td>
                  <td className="table-cell">{r.vergabe_nr ?? ""}</td>
                  <td className="table-cell">
                    {r.link ? <a className="text-blue-700 underline" href={r.link} target="_blank">Öffnen</a> : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ByMonthChart />
      </section>

      <Modal open={open} onClose={()=>setOpen(false)}>
        <NewForm
          onSaved={() => { setOpen(false); load(); }}
          onCancel={()=>setOpen(false)}
        />
      </Modal>
    </main>
  );
}
