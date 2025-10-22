"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setErr(null); setOk(null); setBusy(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setErr("Login fehlgeschlagen");
      return;
    }
    onClose();
    window.location.reload();
  };

  const doRequestReset = async () => {
    setErr(null); setOk(null); setBusy(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        setErr(data?.error || 'E-Mail ist nicht registriert');
      } else {
        setOk('Reset-Link wurde gesendet.');
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 w-80">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold">{mode === 'login' ? 'Anmelden' : 'Passwort vergessen'}</h2>
      </div>
      {err && <div className="mb-2 text-red-600 text-sm">{err}</div>}
      {ok && <div className="mb-2 text-emerald-700 text-sm">{ok}</div>}

      {mode === 'login' ? (
        <>
          <div className="space-y-2">
            <input className="border p-2 w-full" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="border p-2 w-full" placeholder="Passwort" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          <div className="mt-2 text-xs">
            <button className="text-blue-700 underline" onClick={()=>{ setMode('forgot'); setErr(null); setOk(null); }}>Passwort vergessen?</button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>Abbrechen</button>
            <button className="btn-primary" onClick={doLogin} disabled={busy || !email || !password}>{busy ? "Login…" : "Login"}</button>
          </div>
          <div className="mt-3 text-xs text-gray-500">Nur für Admin/Vertrieb.</div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <input className="border p-2 w-full" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <button className="btn" onClick={()=>{ setMode('login'); setErr(null); setOk(null); }}>Zurück</button>
            <div className="flex gap-2">
              <button className="btn" onClick={onClose}>Schließen</button>
              <button className="btn-primary" onClick={doRequestReset} disabled={busy || !email}>{busy ? 'Sende…' : 'Reset-Link senden'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
