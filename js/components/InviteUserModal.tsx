"use client";
import { useState } from "react";

type Props = {
  onClose: () => void;
};

export default function InviteUserModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "vertrieb">("vertrieb");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const typedEmail = email.trim();
  const basicEmail = /.+@.+\..+/.test(typedEmail);

  async function submit() {
    setErr(null);
    setEmailErr(null);
    setOkMsg(null);
    setInviteLink(null);

    const domainOk = /@rsd-security\.com$/i.test(typedEmail);
    if (!basicEmail) {
      setEmailErr("Bitte gültige E-Mail angeben.");
      return;
    }
    if (!domainOk) {
      setEmailErr('E-Mail muss auf "@rsd-security.com" enden.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: typedEmail, name: name || null, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || "Einladung fehlgeschlagen.");
      } else {
        if (data?.inviteLink) setInviteLink(String(data.inviteLink));
        setOkMsg(
          data?.inviteLink
            ? "Einladung erstellt. Kein SMTP konfiguriert – Link unten kopieren."
            : "Einladung versendet."
        );
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !!typedEmail && !busy;

  return (
    <div className="inline-block max-w-lg min-w-[320px]">
      <h2 className="text-lg font-semibold mb-3">Benutzer einladen</h2>
      {err && <div className="mb-2 text-red-600 text-sm">{err}</div>}
      {okMsg && <div className="mb-2 text-emerald-700 text-sm">{okMsg}</div>}

      <div className="space-y-3">
        <div>
          <label className="label">E-Mail-Adresse</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@rsd-security.com"
          />
          {emailErr && (
            <div className="text-red-600 text-xs mt-1">{emailErr}</div>
          )}
        </div>
        <div>
          <label className="label">Name (optional)</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
          />
        </div>
        <div>
          <label className="label">Rolle</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="vertrieb">Vertrieb</option>
            <option value="admin">Administrator</option>
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
        <button className="btn" onClick={onClose}>
          Schließen
        </button>
        <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "Sende..." : "Einladen"}
        </button>
      </div>
    </div>
  );
}
