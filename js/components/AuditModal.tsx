"use client";
import { useEffect, useMemo, useState } from "react";

type Row = {
  id: number;
  at: string;
  action: string;
  table_name: string;
  row_pk: any;
  before: any;
  after: any;
  actor_user_id?: number | null;
  actor_email?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
};

export default function AuditModal({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState(""); // ISO local date-time string
  const [to, setTo] = useState("");
  const [action, setAction] = useState<string[]>([]);
  const [table, setTable] = useState<string>("");
  const [actor, setActor] = useState<string>(""); // email or id
  const [pk, setPk] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const actions = ["create","update","delete","export","login"] as const;

  async function search(p = 0) {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    if (action.length) params.set("action", action.join(","));
    if (table.trim()) params.set("table", table.trim());
    if (actor.trim()) params.set("actor", actor.trim());
    if (pk.trim()) params.set("pk", pk.trim());
    if (q.trim()) params.set("query", q.trim());
    params.set("limit", String(limit));
    params.set("offset", String(p * limit));
    const res = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data.data) ? data.data : []);
    setTotal(Number(data.total ?? 0));
    setPage(p);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    if (action.length) params.set("action", action.join(","));
    if (table.trim()) params.set("table", table.trim());
    if (actor.trim()) params.set("actor", actor.trim());
    if (pk.trim()) params.set("pk", pk.trim());
    if (q.trim()) params.set("query", q.trim());
    params.set("max", "25000");
    window.open(`/api/audit/export?${params.toString()}`, "_blank");
  }

  useEffect(() => { search(0); }, []);

  const selected = useMemo(() => new Set(action), [action]);
  const toggleAction = (a: string) => {
    setAction(prev => selected.has(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  return (
    <div className="w-[95vw] max-w-[1100px]">
      <h2 className="text-xl font-semibold mb-3">Aktivitäten</h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Von</label>
          <input type="datetime-local" className="input" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Bis</label>
          <input type="datetime-local" className="input" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Benutzer (E-Mail oder ID)</label>
          <input className="input" value={actor} onChange={e=>setActor(e.target.value)} placeholder="z.B. user@firma.de oder 17" />
        </div>
        <div>
          <label className="label">Tabelle</label>
          <input className="input" value={table} onChange={e=>setTable(e.target.value)} placeholder="z.B. ausschreibungen,users" />
        </div>
        <div>
          <label className="label">PK</label>
          <input className="input" value={pk} onChange={e=>setPk(e.target.value)} placeholder="z.B. 42" />
        </div>
        <div>
          <label className="label">Freitext</label>
          <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="sucht in before/after/row_pk" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm">Aktionen:</span>
        {actions.map(a => (
          <button key={a} className={`btn px-3 py-1 ${selected.has(a) ? 'bg-blue-600 text-white' : 'bg-white'}`} onClick={()=>toggleAction(a)}>{a}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={()=>search(0)}>Suchen</button>
          <button className="btn" onClick={exportCsv}>CSV Export</button>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto border rounded-xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="text-left p-2">Zeit</th>
              <th className="text-left p-2">Benutzer</th>
              <th className="text-left p-2">Aktion</th>
              <th className="text-left p-2">Tabelle</th>
              <th className="text-left p-2">PK</th>
              <th className="text-left p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                <td className="p-2">{r.actor_email ?? r.actor_user_id ?? '-'}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">{r.table_name}</td>
                <td className="p-2"><code className="text-xs">{JSON.stringify(r.row_pk)}</code></td>
                <td className="p-2">
                  <details>
                    <summary className="cursor-pointer">Diff</summary>
                    <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 p-2 rounded">
{JSON.stringify({before:r.before, after:r.after}, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-3" colSpan={6}>Keine Einträge</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-sm flex items-center justify-between">
        <div>Seite {page+1} / {totalPages} — {total} Treffer</div>
        <div className="flex gap-2">
          <button className="btn" disabled={page===0} onClick={()=>search(page-1)}>Zurück</button>
          <button className="btn" disabled={(page+1)>=totalPages} onClick={()=>search(page+1)}>Weiter</button>
        </div>
      </div>
    </div>
  );
}
