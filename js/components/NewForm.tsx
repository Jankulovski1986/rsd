"use client";
import { useEffect, useState } from "react";

type Mode = "new" | "edit";
type Row = {
  id?: number;
  abgabefrist?: string | null; uhrzeit?: string | null; ort?: string | null; name?: string;
  kurzbesch_auftrag?: string | null; teilnahme?: string | null; grund_bei_ablehnung?: string | null;
  bearbeiter?: string | null; bemerkung?: string | null; abgegeben?: boolean | null;
  abholfrist?: string | null; fragefrist?: string | null; besichtigung?: string | null; bewertung?: string | null;
  zuschlagsfrist?: string | null; ausfuehrung?: string | null; vergabe_nr?: string | null; link?: string | null;
};

type Props = {
  mode: Mode;
  initial?: Row;    // für Edit
  onSaved: () => void;
  onCancel: () => void;
};

export default function NewForm({ mode, initial, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({
    abgabefrist: "", uhrzeit:"", ort:"", name:"", kurzbesch_auftrag:"",
    teilnahme:"", grund_bei_ablehnung:"", bearbeiter:"", bemerkung:"",
    abgegeben:false, abholfrist:"", fragefrist:"", besichtigung:"",
    bewertung:"", zuschlagsfrist:"", ausfuehrung:"", vergabe_nr:"", link:""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameValid = (form.name ?? "").trim().length > 0;

  // Initialwerte für Edit
  useEffect(() => {
    if (!initial) return;
    setForm({
      abgabefrist: initial.abgabefrist ?? "",
      uhrzeit: initial.uhrzeit ?? "",
      ort: initial.ort ?? "",
      name: initial.name ?? "",
      kurzbesch_auftrag: initial.kurzbesch_auftrag ?? "",
      teilnahme: initial.teilnahme ?? "",
      grund_bei_ablehnung: initial.grund_bei_ablehnung ?? "",
      bearbeiter: initial.bearbeiter ?? "",
      bemerkung: initial.bemerkung ?? "",
      abgegeben: Boolean(initial.abgegeben ?? false),
      abholfrist: initial.abholfrist ?? "",
      fragefrist: initial.fragefrist ?? "",
      besichtigung: initial.besichtigung ?? "",
      bewertung: initial.bewertung ?? "",
      zuschlagsfrist: initial.zuschlagsfrist ?? "",
      ausfuehrung: initial.ausfuehrung ?? "",
      vergabe_nr: initial.vergabe_nr ?? "",
      link: initial.link ?? ""
    });
  }, [initial]);

  async function save() {
    if (!nameValid) {
      setErr("Name ist erforderlich.");
      return;
    }
    setBusy(true); setErr(null);

    const payload = {
      ...form,
      abgabefrist: form.abgabefrist || null,
      abholfrist: form.abholfrist || null,
      fragefrist: form.fragefrist || null,
      zuschlagsfrist: form.zuschlagsfrist || null
    };

    const res = await fetch(
      mode === "new"
        ? "/api/ausschreibungen"
        : `/api/ausschreibungen/${initial?.id}`,
      {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(()=>({error:"Fehler"}));
      setErr(j.error || "Fehler beim Speichern.");
    } else {
      onSaved();
    }
  }

  const set = (k: string, v: any) => setForm(s => ({...s, [k]: v}));

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {mode === "new" ? "Neuen Datensatz anlegen" : `Datensatz bearbeiten (ID ${initial?.id})`}
      </h2>

      {err && <div className="mb-3 text-red-600">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Abgabefrist</label>
          <input type="date" className="input" value={form.abgabefrist} onChange={e=>set("abgabefrist", e.target.value)} />
        </div>
        <div>
          <label className="label">Uhrzeit</label>
          <input className="input" value={form.uhrzeit} onChange={e=>set("uhrzeit", e.target.value)} />
        </div>
        <div>
          <label className="label">Ort</label>
          <input className="input" value={form.ort} onChange={e=>set("ort", e.target.value)} />
        </div>
        <div>
          <label className="label">Name *</label>
          <input
            required
            aria-invalid={!nameValid}
            className={`input ${!nameValid ? "border-red-500" : ""}`}
            value={form.name}
            onChange={e=>set("name", e.target.value)}
          />
          {!nameValid && err && (
            <div className="text-sm text-red-600 mt-1">Bitte einen Namen eingeben.</div>
          )}
        </div>
        <div>
          <label className="label">Kurzbesch. Auftrag</label>
          <input className="input" value={form.kurzbesch_auftrag} onChange={e=>set("kurzbesch_auftrag", e.target.value)} />
        </div>
        <div>
          <label className="label">Teilnahme?</label>
          <select className="input" value={form.teilnahme} onChange={e=>set("teilnahme", e.target.value)}>
            <option value=""></option><option>Ja</option><option>Nein</option><option>Unklar</option>
          </select>
        </div>
        <div>
          <label className="label">Grund b. Ablehnung</label>
          <input className="input" value={form.grund_bei_ablehnung} onChange={e=>set("grund_bei_ablehnung", e.target.value)} />
        </div>
        <div>
          <label className="label">Bearbeiter</label>
          <input className="input" value={form.bearbeiter} onChange={e=>set("bearbeiter", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Bemerkung</label>
          <textarea className="input" rows={3} value={form.bemerkung} onChange={e=>set("bemerkung", e.target.value)} />
        </div>
        <div>
          <label className="label">Abgegeben</label>
          <input type="checkbox" className="ml-2" checked={form.abgegeben} onChange={e=>set("abgegeben", e.target.checked)} />
        </div>
        <div>
          <label className="label">Vergabe-Nr.</label>
          <input className="input" value={form.vergabe_nr} onChange={e=>set("vergabe_nr", e.target.value)} />
        </div>
        <div>
          <label className="label">Link</label>
          <input className="input" value={form.link} onChange={e=>set("link", e.target.value)} />
        </div>
        <div>
          <label className="label">Abholfrist</label>
          <input type="date" className="input" value={form.abholfrist} onChange={e=>set("abholfrist", e.target.value)} />
        </div>
        <div>
          <label className="label">Fragefrist</label>
          <input type="date" className="input" value={form.fragefrist} onChange={e=>set("fragefrist", e.target.value)} />
        </div>
        <div>
          <label className="label">Besichtigung</label>
          <input className="input" value={form.besichtigung} onChange={e=>set("besichtigung", e.target.value)} />
        </div>
        <div>
          <label className="label">Bewertung</label>
          <input className="input" value={form.bewertung} onChange={e=>set("bewertung", e.target.value)} />
        </div>
        <div>
          <label className="label">Zuschlagsfrist</label>
          <input type="date" className="input" value={form.zuschlagsfrist} onChange={e=>set("zuschlagsfrist", e.target.value)} />
        </div>
        <div>
          <label className="label">Ausführung</label>
          <input className="input" value={form.ausfuehrung} onChange={e=>set("ausfuehrung", e.target.value)} />
        </div>
      </div>

      <div className="mt-6 flex gap-2 justify-end">
        <button onClick={onCancel} className="btn">Abbrechen</button>
        <button onClick={save} disabled={busy || !nameValid} className="btn-primary">
          {busy ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}

