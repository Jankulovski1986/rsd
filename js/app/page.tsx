"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Modal from "@/components/Modal";
import Link from "next/link";
import Image from "next/image";
import NewForm from "@/components/NewForm";
import Kpis from "@/components/Kpis";
import LoginModal from "@/components/LoginModal";
import AuditModal from "@/components/AuditModal";
import InviteUserModal from "@/components/InviteUserModal";
import LogoImg from "../images/rsd_logo_lang.png";

// Dynamischer Row-Typ für flexible Spalten
type Row = Record<string, any>;

type SortKey = string;
type SortDir = "asc" | "desc";

const FETCH_LIMIT = 5000;
const DEFAULT_COLUMNS = [
  "id","abgabefrist","uhrzeit","ort","name","kurzbesch_auftrag","teilnahme","bearbeiter","abgegeben","vergabe_nr","link","verzeichnis"
];
const LABELS: Record<string,string> = {
  id: "ID",
  abgabefrist: "Abgabefrist",
  uhrzeit: "Uhrzeit",
  ort: "Ort",
  name: "Name",
  kurzbesch_auftrag: "Kurzbeschreibung",
  teilnahme: "Teilnahme",
  bearbeiter: "Bearbeiter",
  abgegeben: "Abgegeben",
  vergabe_nr: "Vergabe-Nr.",
  link: "Link",
  verzeichnis: "Verzeichnis",
  grund_bei_ablehnung: "Grund bei Ablehnung",
  bemerkung: "Bemerkung",
  abholfrist: "Abholfrist",
  fragefrist: "Fragefrist",
  besichtigung: "Besichtigung",
  bewertung: "Bewertung",
  zuschlagsfrist: "Zuschlagsfrist",
  ausfuehrung: "Ausführung",
  created_at: "Erstellt",
  updated_at: "Geändert",
};

export default function Page() {
  const { data: session, status } = useSession();
  const loadingSession = status === "loading";
  const role = ((session?.user as any)?.role as string | undefined) ?? 'viewer';
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [openNew, setOpenNew] = useState(false);
  const [openAuth, setOpenAuth] = useState(false);
  const [openAudit, setOpenAudit] = useState(false);
  
    const [openInvite, setOpenInvite] = useState(false);
  const [openExport, setOpenExport] = useState(false);

  // Edit-Zustand
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [openBulkDelete, setOpenBulkDelete] = useState(false);

  // Long-text preview modal
  const [openText, setOpenText] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");

  // DT-ähnliche Controls
  const [globalQuery, setGlobalQuery] = useState("");
  const [pageSize, setPageSize] = useState(50); // 10 | 50 | 100
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("abgabefrist");
  const [hideOverdueUnsubmitted, setHideOverdueUnsubmitted] = useState(true);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Scrollbars
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useLayoutEffect(() => {
    const update = () => setContentWidth(contentRef.current?.scrollWidth ?? 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [rows, columns]);

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

  async function loadColumns() {
    try {
      const res = await fetch('/api/ausschreibungen/columns', { cache: 'no-store' });
      if (!res.ok) return;
      const cols = await res.json();
      if (Array.isArray(cols) && cols.length) {
        setColumns(cols);
        if (!cols.includes(sortKey)) {
          setSortKey(cols.includes('abgabefrist') ? 'abgabefrist' : cols[0]);
        }
      }
    } catch {}
  }

  useEffect(() => { load(); loadColumns(); }, []);
  useEffect(() => { const t = setInterval(() => { load(); }, 5000); return () => clearInterval(t); }, []);

  async function doDelete(id: number) {
    setBusyId(id);
    const res = await fetch(`/api/ausschreibungen/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      alert("Löschen fehlgeschlagen.");
      return;
    }
    await load();
  }

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

  // Filter
  const filtered = useMemo(() => {
    const base = hideOverdueUnsubmitted
      ? rows.filter(r => !isOverdue(r?.abgabefrist ?? "", r?.abgegeben))
      : rows;
    const q = globalQuery.trim().toLowerCase();
    if (!q) return base;
    const cols = columns && columns.length ? columns : DEFAULT_COLUMNS;
    return base.filter(r => {
      const values = cols.map(c => String(r?.[c] ?? ""));
      return values.some(f => f.toLowerCase().includes(q));
    });
  }, [rows, globalQuery, columns, hideOverdueUnsubmitted]);

  // Sort
  const sorted = useMemo(() => {
    const data = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;

    data.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];

      const aNull = va === null || va === undefined || va === "";
      const bNull = vb === null || vb === undefined || vb === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      // Date-ish columns
      if (sortKey.includes("frist") || sortKey === "created_at" || sortKey === "updated_at" || sortKey === "abgabefrist") {
        const da = new Date(String(va));
        const db = new Date(String(vb));
        return (da.getTime() - db.getTime()) * dir;
      }

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }

      // booleans
      if (typeof va === "boolean" && typeof vb === "boolean") {
        return (Number(va) - Number(vb)) * dir;
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

  // Checkbox header/row helpers
  const headerCbxRef = useRef<HTMLInputElement>(null);
  const visibleIds = useMemo(() => paged.map(r => Number(r?.id)).filter(n => Number.isFinite(n)), [paged]);
  const allFilteredIds = useMemo(() => sorted.map(r => Number(r?.id)).filter(n => Number.isFinite(n)), [sorted]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedIds.has(id));
  useEffect(() => {
    const el = headerCbxRef.current; if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => { setPage(1); }, [globalQuery, sortKey, sortDir, pageSize]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  function toggleHeaderSelect() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const ids = visibleIds;
      const all = ids.length > 0 && ids.every(id => next.has(id));
      if (all) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  }

  function toggleRowSelect(id: number, checked: boolean) {
    setSelectedIds(prev => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next; });
  }

  async function doBulkDelete(ids: number[]) {
    for (const id of ids) { await doDelete(id); }
    setSelectedIds(new Set());
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(allFilteredIds));
  }

  function selectOnlyVisible() {
    setSelectedIds(new Set(visibleIds));
  }

  // Nur die Root/Domain als Linktext anzeigen
  function linkLabel(href: string): string {
    try { const u = new URL(href); return u.host; }
    catch { const s = String(href ?? ""); const s2 = s.replace(/^https?:\/\//i, ""); return s2.split("/")[0] || s; }
  }

  function normalizeLinkUrl(href: string): string {
    const s = String(href ?? "").trim();
    if (!s) return "";
    const hasScheme = /^([a-z][a-z0-9+.-]*):\/\//i.test(s);
    if (hasScheme) return s;
    if (s.startsWith("www.")) return "http://" + s;
    if (/^[^/:?#]+(\.[^/:?#]+)+/i.test(s)) return "http://" + s;
    return s;
  }

  function toFileUrl(p: string): string {
    const s = String(p ?? '').trim();
    if (!s) return '';
    // Normalize Windows backslashes to forward slashes for file URI
    const replaced = s.replace(/\\/g, '/');
    // Ensure leading slash after file:// for drive letters
    if (/^[A-Za-z]:\//.test(replaced)) {
      return 'file:///' + replaced.replace(/^([A-Za-z]):\//, (m, d) => `${d.toUpperCase()}:/`);
    }
    // UNC paths: \\server\share -> file:////server/share
    if (s.startsWith('\\\\')) {
      return 'file:' + replaced;
    }
    return replaced;
  }

  const DATE_ONLY_COLUMNS = new Set([
    'abgabefrist',
    'abholfrist',
    'fragefrist',
    'besichtigung',
    'zuschlagsfrist',
  ]);
  const DATETIME_COLUMNS = new Set(['created_at', 'updated_at']);

  function formatDateValue(value: unknown, withTime: boolean): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    return withTime
      ? `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      : datePart;
  }

  // Hervorhebung: Abgabefrist innerhalb der nächsten 7 Tage
  function parseYMD(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function isDueSoon(dateStr?: string | null): boolean {
    if (!dateStr) return false;
    const due = parseYMD(String(dateStr));
    if (!due) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= 7;
  }
  function isOverdue(dateStr?: string | null, submitted?: boolean): boolean {
    if (submitted) return false;
    if (!dateStr) return false;
    const due = parseYMD(String(dateStr));
    if (!due) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    return (
      <button className="table-cell text-left text-sm font-semibold select-none" onClick={() => toggleSort(k)} title="Sortieren">
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (
            sortDir === 'asc' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" className="opacity-70" aria-label="aufsteigend">
                <path d="M7 14l5-5 5 5H7z" fill="currentColor"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" className="opacity-70" aria-label="absteigend">
                <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
              </svg>
            )
          )}
        </span>
      </button>
    );
  };

  const LONG_THRESHOLD = 300; // ~60 chars * 5 lines

  function openFullText(title: string, body: string) {
    setTextTitle(title); setTextBody(body); setOpenText(true);
  }

  // CSV export (dynamische Spalten)
  
const exportXls = () => {
    const rowsToExport = sorted;
    if (!rowsToExport || rowsToExport.length === 0) { alert("Keine Daten fuer Export vorhanden."); return; }
    const cols = columns && columns.length ? columns : DEFAULT_COLUMNS;
    const headers = cols.map(c => LABELS[c] ?? c);

    const xmlEsc = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    let xml = '';
    xml += '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Styles>';
    xml += '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>';
    xml += '<Style ss:ID="sHeader"><Font ss:Bold="1"/></Style>';
    xml += '<Style ss:ID="sHighlight"><Interior ss:Color="#FFF9C4" ss:Pattern="Solid"/></Style>';
    xml += '</Styles>';
    xml += '<Worksheet ss:Name="Ausschreibungen"><Table>';

    // header
    xml += '<Row ss:StyleID="sHeader">';
    for (const h of headers) { xml += '<Cell><Data ss:Type="String">' + xmlEsc(h) + '</Data></Cell>'; }
    xml += '</Row>';

    for (const r of rowsToExport) {
      const dueSoon = isDueSoon(String(r?.abgabefrist ?? ''));
      xml += dueSoon ? '<Row ss:StyleID="sHighlight">' : '<Row>';
      for (const c of cols) {
        let v: any = r?.[c];
        if (c === 'abgegeben') v = v ? 'Ja' : 'Nein';
        xml += '<Cell><Data ss:Type="String">' + xmlEsc(v) + '</Data></Cell>';
      }
      xml += '</Row>';
    }

    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `ausschreibungen_export_${ts}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
const exportCsv = () => {
    const rowsToExport = sorted;
    if (!rowsToExport || rowsToExport.length === 0) { alert("Keine Daten fuer Export vorhanden."); return; }
    const cols = columns && columns.length ? columns : DEFAULT_COLUMNS;
    const headers = cols.map(c => LABELS[c] ?? c);
    const esc = (v: unknown): string => {
      const s0 = String(v ?? "");
      const needsQuote = s0.includes(";") || s0.includes("\n") || s0.includes("\r") || s0.includes('"');
      if (needsQuote) return '"' + s0.replace(/"/g, '""') + '"';
      return s0;
    };
    const lines = [headers.join(";")];
    for (const r of rowsToExport) {
      lines.push(cols.map(c => c === 'abgegeben' ? esc(r[c] ? "Ja" : "Nein") : esc(r[c])).join(";"));
    }
    const content = "\ufeff" + lines.join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `ausschreibungen_export_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

      const HeaderBar = (
    <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4 md:flex-1">
          <Image src={LogoImg} alt="RSD Logo" className="h-16 w-auto object-contain" priority />
          <h1 className="text-2xl sm:text-3xl font-semibold sm:flex-1 sm:text-left md:text-center">Ausschreibungen</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end md:ml-4 min-h-[40px]">
          {loadingSession ? (
            <div className="flex flex-wrap items-center gap-2 animate-pulse">
              <div className="h-10 w-20 rounded-xl bg-gray-200" />
              <div className="h-10 w-24 rounded-xl bg-gray-200" />
              <div className="h-10 w-16 rounded-xl bg-gray-200" />
              <div className="h-10 w-20 rounded-xl bg-gray-200" />
              <div className="h-10 w-20 rounded-xl bg-gray-200" />
            </div>
          ) : (
            <>
              <button className="btn-success" onClick={() => setOpenNew(true)} disabled={role === 'viewer'} title={role==='viewer' ? 'Nur Lesen' : undefined}>
                + Neu
              </button>
              {role === 'viewer' ? (
                <button className="btn" onClick={()=>setOpenAuth(true)}>Login</button>
              ) : (
                <>
                  {role === 'admin' && (<>
                    <button className="btn-success" onClick={()=>setOpenInvite(true)}>+ Benutzer</button>
                    <button className="btn" onClick={()=>setOpenAudit(true)}>Audit</button>
                  </>)}
                  <button className="btn" onClick={() => setOpenExport(true)} disabled={role === 'viewer'} title={role==='viewer' ? 'Nur Lesen' : undefined}>Export</button>
                  <button className="btn" onClick={async ()=>{ await signOut({ redirect: false }); window.location.reload(); }}>Logout</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );

  const Pagination = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm py-2">
      <div>
        <div>
          Zeige <b>{paged.length}</b> von <b>{totalRows}</b> Einträgen - Seite <b>{currentPage}</b>/<b>{totalPages}</b>
        </div>
        {(selectedIds.size > 0 && role !== 'viewer') ? (
          <div className="mt-1 flex items-center gap-2 text-gray-700">
            <button className="btn" onClick={() => setOpenBulkDelete(true)} title="Ausgewählte löschen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1l-1.1 12.1A3 3 0 0 1 14.91 22H9.09a3 3 0 0 1-2.99-2.9L5 7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1Zm1 2v0h4V5h-4Zm-2.9 2 1 12.1A1 1 0 0 0 9.09 20h5.82a1 1 0 0 0 .99-.9L17.9 7H7.1ZM10 9a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" />
              </svg>
            </button>
            <span>{selectedIds.size} ausgewählt</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Zurück</button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
            const n = i + 1; if (n > totalPages) return null;
            return (
              <button key={n} className={`px-3 py-1 rounded ${n === currentPage ? "bg-blue-600 text-white" : "bg-white shadow"}`} onClick={() => setPage(n)}>{n}</button>
            );
          })}
          {totalPages > 7 && <span>.</span>}
          {totalPages > 7 && (
            <button className={`px-3 py-1 rounded ${currentPage === totalPages ? "bg-blue-600 text-white" : "bg-white shadow"}`} onClick={() => setPage(totalPages)}>
              {totalPages}
            </button>
          )}
        </div>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Weiter →</button>
        <button className="btn" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>⏭</button>
      </div>
    </div>
  );

  return (<main className="max-w-7xl mx-auto p-6 space-y-6">
      {HeaderBar}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3"><Kpis /></div>
        <div className="lg:col-span-3 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between bg-white rounded-2xl shadow px-4 py-3">
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setPage(1)} disabled={currentPage === 1}>⏮</button>
            <label className="text-sm whitespace-nowrap">Suche:</label>
            <input className="input" placeholder="Suche in allen Spalten" value={globalQuery} onChange={e => setGlobalQuery(e.target.value)} style={{ width: 220 }} />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={hideOverdueUnsubmitted}
                onChange={e => { setHideOverdueUnsubmitted(e.target.checked); setPage(1); }}
              />
              Abgelaufene ausblenden
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap">Zeilen pro Seite:</label>
            <select className="input" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow">
          <div className="px-4">{Pagination}</div>

          <div className="scroller-x" ref={topRef}>
            <div className="min-w-max" ref={contentRef}>
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="w-10 text-left">
                      <input ref={headerCbxRef} type="checkbox" className="checkbox" onChange={toggleHeaderSelect} checked={allVisibleSelected} disabled={role === 'viewer'} />
                    </th>
                    {columns.map(col => (
                      <th key={col} className="text-left"><SortHeader label={LABELS[col] ?? col} k={col} /></th>
                    ))}
                    <th className="table-cell text-left text-sm font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => {
                    const overdue = isOverdue(r?.abgabefrist ?? "", r?.abgegeben);
                    const highlight = !overdue && !r?.abgegeben && isDueSoon(r?.abgabefrist ?? "");
                    const rowClass = overdue ? "bg-red-100" : highlight ? "bg-yellow-100" : "odd:bg-white even:bg-gray-50";
                    return (
                      <tr key={r.id ?? JSON.stringify(r)} className={rowClass}>
                        <td className="table-cell text-left">
                          <input type="checkbox" className="checkbox" checked={selectedIds.has(Number(r?.id))} onChange={e => toggleRowSelect(Number(r?.id), e.currentTarget.checked)} disabled={role === 'viewer'} />
                        </td>
                        {columns.map(col => {
                          const val = r?.[col];
                          if (col === 'link') {
                            return (
                              <td key={col} className="table-cell text-left">
                                {val ? (
                                  <a className="text-blue-700 underline" href={normalizeLinkUrl(String(val))} target="_blank" rel="noopener noreferrer">
                                    {linkLabel(String(val))}
                                  </a>
                                ) : ''}
                              </td>
                            );
                          }
                          if (col === 'verzeichnis') {
                            const p = String(val ?? '');
                            const parts = p.split(/[\\/]+/).filter(Boolean);
                            const name = parts.length ? parts[parts.length-1] : '';
                            const id = r?.id;
                            return (
                              <td key={col} className="table-cell text-left">
                                {id ? (
                                  <Link className="text-blue-700 underline" href={`/verzeichnis/${id}`} title={p}>
                                    {name || p || `Ordner ${id}`}
                                  </Link>
                                ) : (name || p)}
                              </td>
                            );
                          }
                          if (col === 'abgegeben') {
                            return <td key={col} className="table-cell text-left">{val ? 'Ja' : 'Nein'}</td>;
                          }
                          if (col === 'kurzbesch_auftrag' || col === 'bemerkung') {
                            const text = String(val ?? '');
                            const long = text.length > LONG_THRESHOLD;
                            const title = col === 'kurzbesch_auftrag' ? 'Kurzbeschreibung' : 'Bemerkung';
                            return (
                              <td key={col} className="table-cell align-top text-left">
                                <div
                                  className={`wrap-60ch clamp-5 ${long ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={long ? () => openFullText(title, text) : undefined}
                                  title={long ? 'Volltext anzeigen' : undefined}
                                >
                                  {text}
                                </div>
                              </td>
                            );
                          }
                          if (DATE_ONLY_COLUMNS.has(col) || DATETIME_COLUMNS.has(col)) {
                            const formatted = formatDateValue(val, DATETIME_COLUMNS.has(col));
                            return <td key={col} className="table-cell text-left">{formatted}</td>;
                          }
                          return <td key={col} className="table-cell text-left">{String(val ?? '')}</td>;
                        })}
                        <td className="table-cell text-left">
                          <div className="flex gap-2">
                            <button className="btn" onClick={() => { setSelected(r); setOpenEdit(true); }} disabled={role === 'viewer'} title={role==='viewer' ? 'Nur Lesen' : undefined}>Bearbeiten</button>
                            <button className="btn" onClick={() => { setDeleteRow(r); setOpenDelete(true); }} disabled={role === 'viewer' || busyId === (r.id ?? null)} title={role==='viewer' ? 'Nur Lesen' : undefined}>
                              {busyId === (r.id ?? null) ? "Lösche…" : "Löschen"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td className="table-cell text-left" colSpan={(columns?.length ?? 0) + 2}>Keine Einträge gefunden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-4 border-t">{Pagination}</div>
          <div className="scroller-x" ref={bottomRef} aria-hidden />
        </div>
        </section>

<Modal open={openExport} onClose={() => setOpenExport(false)} panelClassName="modal-panel-narrow">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Export</h2>
          <p className="text-sm text-gray-700">Bitte Format auswählen:</p>
          <div className="flex gap-2 justify-end">
            <button className="btn" onClick={() => { setOpenExport(false); exportCsv(); }}>CSV</button>
            <button className="btn-success" onClick={() => { setOpenExport(false); exportXls(); }}>Excel</button>
          </div>
        </div>
      </Modal>
{/* Volltext-Modal für lange Kurzbesch./Bemerkung */}
      <Modal open={openText} onClose={() => setOpenText(false)}>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{textTitle}</h2>
          <div className="border rounded p-3 bg-gray-50 max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words">{textBody}</pre>
          </div>
          <div className="flex justify-end">
            <button className="btn" onClick={() => setOpenText(false)}>Schließen</button>
          </div>
        </div>
      </Modal>

      <Modal open={openBulkDelete} onClose={() => setOpenBulkDelete(false)}>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{selectedIds.size} Datensätze löschen?</h2>
          <p className="text-sm text-gray-700">Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setOpenBulkDelete(false)}>Abbrechen</button>
            <button className="btn-primary" disabled={selectedIds.size===0} onClick={async ()=>{ await doBulkDelete(Array.from(selectedIds)); setOpenBulkDelete(false); }}>
              Löschen
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={openNew} onClose={() => setOpenNew(false)}>
        <NewForm
          mode="new"
          onSaved={() => { setOpenNew(false); load(); }}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)}>
        <NewForm
          mode="edit"
          initial={selected ?? undefined}
          onSaved={() => { setOpenEdit(false); load(); }}
          onCancel={() => setOpenEdit(false)}
        />
      </Modal>

      <Modal open={openDelete} onClose={() => setOpenDelete(false)}>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Wirklich löschen?</h2>
          <p className="text-sm text-gray-700">
            {deleteRow ? (
              <>Datensatz ID <b>{deleteRow?.id}</b>{deleteRow?.name ? <> ({String(deleteRow?.name)})</> : null} wird dauerhaft gelöscht.</>
            ) : (
              <>Ausgewählten Datensatz dauerhaft löschen.</>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setOpenDelete(false)}>Abbrechen</button>
            <button className="btn-primary" disabled={!deleteRow || busyId === (deleteRow?.id ?? null)} onClick={async () => {
              if (!deleteRow) return; await doDelete(deleteRow.id); setOpenDelete(false); setDeleteRow(null);
            }}>
              {busyId === (deleteRow?.id ?? null) ? "Lösche…" : "Löschen"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={openAuth} onClose={() => setOpenAuth(false)} panelClassName="modal-panel-narrow">
        <LoginModal onClose={() => setOpenAuth(false)} />
      </Modal>

      <Modal open={openAudit} onClose={() => setOpenAudit(false)}>
        <AuditModal onClose={() => setOpenAudit(false)} />
      </Modal>

      <Modal open={openInvite} onClose={() => setOpenInvite(false)} panelClassName="modal-panel-narrow">
        <InviteUserModal onClose={() => setOpenInvite(false)} />
      </Modal>
    </main>
  );
}





  





























