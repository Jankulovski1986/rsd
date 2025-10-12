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
  grund_bei_ablehnung?: string | null;
  bemerkung?: string | null;
  abholfrist?: string | null;
  fragefrist?: string | null;
  besichtigung?: string | null;
  bewertung?: string | null;
  zuschlagsfrist?: string | null;
  ausfuehrung?: string | null;
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [limit, setLimit] = useState(500);
  const [openNew, setOpenNew] = useState(false);

  // Edit-Zustand
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const res = await fetch(`/api/ausschreibungen?limit=${limit}`, { cache: "no-store" });
    setRows(await res.json());
  }

  useEffect(()=>{ load(); }, [limit]);
  useEffect(()=>{ const t = setInterval(load, 5000); return ()=>clearInterval(t); }, [limit]);

  async function onDelete(id: number) {
    if (!confirm(`Diesen Datensatz (ID ${id}) wirklich löschen?`)) return;
    setBusyId(id);
    const res = await fetch(`/api/ausschreibungen/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      alert("Löschen fehlgeschlagen.");
      return;
    }
    await load();
  }

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ausschreibungen</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm">Zeilen laden:</label>
          <input type="range" min={50} max={5000} step={50}
            value={limit} onChange={e=>setLimit(Number(e.target.value))} />
          <button className="btn-success" onClick={()=>setOpenNew(true)}>➕ Neu</button>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3"><Kpis /></div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                {["ID","Abgabefrist","Uhrzeit","Ort","Name","Kurzbesch.","Teilnahme","Bearbeiter","Abgegeben","Vergabe-Nr.","Link","Aktionen"].map(h=>(
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
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button className="btn" onClick={() => { setSelected(r); setOpenEdit(true); }}>Bearbeiten</button>
                      <button className="btn" onClick={() => onDelete(r.id)} disabled={busyId===r.id}>
                        {busyId===r.id ? "Lösche…" : "Löschen"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ByMonthChart />
      </section>

      {/* Neu */}
      <Modal open={openNew} onClose={()=>setOpenNew(false)}>
        <NewForm
          mode="new"
          onSaved={() => { setOpenNew(false); load(); }}
          onCancel={()=>setOpenNew(false)}
        />
      </Modal>

      {/* Edit */}
      <Modal open={openEdit} onClose={()=>setOpenEdit(false)}>
        <NewForm
          mode="edit"
          initial={selected ?? undefined}
          onSaved={() => { setOpenEdit(false); load(); }}
          onCancel={()=>setOpenEdit(false)}
        />
      </Modal>
    </main>
  );
}
