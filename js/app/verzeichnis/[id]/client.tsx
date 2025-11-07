"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";

type Entry = { name: string; isDir: boolean; size: number; mtime: string | null };

function kind(name: string): 'image' | 'pdf' | 'text' | 'other' {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['txt','log','csv','json','md','xml','html','htm'].includes(ext)) return 'text';
  return 'other';
}

export default function Client({ id, initial }: { id: string; initial: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initial || []);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<'image'|'pdf'|'text'|'other'>('other');
  const [textBody, setTextBody] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => { setEntries(initial || []); }, [initial]);

  async function openPreview(name: string) {
    const t = kind(name);
    setFileName(name);
    setFileType(t);
    setTextBody("");
    setOpen(true);
    if (t === 'text') {
      try {
        const res = await fetch(`/api/verzeichnis/${id}?name=${encodeURIComponent(name)}&inline=1`, { cache: 'no-store' });
        const txt = await res.text();
        setTextBody(txt);
      } catch {}
    }
  }

  async function reload() {
    try {
      const res = await fetch(`/api/verzeichnis/${id}`, { cache: 'no-store' });
      if (res.ok) setEntries(await res.json());
    } catch {}
  }

  async function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const res = await fetch(`/api/verzeichnis/${id}`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Upload fehlgeschlagen: ${data?.error ?? res.statusText}`);
      } else {
        const saved = Array.isArray(data?.saved) ? data.saved.length : 0;
        const errs = Array.isArray(data?.errors) ? data.errors.length : 0;
        setMsg(`Hochgeladen: ${saved}${errs ? `, Fehler: ${errs}` : ''}`);
        await reload();
      }
    } catch (err: any) {
      setMsg(`Upload-Fehler: ${String(err?.message ?? err)}`);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow divide-y">
      <div className="px-4 py-3 text-sm text-gray-600 flex items-center justify-between">
        <span>{entries.length} Einträge</span>
        <label className="btn">
          <input type="file" multiple className="hidden" onChange={onUploadChange} disabled={busy} />
          {busy ? 'Lade hoch…' : 'Dateien hochladen'}
        </label>
      </div>
      {msg && <div className="px-4 py-2 text-sm text-gray-700">{msg}</div>}
      <div className="px-4 py-2">
        <table className="min-w-full">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Typ</th>
              <th className="px-2 py-2">Größe</th>
              <th className="px-2 py-2">Geändert</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.name} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-2 font-mono break-all">
                  {e.isDir ? (
                    <span className="text-gray-700">{e.name}</span>
                  ) : (
                    <button className="link" onClick={() => openPreview(e.name)} title="Vorschau anzeigen">
                      {e.name}
                    </button>
                  )}
                </td>
                <td className="px-2 py-2">{e.isDir ? 'Ordner' : kind(e.name)}</td>
                <td className="px-2 py-2">{e.isDir ? '' : e.size}</td>
                <td className="px-2 py-2 text-sm text-gray-600">{e.mtime ?? ''}</td>
                <td className="px-2 py-2 text-right">
                  {!e.isDir && (
                    <a className="btn" href={`/api/verzeichnis/${id}?name=${encodeURIComponent(e.name)}`}>Download</a>
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
          {fileType === 'image' && (
            <img src={`/api/verzeichnis/${id}?name=${encodeURIComponent(fileName)}&inline=1`} className="max-h-[70vh] w-auto" />
          )}
          {fileType === 'pdf' && (
            <iframe src={`/api/verzeichnis/${id}?name=${encodeURIComponent(fileName)}&inline=1`} className="w-[90vw] h-[75vh] border" />
          )}
          {fileType === 'text' && (
            <pre className="whitespace-pre-wrap break-words max-h-[70vh] overflow-auto border rounded p-3 bg-gray-50">{textBody}</pre>
          )}
          {fileType === 'other' && (
            <p className="text-sm text-gray-700">Keine Vorschau verfügbar. Bitte herunterladen.</p>
          )}
          <div className="flex justify-end gap-2">
            <a className="btn" href={`/api/verzeichnis/${id}?name=${encodeURIComponent(fileName)}`}>Download</a>
            <button className="btn" onClick={() => setOpen(false)}>Schließen</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
