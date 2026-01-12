"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Modal from "@/components/Modal";

type Entry = { name: string; isDir: boolean; size: number; mtime: string | null };

function kind(name: string): "image" | "pdf" | "text" | "other" {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["txt", "log", "csv", "json", "md", "xml", "html", "htm"].includes(ext)) return "text";
  return "other";
}

type Props = { id: string; initial: Entry[]; dirName?: string | null };

export default function Client({ id, initial }: Props) {
  const [entries, setEntries] = useState<Entry[]>(Array.isArray(initial) ? initial : []);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<"image" | "pdf" | "text" | "other">("other");
  const [textBody, setTextBody] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  useEffect(() => { setEntries(Array.isArray(initial) ? initial : []); }, [initial]);
  useEffect(() => {
    // remove selections that no longer exist
    setSelected(prev => {
      const names = new Set(entries.filter(e => !e.isDir).map(e => e.name));
      const next = new Set<string>();
      prev.forEach(n => { if (names.has(n)) next.add(n); });
      return next;
    });
  }, [entries]);

  async function openPreview(name: string) {
    const t = kind(name);
    setFileName(name);
    setFileType(t);
    setTextBody("");
    setOpen(true);
    if (t === "text") {
      try {
        const res = await fetch(`/api/verzeichnis/${id}?name=${encodeURIComponent(name)}&inline=1`, { cache: "no-store" });
        const txt = await res.text();
        setTextBody(txt);
      } catch {}
    }
  }

  async function reload() {
    try {
      const res = await fetch(`/api/verzeichnis/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && typeof data === "object" && "entries" in data) {
        setEntries(Array.isArray((data as any).entries) ? (data as any).entries : []);
      } else {
        setEntries(Array.isArray(data) ? data : []);
      }
    } catch {}
  }

  async function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch(`/api/verzeichnis/${id}`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Upload fehlgeschlagen: ${data?.error ?? res.statusText}`);
      } else {
        const saved = Array.isArray(data?.saved) ? data.saved.length : 0;
        const errs = Array.isArray(data?.errors) ? data.errors.length : 0;
        setMsg(`Hochgeladen: ${saved}${errs ? `, Fehler: ${errs}` : ""}`);
        await reload();
      }
    } catch (err: any) {
      setMsg(`Upload-Fehler: ${String(err?.message ?? err)}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  const selectable = useMemo(
    () => (Array.isArray(entries) ? entries.filter(e => !e.isDir).map(e => e.name) : []),
    [entries]
  );
  const allSelected = selectable.length > 0 && selectable.every(n => selected.has(n));

  function toggleRow(name: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(name); else next.delete(name);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(selectable));
    else setSelected(new Set());
  }

  async function onDeleteFile(name: string) {
    if (!isAuthed) { setMsg("Loeschen nur fuer angemeldete Nutzer."); return; }
    setDeleting(name);
    setMsg("");
    try {
      const res = await fetch(`/api/verzeichnis/${id}?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Loeschen fehlgeschlagen: ${data?.error ?? res.statusText}`);
      } else {
        await reload();
        setMsg("Datei geloescht.");
      }
    } catch (err: any) {
      setMsg(`Loesch-Fehler: ${String(err?.message ?? err)}`);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  async function onDeleteSelected() {
    if (!isAuthed) { setMsg("Loeschen nur fuer angemeldete Nutzer."); return; }
    const names = Array.from(selected);
    if (names.length === 0) return;
    setMsg("");
    setDeleting("bulk");
    try {
      for (const n of names) {
        const res = await fetch(`/api/verzeichnis/${id}?name=${encodeURIComponent(n)}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMsg(`Loeschen fehlgeschlagen bei ${n}: ${data?.error ?? res.statusText}`);
          break;
        }
      }
      await reload();
      setSelected(new Set());
      setMsg("Auswahl geloescht.");
    } catch (err: any) {
      setMsg(`Loesch-Fehler: ${String(err?.message ?? err)}`);
    } finally {
      setDeleting(null);
      setConfirmBulkDelete(false);
    }
  }

  function downloadSelected() {
    const names = Array.from(selected);
    if (!names.length) return;
    names.forEach((n) => {
      const a = document.createElement("a");
      a.href = `/api/verzeichnis/${id}?name=${encodeURIComponent(n)}`;
      a.download = n;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow divide-y">
      <div className="px-4 py-3 text-sm text-gray-600 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span>{entries.length} Einträge</span>
          <span className="text-gray-500">({selected.size} ausgewählt)</span>
          <label className="inline-flex items-center gap-1 text-sm">
            <input type="checkbox" className="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} />
            Alle
          </label>
          <button className="btn" onClick={() => toggleAll(false)} disabled={selected.size === 0}>Auswahl leeren</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <button className="btn" onClick={downloadSelected} title="Auswahl herunterladen">
                <span className="inline-flex items-center gap-1">
                  <DownloadIcon /> Download
                </span>
              </button>
              {isAuthed && (
                <button className="btn" onClick={() => setConfirmBulkDelete(true)} disabled={!!deleting} title="Auswahl löschen">
                  <span className="inline-flex items-center gap-1">
                    <TrashIcon /> Löschen
                  </span>
                </button>
              )}
            </>
          )}
          <label className="btn">
            <input type="file" multiple className="hidden" onChange={onUploadChange} disabled={busy} />
            {busy ? "Lade hoch..." : "Dateien hochladen"}
          </label>
        </div>
      </div>
      {msg && <div className="px-4 py-2 text-sm text-gray-700">{msg}</div>}
      <div className="px-4 py-2">
        <table className="min-w-full">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-2 py-2 w-10">
                <input type="checkbox" className="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} />
              </th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Typ</th>
              <th className="px-2 py-2">Größe</th>
              <th className="px-2 py-2">Geändert</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(entries) ? entries : []).map((e) => (
              <tr key={e.name} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-2">
                  {!e.isDir && (
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected.has(e.name)}
                      onChange={ev => toggleRow(e.name, ev.target.checked)}
                    />
                  )}
                </td>
                <td className="px-2 py-2 font-mono break-all">
                  {e.isDir ? (
                    <span className="text-gray-700">{e.name}</span>
                  ) : (
                    <button className="link" onClick={() => openPreview(e.name)} title="Vorschau anzeigen">
                      {e.name}
                    </button>
                  )}
                </td>
                <td className="px-2 py-2">{e.isDir ? "Ordner" : kind(e.name)}</td>
                <td className="px-2 py-2">{e.isDir ? "" : e.size}</td>
                <td className="px-2 py-2 text-sm text-gray-600">{e.mtime ?? ""}</td>
                <td className="px-2 py-2 text-right">
                  {!e.isDir && (
                    <div className="flex justify-end gap-2">
                      <a className="btn" href={`/api/verzeichnis/${id}?name=${encodeURIComponent(e.name)}`}>Download</a>
                      {isAuthed && (
                        <button
                          className="btn"
                          onClick={() => setConfirmDelete(e.name)}
                          disabled={deleting === e.name}
                        >
                          {deleting === e.name ? "Lösche..." : "Löschen"}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold break-all">{fileName}</h2>
          {fileType === "image" && (
            <img src={`/api/verzeichnis/${id}?name=${encodeURIComponent(fileName)}&inline=1`} className="max-h-[70vh] w-auto" />
          )}
          {fileType === "pdf" && (
            <iframe src={`/api/verzeichnis/${id}?name=${encodeURIComponent(fileName)}&inline=1`} className="w-[90vw] h-[75vh] border" />
          )}
          {fileType === "text" && (
            <pre className="whitespace-pre-wrap break-words max-h-[70vh] overflow-auto border rounded p-3 bg-gray-50">{textBody}</pre>
          )}
          {fileType === "other" && (
            <p className="text-sm text-gray-700">Keine Vorschau verfügbar. Bitte herunterladen.</p>
          )}
          <div className="flex justify-end gap-2">
            <a className="btn" href={`/api/verzeichnis/${id}?name=${encodeURIComponent(fileName)}`}>Download</a>
            <button className="btn" onClick={() => setOpen(false)}>Schließen</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => { if (!deleting) setConfirmDelete(null); }} panelClassName="modal-panel-narrow">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Datei löschen?</h2>
          <p className="text-sm text-gray-700">
            Soll die Datei <b className="break-all">{confirmDelete}</b> wirklich gelöscht werden?
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => { if (!deleting) setConfirmDelete(null); }}>Abbrechen</button>
            <button
              className="btn-primary"
              disabled={!confirmDelete || deleting === confirmDelete}
              onClick={() => { if (confirmDelete) onDeleteFile(confirmDelete); }}
            >
              {deleting === confirmDelete ? "Lösche..." : "Löschen"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmBulkDelete} onClose={() => { if (!deleting) setConfirmBulkDelete(false); }} panelClassName="modal-panel-narrow">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Auswahl löschen?</h2>
          <p className="text-sm text-gray-700">
            {selected.size} Dateien werden gelöscht.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => { if (!deleting) setConfirmBulkDelete(false); }}>Abbrechen</button>
            <button
              className="btn-primary"
              disabled={selected.size === 0 || deleting === "bulk"}
              onClick={onDeleteSelected}
            >
              {deleting === "bulk" ? "Lösche..." : "Löschen"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1l-1.1 12.1A3 3 0 0 1 14.91 22H9.09a3 3 0 0 1-2.99-2.9L5 7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1Zm1 2v0h4V5h-4Zm-2.9 2 1 12.1A1 1 0 0 0 9.09 20h5.82a1 1 0 0 0 .99-.9L17.9 7H7.1ZM10 9a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" fill="currentColor" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 3a1 1 0 0 1 1 1v9.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L11 13.586V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" fill="currentColor" />
    </svg>
  );
}
