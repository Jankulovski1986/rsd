"use client";
import { useState } from "react";

type Props = {
  onClose: () => void;
};

export default function InviteUserModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<'admin'|'vertrieb'|'viewer'>('viewer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const validEmail = /.+@.+\..+/.test(email);

  async function submit() {
    setErr(null); setOkMsg(null); setInviteLink(null);
    if (!validEmail) { setErr('Bitte gültige E-Mail angeben.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || null, role })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        setErr(data?.error || 'Einladung fehlgeschlagen.');
      } else {
        if (data?.inviteLink) setInviteLink(String(data.inviteLink));
        setOkMsg(data?.inviteLink ? 'Einladung erstellt. Kein SMTP konfiguriert – Link unten kopieren.' : 'Einladung versendet.');
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = validEmail && !busy;

  return (
    <div className="w-[92vw] max-w-md">
      <h2 className="text-lg font-semibold mb-3">Benutzer einladen</h2>
      {err && <div className="mb-2 text-red-600 text-sm">{err}</div>}
      {okMsg && <div className="mb-2 text-emerald-700 text-sm">{okMsg}</div>}

      <div className="space-y-3">
        <div>
          <label className="label">E-Mail-Adresse</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@firma.de" />
        </div>
        <div>
          <label className="label">Name (optional)</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Max Mustermann" />
        </div>
        <div>
          <label className="label">Rolle</label>
          <select className="input" value={role} onChange={e=>setRole(e.target.value as any)}>
            <option value="viewer">viewer (nur lesen)</option>
            <option value="vertrieb">vertrieb (CRUD)</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>

      {inviteLink && (
        <div className="mt-3 text-xs p-2 bg-amber-50 border rounded break-all">
          <div className="font-medium mb-1">Einladungs-Link:</div>
          <div>{inviteLink}</div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Schließen</button>
        <button className="btn-primary" onClick={submit} disabled={!canSubmit}>{busy ? 'Sende…' : 'Einladen'}</button>
      </div>
    </div>
  );
}

