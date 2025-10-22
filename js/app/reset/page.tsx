"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPage() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = token && password.length >= 10 && password === confirm;

  async function submit() {
    setErr(null); setMsg(null); setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        setErr(data?.error || "Zurücksetzen fehlgeschlagen.");
      } else {
        setMsg("Passwort aktualisiert. Sie können sich jetzt anmelden.");
        setTimeout(() => router.push("/login"), 1200);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Passwort zurücksetzen</h1>
      {!token && <div className="text-red-600">Ungültiger oder fehlender Token.</div>}
      {msg && <div className="text-emerald-700">{msg}</div>}
      {err && <div className="text-red-600">{err}</div>}

      <div className="space-y-3">
        <div>
          <label className="label">Neues Passwort (min. 10 Zeichen)</label>
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Passwort bestätigen</label>
          <input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn" onClick={()=>router.push("/")}>Abbrechen</button>
        <button className="btn-primary" disabled={!canSubmit || busy} onClick={submit}>{busy?"Sende…":"Speichern"}</button>
      </div>
    </main>
  );
}

