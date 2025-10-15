"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

type SortKey = keyof Row;
type SortDir = "asc" | "desc";

const FETCH_LIMIT = 5000; // wir holen "genug" für Client-Sort/Filter/Pagination

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [openNew, setOpenNew] = useState(false);

  // Edit-Zustand
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // DT-ähnliche Controls
  const [globalQuery, setGlobalQuery] = useState("");
  const [pageSize, setPageSize] = useState(50); // 10 | 50 | 100
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("abgabefrist");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Scrollbars (deine bestehende Logik bleibt)
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useLayoutEffect(() => {
    const update = () => setContentWidth(contentRef.current?.scrollWidth ?? 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [rows]);

  useEffect(() => {
    const top = topRef.current, bottom = bottomRef.current;
    if (!top || !bottom) return;
    let lock = false;
    const sync = (from: HTMLElement, to: HTMLElement) => {
      if (lock) return;
      lock = true;
      to.scrollLeft = from.scrollLeft;
      requestAnimationFrame(() => (lock = false));
    };
    const onTop = () => sync(top, bottom);
    const onBottom = () => sync(bottom, top);
    top.addEventListener("scroll", onTop);
    bottom.addEventListener("scroll", onBottom);
    return () => {
      top.removeEventListener("scroll", onTop);
      bottom.removeEventListener("scroll", onBottom);
    };
  }, [contentWidth]);

  async function load() {
    try {
      const res = await fetch(`/api/ausschreibungen?limit=${FETCH_LIMIT}`, { cache: "no-store" });
      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();
      if (!res.ok || !text.trim() || !contentType.includes("application/json")) {
        console.error(`API Fehler oder kein JSON. HTTP ${res.status} ${res.statusText}`);
        setRows([]);
        return;
      }
      const data = JSON.parse(text);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch/Parse-Fehler:", err);
      setRows([]);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

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

  // ---- DT-ähnliche Logik: Filter → Sort → Paginate ----
  const filtered = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const fields = [
        r.id?.toString() ?? "",
        r.abgabefrist ?? "",
        r.uhrzeit ?? "",
        r.ort ?? "",
        r.name ?? "",
        r.kurzbesch_auftrag ?? "",
        r.teilnahme ?? "",
        r.bearbeiter ?? "",
        r.vergabe_nr ?? "",
        r.link ?? ""
      ];
      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [rows, globalQuery]);

  const sorted = useMemo(() => {
    const data = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    const getVal = (r: Row, key: SortKey) => (r[key] ?? null);

    data.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);

      // Nulls immer ans Ende (wie DataTables ungefähr handhabt)
      const aNull = va === null || va === undefined || va === "";
      const bNull = vb === null || vb === undefined || vb === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      // Datumsvergleich für YYYY-MM-DD Strings
      if (sortKey.includes("frist") || sortKey === "created_at" || sortKey === "updated_at" || sortKey === "abgabefrist") {
        const da = new Date(String(va));
        const db = new Date(String(vb));
        const cmp = da.getTime() - db.getTime();
        return cmp * dir;
      }

      // Numerisch vs. lexikografisch
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }

      return String(va).localeCompare(String(vb), "de", { numeric: true }) * dir;
    });
    return data;
  }, [filtered, sortKey, sortDir]);

  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  useEffect(() => {
    // Bei Filter/Sort Seitenzahl zurücksetzen
    setPage(1);
  }, [globalQuery, sortKey, sortDir, pageSize]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    return (
      <button
        className="table-cell text-left text-sm font-semibold select-none"
        onClick={() => toggleSort(k)}
        title="Sortieren"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="opacity-70">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
        </span>
      </button>
    );
  };

  const HeaderBar = (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <h1 className="text-2xl font-semibold">Ausschreibungen</h1>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        {/* Suche */}
        <div className="flex items-center gap-2">
          <label className="text-sm whitespace-nowrap">Suche:</label>
          <input
            className="input"
            placeholder="Suchen in ID, Name, Ort, Kurzbesch., Vergabe-Nr., Link…"
            value={globalQuery}
            onChange={e => setGlobalQuery(e.target.value)}
            style={{ width: 320 }}
          />
        </div>

        {/* Page-Length Dropdown wie DataTables */}
        <div className="flex items-center gap-2">
          <label className="text-sm whitespace-nowrap">Zeilen pro Seite:</label>
          <select
            className="input"
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <button className="btn-success" onClick={() => setOpenNew(true)}>➕ Neu</button>
      </div>
    </header>
  );

  const Pagination = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm py-2">
      <div>
        Zeige <b>{paged.length}</b> von <b>{totalRows}</b> Einträgen · Seite <b>{currentPage}</b>/<b>{totalPages}</b>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => setPage(1)} disabled={currentPage === 1}>⏮</button>
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹ Zurück</button>

        {/* einfache Seitennavigation (kompakt) */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
            const n = i + 1;
            if (n > totalPages) return null;
            return (
              <button
                key={n}
                className={`px-3 py-1 rounded ${n === currentPage ? "bg-blue-600 text-white" : "bg-white shadow"}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            );
          })}
          {totalPages > 7 && <span>…</span>}
          {totalPages > 7 && (
            <button
              className={`px-3 py-1 rounded ${currentPage === totalPages ? "bg-blue-600 text-white" : "bg-white shadow"}`}
              onClick={() => setPage(totalPages)}
            >
              {totalPages}
            </button>
          )}
        </div>

        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Weiter ›</button>
        <button className="btn" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>⏭</button>
      </div>
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      {HeaderBar}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3"><Kpis /></div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow">
          {/* Top Pagination */}
          <div className="px-4">{Pagination}</div>

          {/* Scrollbereich */}
          <div className="scroller-x" ref={topRef}>
            <div className="min-w-max" ref={contentRef}>
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th><SortHeader label="ID" k="id" /></th>
                    <th><SortHeader label="Abgabefrist" k="abgabefrist" /></th>
                    <th><SortHeader label="Uhrzeit" k="uhrzeit" /></th>
                    <th><SortHeader label="Ort" k="ort" /></th>
                    <th><SortHeader label="Name" k="name" /></th>
                    <th><SortHeader label="Kurzbesch." k="kurzbesch_auftrag" /></th>
                    <th><SortHeader label="Teilnahme" k="teilnahme" /></th>
                    <th><SortHeader label="Bearbeiter" k="bearbeiter" /></th>
                    <th><SortHeader label="Abgegeben" k="abgegeben" /></th>
                    <th><SortHeader label="Vergabe-Nr." k="vergabe_nr" /></th>
                    <th className="table-cell text-left text-sm font-semibold">Link</th>
                    <th className="table-cell text-left text-sm font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => (
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
                          <button className="btn" onClick={() => onDelete(r.id)} disabled={busyId === r.id}>
                            {busyId === r.id ? "Lösche…" : "Löschen"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td className="table-cell" colSpan={12}>Keine Einträge gefunden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Pagination (gesynct via Scroll-Handler) */}
          <div className="px-4 border-t">{Pagination}</div>
          <div className="scroller-x" ref={bottomRef} aria-hidden />
        </div>

        <ByMonthChart />
      </section>

      {/* Neu */}
      <Modal open={openNew} onClose={() => setOpenNew(false)}>
        <NewForm
          mode="new"
          onSaved={() => { setOpenNew(false); load(); }}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>

      {/* Edit */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)}>
        <NewForm
          mode="edit"
          initial={selected ?? undefined}
          onSaved={() => { setOpenEdit(false); load(); }}
          onCancel={() => setOpenEdit(false)}
        />
      </Modal>
    </main>
  );
}
